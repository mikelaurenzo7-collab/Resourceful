-- ============================================================================
-- Fix calibration_entries for outcome-based workflow
-- ============================================================================
-- Migration 005 designed calibration_entries for admin blind tests.
-- The actual usage is user-reported appeal outcomes via createCalibrationEntry().
-- This migration adds the missing columns so outcome data actually persists.

-- Make property_address nullable (outcome entries may not have it)
ALTER TABLE calibration_entries
  ALTER COLUMN property_address DROP NOT NULL;

-- Add outcome-based columns missing from the original schema
ALTER TABLE calibration_entries
  ADD COLUMN IF NOT EXISTS assessed_value         integer,
  ADD COLUMN IF NOT EXISTS actual_outcome         text,
  ADD COLUMN IF NOT EXISTS photo_count            integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS photo_defect_count     integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS case_strength_score    integer;

-- Index on actual_outcome for batch aggregation queries
CREATE INDEX IF NOT EXISTS idx_calibration_entries_outcome
  ON calibration_entries(actual_outcome);

-- ============================================================================
-- RPC for upserting calibration_params
-- ============================================================================
-- The unique index on calibration_params uses coalesce(county_fips, '__global__')
-- which prevents standard ON CONFLICT from working. This RPC handles the logic.
CREATE OR REPLACE FUNCTION upsert_calibration_params(
  p_property_type       text,
  p_county_fips         text DEFAULT NULL,
  p_value_bias_pct      numeric DEFAULT 0.0,
  p_mean_absolute_error_pct numeric DEFAULT NULL,
  p_median_error_pct    numeric DEFAULT NULL,
  p_sqft_correction_factor  numeric DEFAULT 1.000,
  p_sqft_sample_size    integer DEFAULT 0,
  p_sample_size         integer DEFAULT 0
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  -- Find existing row for this scope
  SELECT id INTO v_existing_id
  FROM calibration_params
  WHERE property_type = p_property_type::property_type_enum
    AND coalesce(county_fips, '__global__') = coalesce(p_county_fips, '__global__');

  IF v_existing_id IS NOT NULL THEN
    -- Update existing
    UPDATE calibration_params SET
      value_bias_pct = p_value_bias_pct,
      mean_absolute_error_pct = p_mean_absolute_error_pct,
      median_error_pct = p_median_error_pct,
      sqft_correction_factor = p_sqft_correction_factor,
      sqft_sample_size = p_sqft_sample_size,
      sample_size = p_sample_size,
      last_computed_at = now()
    WHERE id = v_existing_id;
  ELSE
    -- Insert new
    INSERT INTO calibration_params (
      property_type, county_fips,
      value_bias_pct, mean_absolute_error_pct, median_error_pct,
      sqft_correction_factor, sqft_sample_size, sample_size,
      last_computed_at
    ) VALUES (
      p_property_type::property_type_enum, p_county_fips,
      p_value_bias_pct, p_mean_absolute_error_pct, p_median_error_pct,
      p_sqft_correction_factor, p_sqft_sample_size, p_sample_size,
      now()
    );
  END IF;
END;
$$;
