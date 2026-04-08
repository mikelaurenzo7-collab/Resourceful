-- ============================================================================
-- Migration 020: Agricultural Property Type + Calibration Wiring
-- ============================================================================
-- Adds 'agricultural' to the property_type_enum for farm/ranch/cropland support.
-- Also adds an assessment_ratio_agricultural column to county_rules.

-- Add agricultural to property type enum
ALTER TYPE property_type_enum ADD VALUE IF NOT EXISTS 'agricultural';

-- Add agricultural assessment ratio to county_rules
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS assessment_ratio_agricultural numeric(5,4);
