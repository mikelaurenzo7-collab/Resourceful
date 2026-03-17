-- ============================================================================
-- Property Intelligence Platform — Initial Schema Migration
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Custom Enum Types
-- --------------------------------------------------------------------------

CREATE TYPE report_status AS ENUM (
  'intake',
  'paid',
  'data_pull',
  'photo_pending',
  'processing',
  'pending_approval',
  'approved',
  'delivered',
  'rejected',
  'failed'
);

CREATE TYPE service_type AS ENUM (
  'tax_appeal',
  'pre_purchase',
  'pre_listing'
);

CREATE TYPE property_type AS ENUM (
  'residential',
  'commercial',
  'industrial',
  'land'
);

CREATE TYPE assessment_methodology AS ENUM (
  'fractional',
  'full_value'
);

CREATE TYPE photo_type AS ENUM (
  'front_exterior',
  'rear_exterior',
  'left_exterior',
  'right_exterior',
  'street_view',
  'aerial',
  'kitchen',
  'living_room',
  'master_bedroom',
  'bathroom',
  'basement',
  'garage',
  'roof',
  'foundation',
  'hvac',
  'electrical_panel',
  'plumbing',
  'lot_overview',
  'deferred_maintenance',
  'other'
);

CREATE TYPE hearing_format AS ENUM (
  'in_person',
  'virtual',
  'both',
  'written_only'
);

CREATE TYPE approval_action AS ENUM (
  'approved',
  'rejected',
  'regenerate_section',
  'edit_section',
  'rerun_pipeline'
);

CREATE TYPE assessed_value_source AS ENUM (
  'county_api',
  'attom'
);

CREATE TYPE measurement_source AS ENUM (
  'google_earth',
  'user_submitted',
  'attom',
  'county'
);

CREATE TYPE lease_type AS ENUM (
  'NNN',
  'Gross',
  'Modified Gross'
);

-- --------------------------------------------------------------------------
-- 2. Tables
-- --------------------------------------------------------------------------

-- users
CREATE TABLE users (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       text,
  email           text        UNIQUE,
  phone           text,
  stripe_customer_id text,
  created_at      timestamptz DEFAULT now()
);

-- admin_users (defined before reports because reports references it)
CREATE TABLE admin_users (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        UNIQUE REFERENCES auth.users (id) ON DELETE SET NULL,
  email           text        NOT NULL,
  name            text,
  is_super_admin  boolean     DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

-- reports
CREATE TABLE reports (
  id                            uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       uuid            REFERENCES users (id) ON DELETE SET NULL,
  service_type                  service_type,
  property_type                 property_type,
  status                        report_status   DEFAULT 'intake',
  property_address              text            NOT NULL,
  city                          text,
  state                         text,
  county                        text,
  county_fips                   text,
  latitude                      numeric,
  longitude                     numeric,
  pin                           text,
  report_pdf_storage_path       text,
  admin_notes                   text,
  stripe_payment_intent_id      text,
  payment_status                text,
  amount_paid_cents             integer,
  pipeline_last_completed_stage integer,
  pipeline_error_log            jsonb,
  created_at                    timestamptz     DEFAULT now(),
  pipeline_started_at           timestamptz,
  pipeline_completed_at         timestamptz,
  approved_at                   timestamptz,
  approved_by                   uuid            REFERENCES admin_users (id) ON DELETE SET NULL,
  delivered_at                  timestamptz
);

-- property_data
CREATE TABLE property_data (
  id                              uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id                       uuid                  UNIQUE NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
  assessed_value                  numeric,
  assessed_value_source           assessed_value_source,
  market_value_estimate_low       numeric,
  market_value_estimate_high      numeric,
  assessment_ratio                numeric,
  assessment_methodology          assessment_methodology,
  lot_size_sqft                   numeric,
  building_sqft_gross             numeric,
  building_sqft_living_area       numeric,
  year_built                      integer,
  property_class                  text,
  property_class_description      text,
  zoning_designation              text,
  zoning_ordinance_citation       text,
  zoning_conformance              text,
  flood_zone_designation          text,
  flood_map_panel_number          text,
  flood_map_panel_date            text,
  flood_map_panel_effective_date  text,
  flood_map_image_storage_path    text,
  zoning_map_image_storage_path   text,
  tax_year_in_appeal              integer,
  assessment_history              jsonb,
  deed_history                    jsonb,
  attom_raw_response              jsonb,
  county_assessor_raw_response    jsonb,
  fema_raw_response               jsonb,
  data_collection_notes           text
);

-- measurements
CREATE TABLE measurements (
  id                        uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id                 uuid                NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
  source                    measurement_source,
  north_wall_ft             numeric,
  south_wall_ft             numeric,
  east_wall_ft              numeric,
  west_wall_ft              numeric,
  calculated_footprint_sqft numeric,
  total_living_area_sqft    numeric,
  garage_sqft               numeric,
  basement_sqft             numeric,
  basement_finished_sqft    numeric,
  lot_dimensions_description text,
  attom_gba_sqft            numeric,
  discrepancy_flagged       boolean             DEFAULT false,
  discrepancy_pct           real,
  notes                     text,
  created_at                timestamptz         DEFAULT now()
);

-- photos
CREATE TABLE photos (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       uuid        NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
  storage_path    text        NOT NULL,
  photo_type      photo_type,
  ai_analysis     jsonb,
  caption         text,
  sort_order      integer,
  uploaded_at     timestamptz DEFAULT now()
);

-- comparable_sales
CREATE TABLE comparable_sales (
  id                                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id                           uuid    NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
  address                             text,
  sale_price                          numeric,
  sale_date                           date,
  grantor                             text,
  grantee                             text,
  deed_document_number                text,
  county_recorder_url                 text,
  building_sqft                       numeric,
  price_per_sqft                      numeric,
  year_built                          integer,
  property_class                      text,
  distance_miles                      numeric,
  lot_size_sqft                       numeric,
  land_to_building_ratio              numeric,
  overhead_door_count                 integer,
  clearance_height_ft                 numeric,
  condition_notes                     text,
  adjustment_pct_property_rights      numeric DEFAULT 0,
  adjustment_pct_financing_terms      numeric DEFAULT 0,
  adjustment_pct_conditions_of_sale   numeric DEFAULT 0,
  adjustment_pct_market_trends        numeric DEFAULT 0,
  adjustment_pct_location             numeric DEFAULT 0,
  adjustment_pct_size                 numeric DEFAULT 0,
  adjustment_pct_land_to_building     numeric DEFAULT 0,
  adjustment_pct_condition            numeric DEFAULT 0,
  adjustment_pct_other                numeric DEFAULT 0,
  net_adjustment_pct                  numeric DEFAULT 0,
  adjusted_price_per_sqft             numeric,
  is_weak_comparable                  boolean DEFAULT false,
  comparable_photo_storage_path       text
);

-- comparable_rentals
CREATE TABLE comparable_rentals (
  id                            uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id                     uuid       NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
  address                       text,
  lease_date                    date,
  pin                           text,
  building_sqft_leased          numeric,
  rent_per_sqft_yr              numeric,
  lease_type                    lease_type,
  tenant_pays_description       text,
  adjustment_notes              text,
  effective_net_rent_per_sqft   numeric
);

-- income_analysis (report_id is both PK and FK)
CREATE TABLE income_analysis (
  report_id                         uuid    PRIMARY KEY REFERENCES reports (id) ON DELETE CASCADE,
  concluded_market_rent_per_sqft_yr numeric,
  potential_gross_income            numeric,
  vacancy_rate_pct                  numeric,
  vacancy_amount                    numeric,
  effective_gross_income            numeric,
  expense_nnn_during_vacancy        numeric,
  expense_legal_professional        numeric,
  expense_utilities_common          numeric,
  expense_reserves                  numeric,
  expense_repairs_maintenance       numeric,
  total_expenses                    numeric,
  net_operating_income              numeric,
  expense_ratio_pct                 numeric,
  market_vacancy_rate_source        text,
  cap_rate_market_low               numeric,
  cap_rate_market_high              numeric,
  cap_rate_investor_survey_avg      numeric,
  concluded_cap_rate                numeric,
  capitalized_value                 numeric,
  concluded_value_income_approach   numeric,
  investor_survey_reference         text
);

-- report_narratives
CREATE TABLE report_narratives (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id             uuid        NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
  section_name          text        NOT NULL,
  content               text,
  generated_at          timestamptz DEFAULT now(),
  model_used            text,
  prompt_tokens         integer,
  completion_tokens     integer,
  generation_duration_ms integer,
  admin_edited          boolean     DEFAULT false,
  admin_edited_content  text
);

-- county_rules
CREATE TABLE county_rules (
  county_fips                     text                    PRIMARY KEY,
  county_name                     text                    NOT NULL,
  state_name                      text                    NOT NULL,
  state_abbreviation              text                    NOT NULL CHECK (char_length(state_abbreviation) = 2),
  assessment_ratio_residential    numeric,
  assessment_ratio_commercial     numeric,
  assessment_ratio_industrial     numeric,
  assessment_methodology          assessment_methodology,
  assessment_methodology_notes    text,
  appeal_board_name               text,
  appeal_board_address            text,
  appeal_board_phone              text,
  portal_url                      text,
  filing_email                    text,
  accepts_online_filing           boolean                 DEFAULT false,
  accepts_email_filing            boolean                 DEFAULT false,
  requires_mail_filing            boolean                 DEFAULT true,
  state_appeal_board_name         text,
  state_appeal_board_url          text,
  appeal_deadline_rule            text,
  tax_year_appeal_window          text,
  typical_resolution_weeks_min    integer,
  typical_resolution_weeks_max    integer,
  hearing_typically_required      boolean                 DEFAULT false,
  hearing_format                  hearing_format,
  appeal_form_name                text,
  form_download_url               text,
  evidence_requirements           jsonb,
  filing_fee_cents                integer                 DEFAULT 0,
  filing_fee_notes                text,
  assessor_api_url                text,
  assessor_api_documentation_url  text,
  assessor_api_notes              text,
  pro_se_tips                     text,
  is_active                       boolean                 DEFAULT false,
  last_verified_date              date,
  verified_by                     text,
  notes                           text
);

-- approval_events
CREATE TABLE approval_events (
  id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       uuid            NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
  admin_user_id   uuid            REFERENCES admin_users (id) ON DELETE SET NULL,
  action          approval_action NOT NULL,
  section_name    text,
  notes           text,
  created_at      timestamptz     DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 3. Indexes
-- --------------------------------------------------------------------------

-- reports
CREATE INDEX idx_reports_user_id   ON reports (user_id);
CREATE INDEX idx_reports_status    ON reports (status);
CREATE INDEX idx_reports_county_fips ON reports (county_fips);
CREATE INDEX idx_reports_created_at ON reports (created_at);
CREATE INDEX idx_reports_approved_by ON reports (approved_by);

-- property_data
CREATE INDEX idx_property_data_report_id ON property_data (report_id);

-- measurements
CREATE INDEX idx_measurements_report_id ON measurements (report_id);

-- photos
CREATE INDEX idx_photos_report_id   ON photos (report_id);
CREATE INDEX idx_photos_photo_type  ON photos (photo_type);

-- comparable_sales
CREATE INDEX idx_comparable_sales_report_id ON comparable_sales (report_id);

-- comparable_rentals
CREATE INDEX idx_comparable_rentals_report_id ON comparable_rentals (report_id);

-- report_narratives
CREATE INDEX idx_report_narratives_report_id ON report_narratives (report_id);
CREATE INDEX idx_report_narratives_section   ON report_narratives (section_name);

-- approval_events
CREATE INDEX idx_approval_events_report_id    ON approval_events (report_id);
CREATE INDEX idx_approval_events_admin_user_id ON approval_events (admin_user_id);

-- county_rules
CREATE INDEX idx_county_rules_state           ON county_rules (state_abbreviation);
CREATE INDEX idx_county_rules_active          ON county_rules (is_active);

-- --------------------------------------------------------------------------
-- 4. Row Level Security
-- --------------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_data      ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparable_sales   ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparable_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_analysis    ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_narratives  ENABLE ROW LEVEL SECURITY;
ALTER TABLE county_rules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_events    ENABLE ROW LEVEL SECURITY;

-- ---- users ----
CREATE POLICY users_select_own ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY users_update_own ON users
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY users_service_role ON users
  FOR ALL USING (auth.role() = 'service_role');

-- ---- reports ----
CREATE POLICY reports_select_own ON reports
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY reports_insert_own ON reports
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY reports_service_role ON reports
  FOR ALL USING (auth.role() = 'service_role');

-- ---- property_data ----
CREATE POLICY property_data_select_own ON property_data
  FOR SELECT USING (
    report_id IN (SELECT id FROM reports WHERE user_id = auth.uid())
  );

CREATE POLICY property_data_service_role ON property_data
  FOR ALL USING (auth.role() = 'service_role');

-- ---- measurements ----
CREATE POLICY measurements_select_own ON measurements
  FOR SELECT USING (
    report_id IN (SELECT id FROM reports WHERE user_id = auth.uid())
  );

CREATE POLICY measurements_service_role ON measurements
  FOR ALL USING (auth.role() = 'service_role');

-- ---- photos ----
CREATE POLICY photos_select_own ON photos
  FOR SELECT USING (
    report_id IN (SELECT id FROM reports WHERE user_id = auth.uid())
  );

CREATE POLICY photos_insert_own ON photos
  FOR INSERT WITH CHECK (
    report_id IN (SELECT id FROM reports WHERE user_id = auth.uid())
  );

CREATE POLICY photos_service_role ON photos
  FOR ALL USING (auth.role() = 'service_role');

-- ---- comparable_sales ----
CREATE POLICY comparable_sales_select_own ON comparable_sales
  FOR SELECT USING (
    report_id IN (SELECT id FROM reports WHERE user_id = auth.uid())
  );

CREATE POLICY comparable_sales_service_role ON comparable_sales
  FOR ALL USING (auth.role() = 'service_role');

-- ---- comparable_rentals ----
CREATE POLICY comparable_rentals_select_own ON comparable_rentals
  FOR SELECT USING (
    report_id IN (SELECT id FROM reports WHERE user_id = auth.uid())
  );

CREATE POLICY comparable_rentals_service_role ON comparable_rentals
  FOR ALL USING (auth.role() = 'service_role');

-- ---- income_analysis ----
CREATE POLICY income_analysis_select_own ON income_analysis
  FOR SELECT USING (
    report_id IN (SELECT id FROM reports WHERE user_id = auth.uid())
  );

CREATE POLICY income_analysis_service_role ON income_analysis
  FOR ALL USING (auth.role() = 'service_role');

-- ---- report_narratives ----
CREATE POLICY report_narratives_select_own ON report_narratives
  FOR SELECT USING (
    report_id IN (SELECT id FROM reports WHERE user_id = auth.uid())
  );

CREATE POLICY report_narratives_service_role ON report_narratives
  FOR ALL USING (auth.role() = 'service_role');

-- ---- county_rules ----
CREATE POLICY county_rules_select_active ON county_rules
  FOR SELECT USING (is_active = true);

CREATE POLICY county_rules_service_role ON county_rules
  FOR ALL USING (auth.role() = 'service_role');

-- ---- admin_users ----
CREATE POLICY admin_users_service_role ON admin_users
  FOR ALL USING (auth.role() = 'service_role');

-- ---- approval_events ----
CREATE POLICY approval_events_service_role ON approval_events
  FOR ALL USING (auth.role() = 'service_role');

-- --------------------------------------------------------------------------
-- 5. Seed Data — Cook County, Illinois
-- --------------------------------------------------------------------------

INSERT INTO county_rules (
  county_fips,
  county_name,
  state_name,
  state_abbreviation,
  assessment_ratio_residential,
  assessment_ratio_commercial,
  assessment_ratio_industrial,
  assessment_methodology,
  assessment_methodology_notes,
  appeal_board_name,
  appeal_board_address,
  appeal_board_phone,
  portal_url,
  filing_email,
  accepts_online_filing,
  accepts_email_filing,
  requires_mail_filing,
  state_appeal_board_name,
  state_appeal_board_url,
  appeal_deadline_rule,
  tax_year_appeal_window,
  typical_resolution_weeks_min,
  typical_resolution_weeks_max,
  hearing_typically_required,
  hearing_format,
  appeal_form_name,
  form_download_url,
  evidence_requirements,
  filing_fee_cents,
  filing_fee_notes,
  assessor_api_url,
  assessor_api_documentation_url,
  assessor_api_notes,
  pro_se_tips,
  is_active,
  last_verified_date,
  verified_by,
  notes
) VALUES (
  '17031',
  'Cook County',
  'Illinois',
  'IL',
  0.10,
  0.25,
  0.25,
  'fractional',
  'Cook County uses a fractional assessment system. Residential is assessed at 10% of market value. Commercial and industrial properties at 25% of market value. Class 5b incentive properties may have reduced levels.',
  'Cook County Board of Review',
  '118 N. Clark Street, Room 601, Chicago, IL 60602',
  '(312) 603-5542',
  'https://www.cookcountyboardofreview.com',
  NULL,
  true,
  false,
  false,
  'Illinois Property Tax Appeal Board (PTAB)',
  'https://www.ptab.illinois.gov',
  'Complaints must be filed within 30 days of the Board of Review publication date for the township.',
  'Appeals follow a triennial reassessment cycle. The reassessment year depends on the township location within Cook County (City of Chicago, North suburbs, South/West suburbs).',
  8,
  26,
  false,
  'both',
  'Complaint for Assessment Review',
  'https://www.cookcountyboardofreview.com/forms',
  '["Recent comparable sales within 1 mile and 12 months", "Property photographs (exterior and interior if applicable)", "Recent appraisal (if available)", "Description of property deficiencies or adverse conditions", "Income and expense data (commercial/industrial properties)", "Lease agreements (commercial/industrial properties)"]'::jsonb,
  0,
  'No filing fee for Board of Review complaints. PTAB appeals may have a filing fee based on assessed value.',
  'https://datacatalog.cookcountyil.gov/resource/',
  'https://datacatalog.cookcountyil.gov',
  'Cook County provides open data via the Socrata platform. Property assessment data, sales, and appeals data are publicly available.',
  'Focus on comparable sales evidence. The Board of Review gives significant weight to recent arm''s-length transactions of similar properties. Include at least 3-5 comparable sales. Highlight any property condition issues with photographs. For commercial properties, provide income/expense analysis.',
  true,
  '2026-01-15',
  'system',
  'Cook County is the largest property tax jurisdiction in Illinois. It operates on a triennial reassessment cycle divided into three regions: City of Chicago, north suburbs, and south/west suburbs.'
);
