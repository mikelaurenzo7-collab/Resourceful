-- ============================================================================
-- Migration 021: Performance Indexes
-- ============================================================================
-- Adds indexes for common query patterns identified during audit.

-- Speed up lookups by client email (dashboard, concurrency checks)
CREATE INDEX IF NOT EXISTS idx_reports_client_email ON reports (client_email);

-- Speed up county-level outcome aggregations (calibration, county stats)
CREATE INDEX IF NOT EXISTS idx_reports_county_fips_outcome
  ON reports (county_fips)
  WHERE outcome_reported_at IS NOT NULL;
