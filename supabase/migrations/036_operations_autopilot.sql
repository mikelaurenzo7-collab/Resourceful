-- Operations Autopilot
-- Adds an auditable control plane for jurisdiction maintenance and future
-- filing/evidence/delivery automation. All tables are service-role only.

begin;

create extension if not exists pgcrypto;
set local search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Automation runs: one durable record for every reconciliation execution.
-- ---------------------------------------------------------------------------
create table if not exists public.automation_runs (
  id                    uuid primary key default gen_random_uuid(),
  automation_key        text not null,
  status                text not null default 'running'
                        check (status in ('running', 'succeeded', 'failed')),
  started_at            timestamptz not null default now(),
  completed_at          timestamptz,
  scanned_count         integer not null default 0 check (scanned_count >= 0),
  planned_count         integer not null default 0 check (planned_count >= 0),
  created_count         integer not null default 0 check (created_count >= 0),
  reopened_count        integer not null default 0 check (reopened_count >= 0),
  updated_count         integer not null default 0 check (updated_count >= 0),
  resolved_count        integer not null default 0 check (resolved_count >= 0),
  details               jsonb not null default '{}'::jsonb,
  error_message         text,
  created_at            timestamptz not null default now(),
  constraint automation_runs_completion_consistency check (
    (status = 'running' and completed_at is null)
    or (status in ('succeeded', 'failed') and completed_at is not null)
  )
);

create index if not exists idx_automation_runs_key_started_at
  on public.automation_runs (automation_key, started_at desc);

create index if not exists idx_automation_runs_status_started_at
  on public.automation_runs (status, started_at desc);

-- ---------------------------------------------------------------------------
-- Operations tasks: one idempotent work object per persistent condition.
-- The same table can later accept filing, evidence, delivery, and partner work.
-- ---------------------------------------------------------------------------
create table if not exists public.operations_tasks (
  id                    uuid primary key default gen_random_uuid(),
  idempotency_key       text not null unique,
  source                text not null,
  category              text not null,
  task_type             text not null,
  subject_type          text not null,
  subject_key           text not null,
  county_fips           text references public.county_rules(county_fips) on delete set null,
  report_id             uuid references public.reports(id) on delete set null,
  title                 text not null,
  description           text not null,
  status                text not null default 'open'
                        check (status in ('open', 'in_progress', 'blocked', 'snoozed', 'resolved', 'dismissed')),
  priority              text not null default 'medium'
                        check (priority in ('critical', 'high', 'medium', 'low')),
  due_at                timestamptz,
  snoozed_until         timestamptz,
  assigned_to           uuid references auth.users(id) on delete set null,
  first_detected_at     timestamptz not null default now(),
  last_detected_at      timestamptz not null default now(),
  resolved_at           timestamptz,
  resolution_code       text,
  resolution_notes      text,
  metadata              jsonb not null default '{}'::jsonb,
  automation_run_id     uuid references public.automation_runs(id) on delete set null,
  last_actor_type       text not null default 'system'
                        check (last_actor_type in ('system', 'automation', 'admin')),
  last_actor_id         uuid references auth.users(id) on delete set null,
  last_actor_email      text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint operations_tasks_subject_present check (length(trim(subject_key)) > 0),
  constraint operations_tasks_resolution_consistency check (
    (status in ('resolved', 'dismissed') and resolved_at is not null)
    or (status not in ('resolved', 'dismissed'))
  ),
  constraint operations_tasks_snooze_consistency check (
    status <> 'snoozed' or snoozed_until is not null
  )
);

create index if not exists idx_operations_tasks_active_queue
  on public.operations_tasks (priority, due_at nulls last, created_at)
  where status in ('open', 'in_progress', 'blocked', 'snoozed');

create index if not exists idx_operations_tasks_source_status
  on public.operations_tasks (source, status, last_detected_at desc);

create index if not exists idx_operations_tasks_county
  on public.operations_tasks (county_fips, status)
  where county_fips is not null;

create index if not exists idx_operations_tasks_report
  on public.operations_tasks (report_id, status)
  where report_id is not null;

create index if not exists idx_operations_tasks_run
  on public.operations_tasks (automation_run_id)
  where automation_run_id is not null;

create or replace function public.set_operations_task_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_operations_tasks_updated_at on public.operations_tasks;
create trigger trg_operations_tasks_updated_at
before update on public.operations_tasks
for each row execute function public.set_operations_task_updated_at();

-- ---------------------------------------------------------------------------
-- Task events: append-only history for every meaningful queue transition.
-- ---------------------------------------------------------------------------
create table if not exists public.operations_task_events (
  id                    uuid primary key default gen_random_uuid(),
  task_id               uuid not null references public.operations_tasks(id) on delete cascade,
  event_type            text not null
                        check (event_type in ('created', 'status_changed', 'priority_changed', 'auto_resolved')),
  from_status           text,
  to_status             text,
  from_priority         text,
  to_priority           text,
  actor_type            text not null
                        check (actor_type in ('system', 'automation', 'admin')),
  actor_id              uuid references auth.users(id) on delete set null,
  actor_email           text,
  automation_run_id     uuid references public.automation_runs(id) on delete set null,
  details               jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now()
);

create index if not exists idx_operations_task_events_task_created
  on public.operations_task_events (task_id, created_at desc);

create index if not exists idx_operations_task_events_run
  on public.operations_task_events (automation_run_id, created_at)
  where automation_run_id is not null;

create or replace function public.capture_operations_task_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_type text;
begin
  if tg_op = 'INSERT' then
    insert into public.operations_task_events (
      task_id,
      event_type,
      to_status,
      to_priority,
      actor_type,
      actor_id,
      actor_email,
      automation_run_id,
      details
    ) values (
      new.id,
      'created',
      new.status,
      new.priority,
      new.last_actor_type,
      new.last_actor_id,
      new.last_actor_email,
      new.automation_run_id,
      jsonb_build_object('source', new.source, 'task_type', new.task_type)
    );
    return new;
  end if;

  if new.status is distinct from old.status then
    v_event_type := case
      when new.status = 'resolved' and new.resolution_code = 'condition_cleared'
        then 'auto_resolved'
      else 'status_changed'
    end;

    insert into public.operations_task_events (
      task_id,
      event_type,
      from_status,
      to_status,
      from_priority,
      to_priority,
      actor_type,
      actor_id,
      actor_email,
      automation_run_id,
      details
    ) values (
      new.id,
      v_event_type,
      old.status,
      new.status,
      old.priority,
      new.priority,
      new.last_actor_type,
      new.last_actor_id,
      new.last_actor_email,
      new.automation_run_id,
      jsonb_strip_nulls(jsonb_build_object(
        'resolution_code', new.resolution_code,
        'resolution_notes', new.resolution_notes,
        'snoozed_until', new.snoozed_until
      ))
    );
  elsif new.priority is distinct from old.priority then
    insert into public.operations_task_events (
      task_id,
      event_type,
      from_status,
      to_status,
      from_priority,
      to_priority,
      actor_type,
      actor_id,
      actor_email,
      automation_run_id,
      details
    ) values (
      new.id,
      'priority_changed',
      old.status,
      new.status,
      old.priority,
      new.priority,
      new.last_actor_type,
      new.last_actor_id,
      new.last_actor_email,
      new.automation_run_id,
      '{}'::jsonb
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_capture_operations_task_event on public.operations_tasks;
create trigger trg_capture_operations_task_event
after insert or update on public.operations_tasks
for each row execute function public.capture_operations_task_event();

create or replace function public.reject_operations_task_event_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'operations_task_events is append-only';
end;
$$;

drop trigger if exists trg_reject_operations_task_event_mutation on public.operations_task_events;
create trigger trg_reject_operations_task_event_mutation
before update or delete on public.operations_task_events
for each row execute function public.reject_operations_task_event_mutation();

-- ---------------------------------------------------------------------------
-- Jurisdiction rule versions: immutable snapshots of every material rule edit.
-- created_at/updated_at are excluded from the hash so timestamp-only updates do
-- not manufacture a new legal-rules version.
-- ---------------------------------------------------------------------------
create table if not exists public.jurisdiction_rule_versions (
  id                    uuid primary key default gen_random_uuid(),
  county_fips           text not null references public.county_rules(county_fips) on delete restrict,
  rule_version          integer not null check (rule_version > 0),
  content_sha256        text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  snapshot              jsonb not null,
  verified_on           date,
  verified_by           text,
  source_references     jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  unique (county_fips, rule_version),
  unique (county_fips, content_sha256)
);

create index if not exists idx_jurisdiction_rule_versions_county_version
  on public.jurisdiction_rule_versions (county_fips, rule_version desc);

create or replace function public.capture_county_rule_version()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_snapshot jsonb;
  v_hash text;
  v_next_version integer;
begin
  v_snapshot := to_jsonb(new) - array['created_at', 'updated_at'];
  v_hash := encode(digest(convert_to(v_snapshot::text, 'UTF8'), 'sha256'), 'hex');

  perform pg_advisory_xact_lock(hashtext(new.county_fips));

  if exists (
    select 1
    from public.jurisdiction_rule_versions
    where county_fips = new.county_fips
      and content_sha256 = v_hash
  ) then
    return new;
  end if;

  select coalesce(max(rule_version), 0) + 1
    into v_next_version
  from public.jurisdiction_rule_versions
  where county_fips = new.county_fips;

  insert into public.jurisdiction_rule_versions (
    county_fips,
    rule_version,
    content_sha256,
    snapshot,
    verified_on,
    verified_by,
    source_references
  ) values (
    new.county_fips,
    v_next_version,
    v_hash,
    v_snapshot,
    new.last_verified_date,
    new.verified_by,
    jsonb_strip_nulls(jsonb_build_object(
      'portal_url', new.portal_url,
      'filing_email', new.filing_email,
      'form_download_url', new.form_download_url,
      'state_appeal_board_url', new.state_appeal_board_url,
      'assessor_api_documentation_url', new.assessor_api_documentation_url
    ))
  );

  return new;
end;
$$;

drop trigger if exists trg_capture_county_rule_version on public.county_rules;
create trigger trg_capture_county_rule_version
after insert or update on public.county_rules
for each row execute function public.capture_county_rule_version();

-- Seed one baseline version for every current county rule.
with current_rules as (
  select
    cr.county_fips,
    to_jsonb(cr) - array['created_at', 'updated_at'] as snapshot,
    cr.last_verified_date,
    cr.verified_by,
    jsonb_strip_nulls(jsonb_build_object(
      'portal_url', cr.portal_url,
      'filing_email', cr.filing_email,
      'form_download_url', cr.form_download_url,
      'state_appeal_board_url', cr.state_appeal_board_url,
      'assessor_api_documentation_url', cr.assessor_api_documentation_url
    )) as source_references
  from public.county_rules as cr
)
insert into public.jurisdiction_rule_versions (
  county_fips,
  rule_version,
  content_sha256,
  snapshot,
  verified_on,
  verified_by,
  source_references
)
select
  county_fips,
  1,
  encode(digest(convert_to(snapshot::text, 'UTF8'), 'sha256'), 'hex'),
  snapshot,
  last_verified_date,
  verified_by,
  source_references
from current_rules
on conflict do nothing;

create or replace function public.reject_jurisdiction_rule_version_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'jurisdiction_rule_versions is append-only';
end;
$$;

drop trigger if exists trg_reject_jurisdiction_rule_version_mutation on public.jurisdiction_rule_versions;
create trigger trg_reject_jurisdiction_rule_version_mutation
before update or delete on public.jurisdiction_rule_versions
for each row execute function public.reject_jurisdiction_rule_version_mutation();

revoke all on function public.set_operations_task_updated_at() from public;
revoke all on function public.capture_operations_task_event() from public;
revoke all on function public.reject_operations_task_event_mutation() from public;
revoke all on function public.capture_county_rule_version() from public;
revoke all on function public.reject_jurisdiction_rule_version_mutation() from public;

-- Service role only. Admin UI and cron routes access these through server-side
-- service-role clients after independent authentication/authorization checks.
alter table public.automation_runs enable row level security;
alter table public.operations_tasks enable row level security;
alter table public.operations_task_events enable row level security;
alter table public.jurisdiction_rule_versions enable row level security;

revoke all on public.automation_runs from anon, authenticated;
revoke all on public.operations_tasks from anon, authenticated;
revoke all on public.operations_task_events from anon, authenticated;
revoke all on public.jurisdiction_rule_versions from anon, authenticated;

grant all on public.automation_runs to service_role;
grant all on public.operations_tasks to service_role;
grant all on public.operations_task_events to service_role;
grant all on public.jurisdiction_rule_versions to service_role;

comment on table public.automation_runs is
  'Durable execution ledger for idempotent operational automations.';
comment on table public.operations_tasks is
  'Reusable operations queue for jurisdiction, filing, evidence, delivery, and partner work.';
comment on table public.operations_task_events is
  'Append-only actor and status history for operations tasks.';
comment on table public.jurisdiction_rule_versions is
  'Append-only snapshots of material county_rules changes, with content hashes and source references.';

commit;
