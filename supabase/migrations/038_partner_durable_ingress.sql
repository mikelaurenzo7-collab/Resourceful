-- ─── Migration 038: Durable Founder + Partner Ingress ───────────────────────
-- Extends the durable pipeline control plane to every paid-work ingress and
-- makes Partner API creation/usage accounting safely replayable.

begin;

-- Partner API requests require a stable client idempotency key. Persist both
-- the key and a fingerprint of the validated request so replaying the same key
-- with different work can never silently alias one report to another.
alter table public.reports
  add column if not exists partner_idempotency_key text,
  add column if not exists partner_request_fingerprint text;

create unique index if not exists reports_partner_idempotency_unique_idx
  on public.reports (api_partner_id, partner_idempotency_key)
  where api_partner_id is not null
    and partner_idempotency_key is not null;

create index if not exists reports_partner_created_idx
  on public.reports (api_partner_id, created_at desc)
  where api_partner_id is not null;

comment on column public.reports.partner_idempotency_key is
  'Partner-supplied Idempotency-Key. Unique per API partner when present.';
comment on column public.reports.partner_request_fingerprint is
  'SHA-256 fingerprint of the validated Partner API request bound to the idempotency key.';

-- One immutable usage charge per partner report. The ledger is the idempotency
-- boundary; aggregate partner counters are updated only when a new ledger row
-- is inserted.
create table if not exists public.partner_report_usage (
  report_id uuid primary key references public.reports(id) on delete restrict,
  partner_id uuid not null references public.api_partners(id) on delete restrict,
  fee_cents integer not null check (fee_cents >= 0),
  created_at timestamptz not null default now()
);

create index if not exists partner_report_usage_partner_created_idx
  on public.partner_report_usage (partner_id, created_at desc);

alter table public.partner_report_usage enable row level security;
revoke all on public.partner_report_usage from anon, authenticated;
grant all on public.partner_report_usage to service_role;

comment on table public.partner_report_usage is
  'Service-role-only idempotency ledger for Partner API report usage and billing counters.';

create or replace function public.record_partner_report_usage(
  p_partner_id uuid,
  p_report_id uuid,
  p_fee_cents integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.partner_report_usage%rowtype;
  v_inserted integer := 0;
begin
  if p_fee_cents < 0 then
    raise exception 'Partner usage fee cannot be negative';
  end if;

  if not exists (
    select 1
    from public.reports
    where id = p_report_id
      and api_partner_id = p_partner_id
  ) then
    raise exception
      'Report % is not durably bound to partner %',
      p_report_id,
      p_partner_id;
  end if;

  insert into public.partner_report_usage (report_id, partner_id, fee_cents)
  values (p_report_id, p_partner_id, p_fee_cents)
  on conflict (report_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select *
    into v_existing
    from public.partner_report_usage
    where report_id = p_report_id;

    if v_existing.partner_id is distinct from p_partner_id
       or v_existing.fee_cents is distinct from p_fee_cents then
      raise exception
        'Partner usage identity mismatch for report %',
        p_report_id;
    end if;

    return;
  end if;

  update public.api_partners
  set
    reports_this_month = reports_this_month + 1,
    total_reports_generated = total_reports_generated + 1,
    total_revenue_cents = total_revenue_cents + p_fee_cents,
    updated_at = now()
  where id = p_partner_id
    and is_active = true;

  if not found then
    raise exception 'Active partner % was not found', p_partner_id;
  end if;
end;
$$;

revoke all on function public.record_partner_report_usage(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.record_partner_report_usage(uuid, uuid, integer)
  to service_role;

-- Retire direct counter mutation as an application path. Existing deployments
-- may still contain migration 016's function, but only service-role code can
-- invoke it after this migration and current application code uses the ledgered
-- function above.
revoke all on function public.increment_partner_usage(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.increment_partner_usage(uuid, integer)
  to service_role;

-- Founder and partner reports are legitimate first-class durable work sources.
-- Keep them distinct from admin reruns so only true admin actions retain the
-- authority to replace an active run.
alter table public.pipeline_runs
  drop constraint if exists pipeline_runs_source_check;

alter table public.pipeline_runs
  add constraint pipeline_runs_source_check check (
    source in (
      'stripe',
      'founder',
      'partner_api',
      'admin',
      'stale_recovery',
      'migration_recovery'
    )
  );

create or replace function public.enqueue_pipeline_run(
  p_report_id uuid,
  p_source text,
  p_idempotency_key text,
  p_start_stage smallint default 1,
  p_max_stage_attempts smallint default 3,
  p_metadata jsonb default '{}'::jsonb,
  p_replace_active boolean default false
)
returns setof public.pipeline_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.pipeline_runs%rowtype;
begin
  if p_source not in (
    'stripe',
    'founder',
    'partner_api',
    'admin',
    'stale_recovery',
    'migration_recovery'
  ) then
    raise exception 'Unsupported pipeline source: %', p_source;
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'Pipeline idempotency key is required';
  end if;

  if p_start_stage < 1 or p_start_stage > 7 then
    raise exception 'Pipeline start stage must be between 1 and 7';
  end if;

  if p_max_stage_attempts < 1 or p_max_stage_attempts > 10 then
    raise exception 'Pipeline max stage attempts must be between 1 and 10';
  end if;

  if p_replace_active and p_source <> 'admin' then
    raise exception 'Only an authenticated admin action may replace an active pipeline run';
  end if;

  select *
  into v_run
  from public.pipeline_runs
  where idempotency_key = p_idempotency_key;

  if found then
    if v_run.report_id is distinct from p_report_id
       or v_run.source is distinct from p_source then
      raise exception
        'Pipeline idempotency key % is already bound to different work',
        p_idempotency_key;
    end if;

    return next v_run;
    return;
  end if;

  select *
  into v_run
  from public.pipeline_runs
  where report_id = p_report_id
    and status in ('queued', 'running', 'retrying')
  order by created_at desc
  limit 1
  for update;

  if found and not p_replace_active then
    return next v_run;
    return;
  end if;

  if found
    and p_replace_active
    and v_run.status = 'running'
    and v_run.lease_expires_at > now() then
    raise exception
      'Pipeline run % is currently leased and cannot be replaced safely',
      v_run.id;
  end if;

  if found and p_replace_active then
    update public.pipeline_runs
    set
      status = 'cancelled',
      lease_owner = null,
      lease_expires_at = null,
      completed_at = now(),
      metadata = metadata || jsonb_build_object(
        'cancelled_by_source', p_source,
        'cancelled_at', now()
      )
    where id = v_run.id;
  end if;

  if p_replace_active then
    update public.reports
    set
      status = 'paid',
      pipeline_started_at = null,
      pipeline_completed_at = null,
      pipeline_error_log = null,
      pipeline_last_completed_stage = null,
      report_pdf_storage_path = null
    where id = p_report_id
      and status in ('failed', 'rejected', 'pending_approval');

    if not found then
      raise exception
        'Report % is not in a rerunnable terminal or review state',
        p_report_id;
    end if;
  end if;

  begin
    insert into public.pipeline_runs (
      report_id,
      source,
      start_stage,
      current_stage,
      max_stage_attempts,
      idempotency_key,
      metadata
    )
    values (
      p_report_id,
      p_source,
      p_start_stage,
      p_start_stage,
      p_max_stage_attempts,
      p_idempotency_key,
      coalesce(p_metadata, '{}'::jsonb)
    )
    returning * into v_run;
  exception
    when unique_violation then
      select *
      into v_run
      from public.pipeline_runs
      where idempotency_key = p_idempotency_key
         or (
           report_id = p_report_id
           and status in ('queued', 'running', 'retrying')
         )
      order by
        case when idempotency_key = p_idempotency_key then 0 else 1 end,
        created_at desc
      limit 1;
  end;

  if v_run.id is null then
    raise exception 'Failed to establish durable ownership for report %', p_report_id;
  end if;

  if v_run.report_id is distinct from p_report_id then
    raise exception
      'Pipeline idempotency key % resolved to a different report',
      p_idempotency_key;
  end if;

  return next v_run;
end;
$$;

-- CREATE OR REPLACE preserves the existing service_role grant, but state the
-- contract explicitly for fresh and upgraded projects.
revoke all on function public.enqueue_pipeline_run(
  uuid, text, text, smallint, smallint, jsonb, boolean
) from public, anon, authenticated;
grant execute on function public.enqueue_pipeline_run(
  uuid, text, text, smallint, smallint, jsonb, boolean
) to service_role;

commit;
