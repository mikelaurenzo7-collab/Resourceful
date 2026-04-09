-- ─── Migration 023: Fix RLS for Email-Only Users on Attorney & Form Tables ───
--
-- Problem:
-- Migration 010 created RLS policies on attorney_referrals and form_submissions
-- that only match on user_id via auth.uid(). Email-only intake users have
-- user_id = NULL on their reports row, so these policies silently deny access.
-- The user can see their report (fixed in 022_production_hardening.sql) but
-- cannot see attorney referrals or form submissions linked to that report.
--
-- Fix:
-- Apply the same email-fallback pattern used in 022_production_hardening.sql
-- for the reports table: if user_id IS NULL but client_email matches the JWT
-- email claim, grant access. This keeps authenticated-user gating while
-- covering the email-only intake gap.
--
-- Service-role policies are unchanged — they already use USING (true).

-- ── attorney_referrals ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "attorney_referrals_user_select" ON attorney_referrals;

CREATE POLICY "attorney_referrals_user_select"
  ON attorney_referrals FOR SELECT TO authenticated
  USING (
    report_id IN (
      SELECT id FROM reports
      WHERE auth.uid() = user_id
         OR (
           user_id IS NULL
           AND client_email IS NOT NULL
           AND (auth.jwt() ->> 'email') = client_email
         )
    )
  );

-- ── form_submissions ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "form_submissions_user_select" ON form_submissions;

CREATE POLICY "form_submissions_user_select"
  ON form_submissions FOR SELECT TO authenticated
  USING (
    report_id IN (
      SELECT id FROM reports
      WHERE auth.uid() = user_id
         OR (
           user_id IS NULL
           AND client_email IS NOT NULL
           AND (auth.jwt() ->> 'email') = client_email
         )
    )
  );
