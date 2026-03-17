-- ============================================================
-- 004: Enhanced county filing details
-- Adds detailed filing schedule fields, representation rules,
-- and report-level filing tracking for county-specific guidance.
-- ============================================================

-- ── New county_rules columns for filing schedules and rules ──

-- Assessment cycle and filing schedule
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS assessment_cycle text;
  -- e.g., 'annual', 'biennial', 'triennial'
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS assessment_notices_mailed text;
  -- e.g., 'February 1', 'Within 30 days of reassessment'
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS appeal_window_days integer;
  -- Number of days after notice mailed to file appeal
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS appeal_window_start_month integer;
  -- Month (1-12) when appeal window typically opens
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS appeal_window_end_month integer;
  -- Month (1-12) when appeal window typically closes
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS appeal_window_end_day integer;
  -- Day of month when window closes (if fixed date)
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS next_appeal_deadline date;
  -- The actual next deadline (manually updated or calculated)
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS current_tax_year integer;
  -- The tax year currently open for appeal

-- Filing steps and requirements
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS filing_steps jsonb;
  -- Ordered array of {step_number, title, description, url?, form_name?}
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS required_documents text[];
  -- e.g., ['Appeal form', 'Comparable sales evidence', 'Property photos']
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS informal_review_available boolean DEFAULT false;
  -- Whether county offers informal review before formal appeal
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS informal_review_notes text;
  -- How to request informal review

-- Hearing details
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS hearing_duration_minutes integer;
  -- Typical hearing length (e.g., 10, 15, 30)
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS hearing_scheduling_notes text;
  -- e.g., 'Hearing scheduled within 30 days of filing'
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS virtual_hearing_available boolean DEFAULT false;
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS virtual_hearing_platform text;
  -- e.g., 'Zoom', 'WebEx', 'Microsoft Teams'

-- Representation rules
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS authorized_rep_allowed boolean;
  -- Can non-attorneys represent property owners?
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS authorized_rep_form_url text;
  -- URL to download agent/POA form
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS authorized_rep_types text[];
  -- e.g., ['attorney','appraiser','tax_consultant','cpa']
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS rep_restrictions_notes text;
  -- e.g., 'Entities must use attorneys'

-- Further appeal / escalation
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS further_appeal_body text;
  -- e.g., 'Property Tax Appeal Board (PTAB)'
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS further_appeal_deadline_rule text;
  -- e.g., '30 days after Board of Review decision'
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS further_appeal_url text;
ALTER TABLE county_rules ADD COLUMN IF NOT EXISTS further_appeal_fee_cents integer DEFAULT 0;

-- ── Filing status tracking on reports ──

ALTER TABLE reports ADD COLUMN IF NOT EXISTS filing_status text DEFAULT 'not_started'
  CHECK (filing_status IN (
    'not_started',
    'guided',
    'filed',
    'hearing_scheduled',
    'resolved_win',
    'resolved_loss',
    'refund_requested',
    'refund_approved'
  ));
ALTER TABLE reports ADD COLUMN IF NOT EXISTS filed_at timestamptz;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS filing_method text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS appeal_outcome text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS savings_amount_cents integer;

-- Index for finding reports by filing status (admin analytics)
CREATE INDEX IF NOT EXISTS idx_reports_filing_status ON reports(filing_status) WHERE filing_status != 'not_started';
