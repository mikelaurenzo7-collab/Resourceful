-- Add CHECK constraint on county_rules assessment ratio columns.
-- Assessment ratios must be between 0 and 1 (e.g., 0.33 = 33%).
-- Invalid values silently corrupt all downstream valuation math.

ALTER TABLE county_rules
  ADD CONSTRAINT chk_assessment_ratio_residential
    CHECK (assessment_ratio_residential IS NULL OR (assessment_ratio_residential >= 0 AND assessment_ratio_residential <= 1)),
  ADD CONSTRAINT chk_assessment_ratio_commercial
    CHECK (assessment_ratio_commercial IS NULL OR (assessment_ratio_commercial >= 0 AND assessment_ratio_commercial <= 1)),
  ADD CONSTRAINT chk_assessment_ratio_industrial
    CHECK (assessment_ratio_industrial IS NULL OR (assessment_ratio_industrial >= 0 AND assessment_ratio_industrial <= 1));
