-- Migration 021: Fix RLS photo access for email-only reports + backfill nullable financial fields
-- 
-- Problem 1: photos RLS policy only checks user_id, but email-only reports
--   have user_id = null. Users who created reports before signing up cannot
--   access their photos via the Supabase client.
--
-- Problem 2: Nullable financial fields (amount_paid_cents, savings_amount_cents)
--   should default to 0 instead of null for easier aggregation queries.

-- ─── Fix 1: RLS photo policy to support email-only reports ───────────────

drop policy if exists "Users can upload and view their own photos" on photos;

create policy "Users can view and manage their own photos"
  on photos for all
  using (
    auth.uid() = (select user_id from reports where id = report_id)
    or
    auth.email() = (select client_email from reports where id = report_id)
  );

-- ─── Fix 2: Default financial columns to 0 instead of null ──────────────

alter table reports
  alter column amount_paid_cents set default 0;

-- Backfill existing null values
update reports set amount_paid_cents = 0 where amount_paid_cents is null;
update reports set savings_amount_cents = 0 where savings_amount_cents is null;
