-- ============================================================================
-- Migration 014: Fix enum consistency issues found in audit
-- ============================================================================

-- ── Fix review_tier enum (missing values) ─────────────────────────────────
-- Migration 006 only created 'auto' and 'expert_reviewed'.
-- Code expects all 4 tiers. Add the missing values.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'guided_filing' AND enumtypid = 'review_tier'::regtype) THEN
    ALTER TYPE review_tier ADD VALUE 'guided_filing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'full_representation' AND enumtypid = 'review_tier'::regtype) THEN
    ALTER TYPE review_tier ADD VALUE 'full_representation';
  END IF;
EXCEPTION WHEN undefined_object THEN
  -- review_tier type doesn't exist as an enum (may be text column)
  NULL;
END $$;

-- ── Fix filing_status values ──────────────────────────────────────────────
-- Migration 004 used a CHECK constraint with old values.
-- The filing service now uses: not_started, ready_to_file, guided_ready, filed
-- Drop old constraint and add updated one.
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_filing_status_check;
ALTER TABLE reports ADD CONSTRAINT reports_filing_status_check
  CHECK (filing_status IS NULL OR filing_status IN (
    'not_started',
    'ready_to_file',
    'guided_ready',
    'filed',
    'hearing_scheduled',
    'resolved_win',
    'resolved_loss',
    'withdrawn'
  ));
