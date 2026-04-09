-- ─── Migration 021: Abandoned Cart Recovery ──────────────────────────────────
-- Adds a column to track when recovery emails were sent for abandoned carts.
-- Reports with status='intake' and a stripe_payment_intent_id represent users
-- who started checkout but never completed payment — the recovery target.

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS recovery_email_sent_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN reports.recovery_email_sent_at IS 'Timestamp of abandoned-cart recovery email';
