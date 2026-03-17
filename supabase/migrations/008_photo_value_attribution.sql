-- ─── 008: Photo Value Attribution ────────────────────────────────────────────
-- Track exactly how much of the concluded value difference came from
-- photographic evidence vs market data. This is critical for:
-- 1. Proving the ROI of user-submitted photos
-- 2. Training the calibration system to isolate condition-based impacts
-- 3. Showing the homeowner how their photos strengthened the case

-- Value attribution fields on property_data
ALTER TABLE property_data
  ADD COLUMN IF NOT EXISTS concluded_value                  integer,
  ADD COLUMN IF NOT EXISTS concluded_value_without_photos   integer,
  ADD COLUMN IF NOT EXISTS photo_impact_dollars             integer,
  ADD COLUMN IF NOT EXISTS photo_impact_pct                 numeric(5,2),
  ADD COLUMN IF NOT EXISTS photo_condition_adjustment_pct   numeric(5,2),
  ADD COLUMN IF NOT EXISTS photo_defect_count               integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS photo_defect_count_significant   integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS photo_count                      integer DEFAULT 0;

-- Index for analytics: find reports where photos had the biggest impact
CREATE INDEX IF NOT EXISTS idx_property_data_photo_impact
  ON property_data (photo_impact_pct DESC NULLS LAST)
  WHERE photo_impact_dollars IS NOT NULL;

COMMENT ON COLUMN property_data.concluded_value IS 'Final concluded market value (with all adjustments including photo condition)';
COMMENT ON COLUMN property_data.concluded_value_without_photos IS 'Concluded value using only market data — no photo condition adjustments';
COMMENT ON COLUMN property_data.photo_impact_dollars IS 'Dollar difference: concluded_value_without_photos - concluded_value (positive = photos lowered the value, helping the appeal)';
COMMENT ON COLUMN property_data.photo_impact_pct IS 'Percentage impact of photos on concluded value';
COMMENT ON COLUMN property_data.photo_condition_adjustment_pct IS 'The aggregate condition adjustment percentage derived from photo defects (from stage4)';
COMMENT ON COLUMN property_data.photo_defect_count IS 'Total defects documented across all photos';
COMMENT ON COLUMN property_data.photo_defect_count_significant IS 'Defects with severity=significant';
COMMENT ON COLUMN property_data.photo_count IS 'Number of photos analyzed';
