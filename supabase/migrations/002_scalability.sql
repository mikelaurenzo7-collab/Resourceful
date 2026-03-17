-- ─── Migration 002: Scalability ─────────────────────────────────────────────
-- Adds missing indexes on foreign keys, compound indexes for common queries,
-- distributed rate limiting table, pipeline concurrency lock, and file size
-- constraints.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Missing foreign-key indexes (child tables queried by report_id in pipeline)
-- ═══════════════════════════════════════════════════════════════════════════════

create index if not exists idx_photos_report_id
  on photos(report_id);

create index if not exists idx_report_narratives_report_id
  on report_narratives(report_id);

create index if not exists idx_measurements_report_id
  on measurements(report_id);

create index if not exists idx_income_analysis_report_id
  on income_analysis(report_id);

create index if not exists idx_property_data_report_id
  on property_data(report_id);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Compound indexes for common admin/metrics queries
-- ═══════════════════════════════════════════════════════════════════════════════

-- Admin reports queue: filter by status, sort by pipeline_completed_at
create index if not exists idx_reports_status_pipeline_completed
  on reports(status, pipeline_completed_at);

-- Revenue queries: filter by payment + date range
create index if not exists idx_reports_paid_created
  on reports(amount_paid_cents, created_at)
  where amount_paid_cents is not null;

-- Dashboard: user's reports ordered by date
create index if not exists idx_reports_user_created
  on reports(user_id, created_at desc);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Distributed rate limiting table + atomic increment function
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists rate_limit_entries (
  key text primary key,
  count integer not null default 1,
  expires_at timestamptz not null
);

-- Index for periodic cleanup of expired entries
create index if not exists idx_rate_limit_expires
  on rate_limit_entries(expires_at);

-- Atomic check-and-increment: upserts a row and returns the new count.
-- If the row exists and hasn't expired, increment. Otherwise, reset to 1.
create or replace function increment_rate_limit(
  p_key text,
  p_window_expires timestamptz
) returns integer as $$
declare
  v_count integer;
begin
  insert into rate_limit_entries (key, count, expires_at)
  values (p_key, 1, p_window_expires)
  on conflict (key) do update
    set count = case
      when rate_limit_entries.expires_at <= now() then 1
      else rate_limit_entries.count + 1
    end,
    expires_at = excluded.expires_at
  returning count into v_count;

  return v_count;
end;
$$ language plpgsql;

-- Periodic cleanup: call from a Supabase cron or pg_cron extension
-- select cron.schedule('rate-limit-cleanup', '*/5 * * * *',
--   $$delete from rate_limit_entries where expires_at < now()$$);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Pipeline concurrency lock (prevents duplicate pipeline runs per report)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Advisory lock based on report UUID. Call before starting pipeline.
-- Returns true if lock acquired, false if another pipeline is already running.
create or replace function acquire_pipeline_lock(p_report_id uuid)
returns boolean as $$
declare
  v_lock_key bigint;
begin
  -- Convert first 8 bytes of UUID to a bigint for pg_try_advisory_lock
  v_lock_key := ('x' || replace(p_report_id::text, '-', ''))::bit(64)::bigint;
  return pg_try_advisory_lock(v_lock_key);
end;
$$ language plpgsql;

create or replace function release_pipeline_lock(p_report_id uuid)
returns void as $$
declare
  v_lock_key bigint;
begin
  v_lock_key := ('x' || replace(p_report_id::text, '-', ''))::bit(64)::bigint;
  perform pg_advisory_unlock(v_lock_key);
end;
$$ language plpgsql;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. RLS on rate_limit_entries (service role only)
-- ═══════════════════════════════════════════════════════════════════════════════

alter table rate_limit_entries enable row level security;
-- No policies = only service_role can access (used by admin client in API routes)
