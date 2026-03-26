-- ─── Migration 011: Auto-Filing Support ─────────────────────────────────────
-- Extends filing_status to support 'auto_filed' — set when the platform
-- automatically submits the appeal on the client's behalf (email-filing counties).
-- Reuses existing filed_at and filing_method columns from migration 004.

-- ── Extend filing_status CHECK constraint ──
-- Drop and re-create with 'auto_filed' added.
-- 'auto_filed': platform sent the appeal email to the county on behalf of the client

ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_filing_status_check;
ALTER TABLE reports ADD CONSTRAINT reports_filing_status_check
  CHECK (filing_status IN (
    'not_started',
    'guided',
    'filed',
    'auto_filed',
    'hearing_scheduled',
    'resolved_win',
    'resolved_loss',
    'refund_requested',
    'refund_approved'
  ));

-- ── Informal review tracking ──
-- Flag set when Stage 6 determines the county offers informal desk review
-- and generates the informal review request section. Lets the admin dashboard
-- surface these cases for follow-up coaching.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS informal_review_recommended boolean DEFAULT false;

-- ── Auto-filing email ID ──
-- Resend email ID for the auto-filed appeal email. Enables delivery verification
-- and admin resend capability.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS auto_filing_resend_id text;
