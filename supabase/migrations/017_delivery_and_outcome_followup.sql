-- ─── Migration 017: Dashboard-First Delivery & Outcome Follow-Up ────────────
--
-- Changes the delivery model from email-with-signed-URL to dashboard-first:
-- - Reports are always accessible from the user's dashboard/report page
-- - Email becomes an optional notification (user can opt out)
-- - PDF downloads generate fresh signed URLs on-demand (no 7-day expiry)
--
-- Adds outcome follow-up infrastructure for the calibration feedback loop:
-- - Follow-up emails sent ~60 days after delivery asking "How did your appeal go?"
-- - Unique tokens allow unauthenticated outcome submission via email links
-- - Outcomes feed the calibration system for accuracy improvement

-- ── Report table additions ──────────────────────────────────────────────────

-- Email preference: user can opt out of delivery notification email
-- Default true — most users want the email nudge
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS email_delivery_preference boolean NOT NULL DEFAULT true;

-- Outcome follow-up tracking
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS outcome_followup_sent_at timestamptz;

-- Unique token for unauthenticated outcome submission via email link
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS outcome_followup_token text UNIQUE;

-- Index for the outcome follow-up cron query:
-- finds delivered tax_appeal reports needing follow-up
CREATE INDEX IF NOT EXISTS idx_reports_outcome_followup
  ON reports (delivered_at)
  WHERE status = 'delivered'
    AND service_type = 'tax_appeal'
    AND outcome_reported_at IS NULL
    AND outcome_followup_sent_at IS NULL;

-- Index for token-based outcome lookups
CREATE INDEX IF NOT EXISTS idx_reports_outcome_token
  ON reports (outcome_followup_token)
  WHERE outcome_followup_token IS NOT NULL;
