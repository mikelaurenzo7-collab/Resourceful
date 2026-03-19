-- Narrow platform to residential + land property types only.
-- Commercial and industrial support has been removed from the application.

-- Add CHECK constraint on reports to only allow residential and land
ALTER TABLE reports
  ADD CONSTRAINT chk_property_type_residential_land
    CHECK (property_type IN ('residential', 'land'));

-- Convert any existing commercial/industrial reports to residential (safety net)
UPDATE reports SET property_type = 'residential'
  WHERE property_type IN ('commercial', 'industrial');

-- Drop the commercial/industrial assessment ratio constraints (migration 012)
-- The columns remain in the DB but are no longer used by the application.
ALTER TABLE county_rules
  DROP CONSTRAINT IF EXISTS chk_assessment_ratio_commercial,
  DROP CONSTRAINT IF EXISTS chk_assessment_ratio_industrial;
