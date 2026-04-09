-- ─── Migration 028: Production Hardening ─────────────────────────────────────
-- Fixes identified during production readiness audit:
-- 1. Composite index for dashboard queries (client_email, status)
-- 2. Composite index for calibration params lookups
-- 3. Index for admin queue by review tier + status
-- 4. Fix tax_bill fields from numeric to integer (cents convention)
-- 5. Default NOT NULL on critical financial fields for new rows
-- 6. RLS policy improvement for email-only users

-- ── 1. Composite Indexes ─────────────────────────────────────────────────────

-- Dashboard queries filter by (client_email + status) and (user_id + status)
CREATE INDEX IF NOT EXISTS idx_reports_client_email_status 
  ON reports(client_email, status);

CREATE INDEX IF NOT EXISTS idx_reports_user_id_status 
  ON reports(user_id, status) 
  WHERE user_id IS NOT NULL;

-- Calibration params lookup by (property_type, county_fips)
CREATE INDEX IF NOT EXISTS idx_calibration_params_type_county 
  ON calibration_params(property_type, county_fips);

-- Admin queue: review tier + status + created_at for sorting
CREATE INDEX IF NOT EXISTS idx_reports_review_status_created 
  ON reports(review_tier, status, created_at DESC) 
  WHERE status IN ('pending_approval', 'delivering');

-- ── 2. Fix Tax Bill Field Types ──────────────────────────────────────────────
-- tax_bill_assessed_value and tax_bill_tax_amount were created as numeric
-- but should be integer to match the cents convention used everywhere else.
-- Safe ALTER: numeric → integer truncates any fractional part.

ALTER TABLE reports 
  ALTER COLUMN tax_bill_assessed_value TYPE integer USING tax_bill_assessed_value::integer;

ALTER TABLE reports 
  ALTER COLUMN tax_bill_tax_amount TYPE integer USING tax_bill_tax_amount::integer;

-- ── 3. Financial Field Defaults ──────────────────────────────────────────────
-- Ensure new rows get 0 instead of NULL for financial fields.
-- We don't retroactively change existing NULLs (they correctly mean "not yet set").

ALTER TABLE reports 
  ALTER COLUMN amount_paid_cents SET DEFAULT 0;

-- ── 4. RLS Policy Updates for Email-Only Users ──────────────────────────────
-- Current RLS: auth.uid() = user_id (fails when user_id IS NULL for email-only intake)
-- Fix: Also allow access when user's JWT email matches client_email.
-- This covers the gap between intake (no user_id) and dashboard linking.

-- Drop and recreate reports SELECT policy
DROP POLICY IF EXISTS "Users can view their own reports" ON reports;

CREATE POLICY "Users can view their own reports"
  ON reports FOR SELECT
  USING (
    auth.uid() = user_id 
    OR (
      user_id IS NULL 
      AND client_email IS NOT NULL 
      AND (auth.jwt() ->> 'email') = client_email
    )
  );

-- Drop and recreate reports UPDATE policy (if exists)
DROP POLICY IF EXISTS "Users can update their own reports" ON reports;

CREATE POLICY "Users can update their own reports"
  ON reports FOR UPDATE
  USING (
    auth.uid() = user_id 
    OR (
      user_id IS NULL 
      AND client_email IS NOT NULL 
      AND (auth.jwt() ->> 'email') = client_email
    )
  );

-- Fix photos RLS for email-only users
DROP POLICY IF EXISTS "Users can upload and view their own photos" ON photos;

CREATE POLICY "Users can upload and view their own photos"
  ON photos FOR ALL
  USING (
    auth.uid() = (SELECT user_id FROM reports WHERE id = report_id)
    OR (
      (SELECT user_id FROM reports WHERE id = report_id) IS NULL
      AND (auth.jwt() ->> 'email') = (SELECT client_email FROM reports WHERE id = report_id)
    )
  );
