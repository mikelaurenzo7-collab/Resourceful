-- ─── Filing Enhancements Migration ─────────────────────────────────────────
-- Adds county winning strategies, common assessor errors, and hearing tracking
-- fields for the admin filing dashboard and full_representation tier workflow.

-- ── county_rules: strategy fields ──────────────────────────────────────────
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS winning_strategies text;
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS common_assessor_errors text;

-- ── reports: hearing tracking ──────────────────────────────────────────────
ALTER TABLE reports ADD COLUMN IF NOT EXISTS hearing_date timestamptz;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS hearing_notes text;
