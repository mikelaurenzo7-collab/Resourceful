-- ─── Migration 036: Durable Pipeline Control Plane ──────────────────────────
-- Replaces request-scoped, fire-and-forget report generation with a durable,
-- lease-based work ledger. Each worker invocation owns exactly one recoverable
-- stage. Paid work is acknowledged only after a durable pipeline_runs row exists.
--
-- The control plane is service-role only. Customer-facing report state remains
-- in public.reports; pipeline_runs is an internal operational ledger.

create table if not exists public.pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  source text not null check (
    source in ('stripe', 'admin', 'stale_recovery', 'migration_recovery')
  ),
  status text not null default 'queued' check (
    status in ('queued', 'running', 'retrying', 'succeeded', 'dead_letter', 'cancelled')
  ),
  start_stage smallint not null default 1 check (start_stage between 1 and 7),
  current_stage smallint not null default 1 check (current_stage between 1 and 7),
  stage_attempt_count integer not null default 0 check (stage_attempt_count >= 0),
  total_attempt_count integer not null default 0 check (total_attempt_count >= 0),
  max_stage_attempts smallint not null default 3 check (max_stage_attempts between 1 and 10),
  available_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  idempotency_key text not null unique,
  workflow_version text not null default 'pipeline-v1',
  last_completed_stage text,
  last_error jsonb,
  metadata jsonb not null default '{}'::jsonb,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pipeline_runs_lease_state_check check (
    (
      status = 'running'
      and lease_owner is not null
      and lease_expires_at is not null
    )
    or (
      status <> 'running'
      and lease_owner is null
      and lease_expires_at is null
    )
  )
);

comment on table public.pipeline_runs is
  'Durable, service-role-only execution ledger for the seven-stage report pipeline.';
comment on column public.pipeline_runs.idempotency_key is
  'Stable trigger key. Stripe uses payment-intent identity; operator reruns use a unique action identity.';
comment on column public.pipeline_runs.lease_expires_at is
  'Short-lived worker lease. Expiration allows a killed serverless invocation to be reclaimed safely.';
comment on column public.pipeline_runs.stage_attempt_count is
  'Attempts for current_stage. Reset to zero only after that stage advances.';
comment on column public.pipeline_runs.metadata is
  'Operational metadata only. Never store full reports, documents, authorization forms, or unnecessary PII.';

create index if not exists pipeline_runs_due_idx
  on public.pipeline_runs (available_at, created_at)
  where status in ('queued', 'retrying');

create index if not exists pipeline_runs_expired_lease_idx
  on public.pipeline_runs (lease_expires_at)
  where status = 'running';

create index if not exists pipeline_runs_report_history_idx
  on public.pipeline_runs (report_id, created_at desc);

create index if not exists pipeline_runs_dead_letter_idx
  on public.pipeline_runs (completed_at desc)
  where status = 'dead_letter';

create unique index if not exists pipeline_runs_one_active_per_report_idx
  on public.pipeline_runs (report_id)
  where status in ('queued', 'running', 'retrying');

-- Stage 5 can be reclaimed after persisting its filing prefill but before the
-- pipeline completion marker is written. Preserve one live prefill per report
-- so a retry cannot create duplicate customer-facing filing work.
with ranked_prefills as (
  select
    id,
    row_number() over (
      partition by report_id
      order by created_at desc, id desc
    ) as duplicate_rank
  from public.form_submissions
  where submission_status = 'prefill_ready'
)
delete from public.form_submissions
where id in (
  select id
  from ranked_prefills
  where duplicate_rank > 1
);

create unique index if not exists form_submissions_one_prefill_per_report_idx
  on public.form_submissions (report_id)
  where submission_status = 'prefill_ready';

alter table public.pipeline_runs enable row level security;
-- Deliberately no customer policies. The service role is the sole data-plane
-- actor for this internal control table.

create or replace function public.set_pipeline_run_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists pipeline_runs_set_updated_at on public.pipeline_runs;
create trigger pipeline_runs_set_updated_at
before update on public.pipeline_runs
for each row execute function public.set_pipeline_run_updated_at();

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
  if p_source not in ('stripe', 'admin', 'stale_recovery', 'migration_recovery') then
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

  -- An operator rerun must never reset the customer-visible report in one
  -- request and establish replacement ownership in another. Keep both changes
  -- inside this transaction so a failed insert rolls the reset back.
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

  return next v_run;
end;
$$;

create or replace function public.claim_pipeline_run(
  p_worker_id text,
  p_lease_seconds integer default 360
)
returns setof public.pipeline_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.pipeline_runs%rowtype;
begin
  if p_worker_id is null or btrim(p_worker_id) = '' then
    raise exception 'Pipeline worker identity is required';
  end if;

  if p_lease_seconds < 60 or p_lease_seconds > 900 then
    raise exception 'Pipeline lease must be between 60 and 900 seconds';
  end if;

  -- A killed worker cannot call fail_pipeline_run. Once its final permitted
  -- lease expires, move the run and report to an explicit dead-letter state.
  with exhausted as (
    update public.pipeline_runs
    set
      status = 'dead_letter',
      lease_owner = null,
      lease_expires_at = null,
      completed_at = now(),
      last_error = coalesce(
        last_error,
        jsonb_build_object(
          'stage', current_stage,
          'error', 'Worker lease expired after maximum stage attempts',
          'timestamp', now()
        )
      )
    where status = 'running'
      and lease_expires_at <= now()
      and stage_attempt_count >= max_stage_attempts
    returning report_id, current_stage, last_error
  )
  update public.reports as reports
  set
    status = 'failed',
    pipeline_error_log = jsonb_build_object(
      'stage', exhausted.current_stage,
      'error', coalesce(
        exhausted.last_error ->> 'error',
        'Pipeline exhausted worker leases'
      ),
      'timestamp', now(),
      'source', 'durable_pipeline_control_plane'
    )
  from exhausted
  where reports.id = exhausted.report_id
    and reports.status in ('paid', 'processing');

  with candidate as (
    select id
    from public.pipeline_runs
    where (
      (
        status in ('queued', 'retrying')
        and available_at <= now()
      )
      or (
        status = 'running'
        and lease_expires_at <= now()
      )
    )
      and stage_attempt_count < max_stage_attempts
    order by available_at asc, created_at asc
    for update skip locked
    limit 1
  )
  update public.pipeline_runs as runs
  set
    status = 'running',
    lease_owner = p_worker_id,
    lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    started_at = coalesce(started_at, now()),
    stage_attempt_count = stage_attempt_count + 1,
    total_attempt_count = total_attempt_count + 1
  where runs.id = (select id from candidate)
  returning runs.* into v_run;

  if v_run.id is not null then
    return next v_run;
  end if;
end;
$$;

create or replace function public.advance_pipeline_run(
  p_run_id uuid,
  p_worker_id text,
  p_next_stage smallint,
  p_completed_stage text,
  p_metadata jsonb default '{}'::jsonb
)
returns setof public.pipeline_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.pipeline_runs%rowtype;
begin
  if p_next_stage < 1 or p_next_stage > 7 then
    raise exception 'Pipeline next stage must be between 1 and 7';
  end if;

  update public.pipeline_runs
  set
    status = 'queued',
    current_stage = p_next_stage,
    stage_attempt_count = 0,
    available_at = now(),
    lease_owner = null,
    lease_expires_at = null,
    last_completed_stage = p_completed_stage,
    last_error = null,
    metadata = metadata || coalesce(p_metadata, '{}'::jsonb)
  where id = p_run_id
    and status = 'running'
    and lease_owner = p_worker_id
  returning * into v_run;

  if v_run.id is null then
    raise exception 'Pipeline run % is not owned by worker %', p_run_id, p_worker_id;
  end if;

  return next v_run;
end;
$$;

create or replace function public.complete_pipeline_run(
  p_run_id uuid,
  p_worker_id text,
  p_completed_stage text,
  p_metadata jsonb default '{}'::jsonb
)
returns setof public.pipeline_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.pipeline_runs%rowtype;
begin
  update public.pipeline_runs
  set
    status = 'succeeded',
    stage_attempt_count = 0,
    lease_owner = null,
    lease_expires_at = null,
    completed_at = now(),
    last_completed_stage = p_completed_stage,
    last_error = null,
    metadata = metadata || coalesce(p_metadata, '{}'::jsonb)
  where id = p_run_id
    and status = 'running'
    and lease_owner = p_worker_id
  returning * into v_run;

  if v_run.id is null then
    raise exception 'Pipeline run % is not owned by worker %', p_run_id, p_worker_id;
  end if;

  return next v_run;
end;
$$;

create or replace function public.fail_pipeline_run(
  p_run_id uuid,
  p_worker_id text,
  p_error jsonb,
  p_retry_delay_seconds integer default 30
)
returns setof public.pipeline_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.pipeline_runs%rowtype;
  v_terminal boolean;
begin
  select *
  into v_run
  from public.pipeline_runs
  where id = p_run_id
  for update;

  if not found
    or v_run.status <> 'running'
    or v_run.lease_owner is distinct from p_worker_id then
    raise exception 'Pipeline run % is not owned by worker %', p_run_id, p_worker_id;
  end if;

  v_terminal := v_run.stage_attempt_count >= v_run.max_stage_attempts;

  update public.pipeline_runs
  set
    status = case when v_terminal then 'dead_letter' else 'retrying' end,
    available_at = case
      when v_terminal then available_at
      else now() + make_interval(secs => greatest(0, p_retry_delay_seconds))
    end,
    lease_owner = null,
    lease_expires_at = null,
    completed_at = case when v_terminal then now() else null end,
    last_error = coalesce(
      p_error,
      jsonb_build_object(
        'stage', current_stage,
        'error', 'Pipeline stage failed without structured error',
        'timestamp', now()
      )
    )
  where id = p_run_id
  returning * into v_run;

  if v_terminal then
    update public.reports
    set
      status = 'failed',
      pipeline_error_log = jsonb_build_object(
        'stage', v_run.current_stage,
        'error', coalesce(
          v_run.last_error ->> 'error',
          'Pipeline stage exhausted retries'
        ),
        'timestamp', now(),
        'run_id', v_run.id,
        'source', 'durable_pipeline_control_plane'
      )
    where id = v_run.report_id
      and status in ('paid', 'processing');
  end if;

  return next v_run;
end;
$$;

create or replace function public.get_pipeline_queue_health()
returns table (
  queued_count bigint,
  running_count bigint,
  retrying_count bigint,
  dead_letter_count bigint,
  succeeded_last_24h_count bigint,
  expired_lease_count bigint,
  oldest_due_at timestamptz,
  oldest_due_age_seconds bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with summary as (
    select
      count(*) filter (where status = 'queued') as queued_count,
      count(*) filter (where status = 'running') as running_count,
      count(*) filter (where status = 'retrying') as retrying_count,
      count(*) filter (where status = 'dead_letter') as dead_letter_count,
      count(*) filter (
        where status = 'succeeded'
          and completed_at >= now() - interval '24 hours'
      ) as succeeded_last_24h_count,
      count(*) filter (
        where status = 'running'
          and lease_expires_at <= now()
      ) as expired_lease_count,
      min(available_at) filter (
        where status in ('queued', 'retrying')
          and available_at <= now()
      ) as oldest_due_at
    from public.pipeline_runs
  )
  select
    summary.queued_count,
    summary.running_count,
    summary.retrying_count,
    summary.dead_letter_count,
    summary.succeeded_last_24h_count,
    summary.expired_lease_count,
    summary.oldest_due_at,
    case
      when summary.oldest_due_at is null then null
      else greatest(
        0,
        extract(epoch from (now() - summary.oldest_due_at))::bigint
      )
    end as oldest_due_age_seconds
  from summary;
$$;

revoke all on function public.enqueue_pipeline_run(
  uuid, text, text, smallint, smallint, jsonb, boolean
) from public, anon, authenticated;
revoke all on function public.claim_pipeline_run(text, integer)
  from public, anon, authenticated;
revoke all on function public.advance_pipeline_run(
  uuid, text, smallint, text, jsonb
) from public, anon, authenticated;
revoke all on function public.complete_pipeline_run(
  uuid, text, text, jsonb
) from public, anon, authenticated;
revoke all on function public.fail_pipeline_run(
  uuid, text, jsonb, integer
) from public, anon, authenticated;
revoke all on function public.get_pipeline_queue_health()
  from public, anon, authenticated;

grant execute on function public.enqueue_pipeline_run(
  uuid, text, text, smallint, smallint, jsonb, boolean
) to service_role;
grant execute on function public.claim_pipeline_run(text, integer)
  to service_role;
grant execute on function public.advance_pipeline_run(
  uuid, text, smallint, text, jsonb
) to service_role;
grant execute on function public.complete_pipeline_run(
  uuid, text, text, jsonb
) to service_role;
grant execute on function public.fail_pipeline_run(
  uuid, text, jsonb, integer
) to service_role;
grant execute on function public.get_pipeline_queue_health()
  to service_role;

-- Recover legacy reports that were paid or left processing before the durable
-- control plane existed. The active-run uniqueness constraint prevents doubles.
insert into public.pipeline_runs (
  report_id,
  source,
  status,
  start_stage,
  current_stage,
  idempotency_key,
  metadata
)
select
  reports.id,
  'migration_recovery',
  'queued',
  case reports.pipeline_last_completed_stage
    when 'stage-1-data' then 2
    when 'stage-2-comps' then 3
    when 'stage-3-income' then 4
    when 'stage-4-photos' then 5
    when 'stage-5-narratives' then 6
    when 'stage-6-filing' then 7
    when 'stage-7-pdf' then 7
    else 1
  end,
  case reports.pipeline_last_completed_stage
    when 'stage-1-data' then 2
    when 'stage-2-comps' then 3
    when 'stage-3-income' then 4
    when 'stage-4-photos' then 5
    when 'stage-5-narratives' then 6
    when 'stage-6-filing' then 7
    when 'stage-7-pdf' then 7
    else 1
  end,
  'migration:036:' || reports.id::text,
  jsonb_build_object(
    'recovered_from_status', reports.status,
    'recovered_at', now()
  )
from public.reports as reports
where reports.status in ('paid', 'processing')
on conflict do nothing;
