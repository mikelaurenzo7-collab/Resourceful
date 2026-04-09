-- ============================================================================
-- Migration 026: Notification Delivery Tracking + Retry Support
-- ============================================================================
-- Tracks whether the delivery notification email was successfully sent.
-- Enables a retry cron to catch failed sends — currently, if the email 
-- fails after 3 retries in sendWithRetry, the user is never notified.
--
-- Pattern mirrors outcome_followup_sent_at from migration 017.

-- Timestamp of successful notification email delivery
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz;

-- Index for retry cron: find delivered reports that were never notified
CREATE INDEX IF NOT EXISTS idx_reports_notification_pending
  ON reports (delivered_at)
  WHERE status = 'delivered'
    AND notification_sent_at IS NULL
    AND email_delivery_preference = true;
