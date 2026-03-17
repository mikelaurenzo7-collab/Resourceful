-- ─── Migration 003: Email-only intake + auto-delivery ───────────────────────
-- Adds client_email for no-account intake, onboarding wizard fields,
-- and removes auth requirement from report creation.

-- Client identification (no auth account needed)
alter table reports add column if not exists client_email text;
alter table reports add column if not exists client_name text;

-- Onboarding wizard context fields
alter table reports add column if not exists photos_skipped boolean not null default false;
alter table reports add column if not exists property_issues jsonb default '[]'::jsonb;
alter table reports add column if not exists additional_notes text;
alter table reports add column if not exists desired_outcome text;

-- Index for looking up reports by client email
create index if not exists idx_reports_client_email on reports(client_email);

-- Make user_id nullable (no longer requires auth.users FK for email-only users)
alter table reports alter column user_id drop not null;

-- Backfill: for existing reports without client_email, set it from user_id
-- (user_id was previously a UUID referencing auth.users; new reports use email as user_id)
-- No-op for fresh databases.
