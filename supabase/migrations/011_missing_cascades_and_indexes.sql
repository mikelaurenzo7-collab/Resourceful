-- Fix missing ON DELETE CASCADE for income_analysis and approval_events.
-- Without CASCADE, deleting a report with child rows will fail with FK violation.

-- income_analysis: drop and recreate FK with CASCADE
ALTER TABLE income_analysis
  DROP CONSTRAINT IF EXISTS income_analysis_report_id_fkey,
  ADD CONSTRAINT income_analysis_report_id_fkey
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE;

-- approval_events: drop and recreate FK with CASCADE
ALTER TABLE approval_events
  DROP CONSTRAINT IF EXISTS approval_events_report_id_fkey,
  ADD CONSTRAINT approval_events_report_id_fkey
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE;

-- Add missing index on comparable_rentals.report_id (all other child tables have it)
CREATE INDEX IF NOT EXISTS idx_comparable_rentals_report_id
  ON comparable_rentals(report_id);

-- Add missing index on calibration_entries.source_report_id (used in ON DELETE SET NULL)
CREATE INDEX IF NOT EXISTS idx_calibration_entries_source_report_id
  ON calibration_entries(source_report_id);
