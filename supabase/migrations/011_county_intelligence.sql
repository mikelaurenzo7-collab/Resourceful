-- County intelligence upgrades for 10/10 appeal strategy
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS board_personality_notes text;
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS winning_argument_patterns text;
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS common_assessor_errors text;
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS success_rate_pct numeric(5,2);
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS success_rate_source text;
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS avg_savings_pct numeric(5,2);

-- Appeal outcome tracking on reports table
ALTER TABLE reports ADD COLUMN IF NOT EXISTS appeal_outcome_details jsonb;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS outcome_reported_at timestamptz;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS actual_savings_cents integer;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS outcome_notes text;
