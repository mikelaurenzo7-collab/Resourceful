-- ============================================================================
-- Property Intelligence Platform — Initial Schema Migration
-- ============================================================================
-- Allow the database to generate UUIDs automatically.
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS
-- ============================================================
create table users (
  id                  uuid primary key references auth.users(id)
                        on delete cascade,
  full_name           text,
  phone               text,
  stripe_customer_id  text unique,
  created_at          timestamptz default now() not null
);

alter table users enable row level security;
create policy "Users manage their own profile"
  on users for all using (auth.uid() = id);

-- ============================================================
-- REPORTS
-- ============================================================
create type service_type as enum (
  'tax_appeal', 'pre_purchase', 'pre_listing'
);

create type property_type_enum as enum (
  'residential', 'commercial', 'industrial', 'land'
);

create type report_status as enum (
  'intake',           -- address submitted, waiting for payment
  'paid',             -- payment confirmed, pipeline will start
  'data_pull',        -- pulling property info from APIs
  'photo_pending',    -- waiting for user to upload photos
  'processing',       -- AI analysis and report writing in progress
  'pending_approval', -- done — waiting for human to review
  'approved',         -- admin approved, delivery in progress
  'delivered',        -- report emailed to client successfully
  'rejected',         -- admin rejected, will not be sent
  'failed'            -- pipeline error, see error log
);

create table reports (
  id                             uuid primary key default uuid_generate_v4(),
  user_id                        uuid not null references users(id),
  service_type                   service_type not null,
  property_type                  property_type_enum not null,
  status                         report_status not null default 'intake',
  property_address               text not null,
  city                           text,
  state                          text,
  state_abbreviation             text,
  county                         text,
  county_fips                    text,
  latitude                       numeric(10, 7),
  longitude                      numeric(10, 7),
  pin                            text,
  report_pdf_storage_path        text,
  admin_notes                    text,
  stripe_payment_intent_id       text unique,
  payment_status                 text default 'pending',
  amount_paid_cents              integer,
  pipeline_last_completed_stage  text,
  pipeline_error_log             jsonb,
  created_at                     timestamptz default now() not null,
  pipeline_started_at            timestamptz,
  pipeline_completed_at          timestamptz,
  approved_at                    timestamptz,
  approved_by                    uuid references users(id),
  delivered_at                   timestamptz
);

alter table reports enable row level security;
create policy "Users can view their own reports"
  on reports for select using (auth.uid() = user_id);
create policy "Users can create reports"
  on reports for insert with check (auth.uid() = user_id);

create index idx_reports_user_id on reports(user_id);
create index idx_reports_status on reports(status);
create index idx_reports_county_fips on reports(county_fips);

-- ============================================================
-- PROPERTY_DATA
-- ============================================================
create table property_data (
  id                             uuid primary key default uuid_generate_v4(),
  report_id                      uuid not null unique references reports(id) on delete cascade,
  assessed_value                 integer,
  assessed_value_source          text,
  market_value_estimate_low      integer,
  market_value_estimate_high     integer,
  -- assessment_ratio and assessment_methodology come from county_rules.
  -- They are NEVER hardcoded. Cook County commercial = 0.25.
  -- Texas, California, most states = 1.00. This field drives all math.
  assessment_ratio               numeric(4, 3),
  assessment_methodology         text,
  lot_size_sqft                  numeric(12, 2),
  building_sqft_gross            numeric(10, 2),
  building_sqft_living_area      numeric(10, 2),
  year_built                     integer,
  effective_age                  integer,
  remaining_economic_life        integer,
  property_class                 text,
  property_class_description     text,
  construction_type              text,
  roof_type                      text,
  exterior_finish                text,
  foundation_type                text,
  hvac_type                      text,
  plumbing_description           text,
  sprinkler_system               boolean default false,
  number_of_stories              integer,
  bedroom_count                  integer,
  full_bath_count                integer,
  half_bath_count                integer,
  garage_sqft                    numeric(8, 2),
  garage_spaces                  integer,
  basement_sqft                  numeric(8, 2),
  basement_finished_sqft         numeric(8, 2),
  overhead_door_count            integer,
  dock_door_count                integer,
  clear_height_ft                numeric(5, 1),
  overall_condition              text,
  condition_notes                text,
  zoning_designation             text,
  zoning_ordinance_citation      text,
  zoning_conformance             text,
  flood_zone_designation         text,
  flood_map_panel_number         text,
  flood_map_panel_date           text,
  flood_map_image_storage_path   text,
  regional_map_url               text,
  neighborhood_map_url           text,
  parcel_map_url                 text,
  zoning_map_image_storage_path  text,
  tax_year_in_appeal             integer,
  assessment_history             jsonb,
  deed_history                   jsonb,
  attom_raw_response             jsonb,
  county_assessor_raw_response   jsonb,
  fema_raw_response              jsonb,
  data_collection_notes          text,
  created_at                     timestamptz default now() not null
);

alter table property_data enable row level security;
create policy "No direct client access" on property_data using (false);

-- ============================================================
-- MEASUREMENTS
-- ============================================================
create type measurement_source as enum (
  'google_earth', 'user_submitted', 'attom', 'county'
);

create table measurements (
  id                          uuid primary key default uuid_generate_v4(),
  report_id                   uuid not null references reports(id) on delete cascade,
  source                      measurement_source not null,
  north_wall_ft               numeric(8, 2),
  south_wall_ft               numeric(8, 2),
  east_wall_ft                numeric(8, 2),
  west_wall_ft                numeric(8, 2),
  calculated_footprint_sqft   numeric(10, 2),
  total_living_area_sqft      numeric(10, 2),
  garage_sqft                 numeric(8, 2),
  basement_sqft               numeric(8, 2),
  basement_finished_sqft      numeric(8, 2),
  lot_dimensions_description  text,
  attom_gba_sqft              numeric(10, 2),
  discrepancy_flagged         boolean default false,
  discrepancy_pct             numeric(5, 2),
  notes                       text,
  created_at                  timestamptz default now() not null
);

alter table measurements enable row level security;
create policy "No direct client access" on measurements using (false);

-- ============================================================
-- PHOTOS
-- ============================================================
create type photo_type as enum (
  'exterior_front', 'exterior_rear',
  'exterior_north', 'exterior_south', 'exterior_east', 'exterior_west',
  'parking_lot', 'driveway', 'yard_landscape', 'drainage', 'loading_area',
  'roof_condition', 'foundation_visible', 'deferred_maintenance', 'environmental_concern',
  'interior_main', 'interior_kitchen', 'interior_bathroom',
  'interior_bedroom', 'interior_living', 'interior_basement',
  'interior_garage', 'interior_warehouse', 'interior_office',
  'overhead_door', 'dock_door', 'clear_height', 'structural_detail',
  'aerial', 'other'
);

create table photos (
  id              uuid primary key default uuid_generate_v4(),
  report_id       uuid not null references reports(id) on delete cascade,
  storage_path    text not null,
  photo_type      photo_type,
  ai_analysis     jsonb,
  caption         text,
  sort_order      integer default 0,
  uploaded_at     timestamptz default now() not null
);

alter table photos enable row level security;
create policy "Users can upload and view their own photos"
  on photos for all
  using (auth.uid() = (select user_id from reports where id = report_id));

-- ============================================================
-- COMPARABLE_SALES
-- ============================================================
create table comparable_sales (
  id                                uuid primary key default uuid_generate_v4(),
  report_id                         uuid not null references reports(id) on delete cascade,
  address                           text not null,
  sale_price                        integer not null,
  sale_date                         date not null,
  grantor                           text,
  grantee                           text,
  deed_document_number              text,
  county_recorder_url               text,
  building_sqft                     numeric(10, 2),
  price_per_sqft                    numeric(8, 2),
  year_built                        integer,
  property_class                    text,
  lot_size_sqft                     numeric(12, 2),
  land_to_building_ratio            numeric(6, 2),
  overhead_door_count               integer,
  clearance_height_ft               numeric(5, 1),
  distance_miles                    numeric(5, 3),
  condition_notes                   text,
  -- Adjustment percentages.
  -- Positive = subject is better than comp (adjust up).
  -- Negative = comp is better than subject (adjust down).
  adjustment_pct_property_rights    numeric(5, 2) default 0,
  adjustment_pct_financing_terms    numeric(5, 2) default 0,
  adjustment_pct_conditions_of_sale numeric(5, 2) default 0,
  adjustment_pct_market_trends      numeric(5, 2) default 0,
  adjustment_pct_location           numeric(5, 2) default 0,
  adjustment_pct_size               numeric(5, 2) default 0,
  adjustment_pct_land_to_building   numeric(5, 2) default 0,
  adjustment_pct_condition          numeric(5, 2) default 0,
  adjustment_pct_other              numeric(5, 2) default 0,
  net_adjustment_pct                numeric(5, 2),
  adjusted_price_per_sqft           numeric(8, 2),
  is_weak_comparable                boolean default false,
  comparable_photo_url              text,
  created_at                        timestamptz default now() not null
);

alter table comparable_sales enable row level security;
create policy "No direct client access" on comparable_sales using (false);
create index idx_comparable_sales_report_id on comparable_sales(report_id);

-- ============================================================
-- COMPARABLE_RENTALS
-- ============================================================
create table comparable_rentals (
  id                          uuid primary key default uuid_generate_v4(),
  report_id                   uuid not null references reports(id) on delete cascade,
  address                     text,
  lease_date                  date,
  pin                         text,
  building_sqft_leased        numeric(10, 2),
  rent_per_sqft_yr            numeric(6, 2),
  lease_type                  text,
  tenant_pays_description     text,
  adjustment_notes            text,
  effective_net_rent_per_sqft numeric(6, 2),
  created_at                  timestamptz default now() not null
);

alter table comparable_rentals enable row level security;
create policy "No direct client access" on comparable_rentals using (false);

-- ============================================================
-- INCOME_ANALYSIS
-- ============================================================
create table income_analysis (
  id                                 uuid primary key default uuid_generate_v4(),
  report_id                          uuid not null unique references reports(id),
  concluded_market_rent_per_sqft_yr  numeric(6, 2),
  potential_gross_income             integer,
  vacancy_rate_pct                   numeric(5, 2),
  vacancy_amount                     integer,
  effective_gross_income             integer,
  expense_nnn_during_vacancy         integer,
  expense_legal_professional         integer,
  expense_utilities_common           integer,
  expense_reserves                   integer,
  expense_repairs_maintenance        integer,
  total_expenses                     integer,
  expense_ratio_pct                  numeric(5, 2),
  net_operating_income               integer,
  market_vacancy_rate_source         text,
  cap_rate_market_low                numeric(5, 3),
  cap_rate_market_high               numeric(5, 3),
  cap_rate_investor_survey_avg       numeric(5, 3),
  concluded_cap_rate                 numeric(5, 3),
  investor_survey_reference          text,
  capitalized_value                  integer,
  concluded_value_income_approach    integer,
  created_at                         timestamptz default now() not null
);

alter table income_analysis enable row level security;
create policy "No direct client access" on income_analysis using (false);

-- ============================================================
-- REPORT_NARRATIVES
-- ============================================================
create table report_narratives (
  id                     uuid primary key default uuid_generate_v4(),
  report_id              uuid not null references reports(id) on delete cascade,
  section_name           text not null,
  content                text not null,
  generated_at           timestamptz default now() not null,
  model_used             text,
  prompt_tokens          integer,
  completion_tokens      integer,
  generation_duration_ms integer,
  admin_edited           boolean default false,
  admin_edited_content   text,
  unique(report_id, section_name)
);

alter table report_narratives enable row level security;
create policy "No direct client access" on report_narratives using (false);

-- ============================================================
-- COUNTY_RULES
-- THE NATIONWIDE EXPANSION TABLE.
-- One row per county. To support a new county: add a row,
-- populate all fields with verified data, set is_active = true.
-- No code changes required. Ever.
-- ============================================================
create table county_rules (
  county_fips                     text primary key,
  county_name                     text not null,
  state_name                      text not null,
  state_abbreviation              text not null,
  -- Assessment ratios vary dramatically by state.
  -- Cook County IL residential: 0.10 (10% of market value)
  -- Cook County IL commercial:  0.25 (25% of market value)
  -- Texas, California, most states: 1.00 (100% full value)
  -- These drive all valuation calculations — never hardcode them.
  assessment_ratio_residential    numeric(4, 3) not null,
  assessment_ratio_commercial     numeric(4, 3) not null,
  assessment_ratio_industrial     numeric(4, 3) not null,
  assessment_methodology          text not null,
  assessment_methodology_notes    text,
  appeal_board_name               text not null,
  appeal_board_address            text,
  appeal_board_phone              text,
  portal_url                      text,
  filing_email                    text,
  accepts_online_filing           boolean default false,
  accepts_email_filing            boolean default false,
  requires_mail_filing            boolean default false,
  state_appeal_board_name         text,
  state_appeal_board_url          text,
  appeal_deadline_rule            text not null,
  tax_year_appeal_window          text,
  typical_resolution_weeks_min    integer,
  typical_resolution_weeks_max    integer,
  hearing_typically_required      boolean default false,
  hearing_format                  text,
  appeal_form_name                text,
  form_download_url               text,
  evidence_requirements           jsonb,
  filing_fee_cents                integer default 0,
  filing_fee_notes                text,
  assessor_api_url                text,
  assessor_api_documentation_url  text,
  assessor_api_notes              text,
  pro_se_tips                     text,
  is_active                       boolean default false,
  last_verified_date              date,
  verified_by                     text,
  notes                           text,
  created_at                      timestamptz default now() not null,
  updated_at                      timestamptz default now() not null
);

-- ============================================================
-- ADMIN_USERS
-- ============================================================
create table admin_users (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null unique references users(id),
  email           text not null,
  name            text,
  is_super_admin  boolean default false,
  created_at      timestamptz default now() not null
);

alter table admin_users enable row level security;
create policy "Admins can view admin table"
  on admin_users for select
  using (exists (select 1 from admin_users where user_id = auth.uid()));

-- ============================================================
-- APPROVAL_EVENTS
-- Append-only audit log. Never delete rows from this table.
-- ============================================================
create type approval_action as enum (
  'approved', 'rejected', 'edit_section',
  'regenerate_section', 'rerun_pipeline', 'hold_for_review'
);

create table approval_events (
  id              uuid primary key default uuid_generate_v4(),
  report_id       uuid not null references reports(id),
  admin_user_id   uuid not null references admin_users(id),
  action          approval_action not null,
  section_name    text,
  notes           text,
  created_at      timestamptz default now() not null
);

alter table approval_events enable row level security;
create policy "Admins can read and create approval events"
  on approval_events for all
  using (exists (select 1 from admin_users where user_id = auth.uid()));

create index idx_approval_events_report_id on approval_events(report_id);

-- ============================================================
-- Seed Cook County as the only active county at launch.
-- ============================================================
insert into county_rules (
  county_fips, county_name, state_name, state_abbreviation,
  assessment_ratio_residential, assessment_ratio_commercial,
  assessment_ratio_industrial, assessment_methodology,
  assessment_methodology_notes, appeal_board_name,
  appeal_board_address, appeal_board_phone, portal_url,
  accepts_online_filing, appeal_deadline_rule,
  tax_year_appeal_window, typical_resolution_weeks_min,
  typical_resolution_weeks_max, hearing_typically_required,
  hearing_format, appeal_form_name, form_download_url,
  filing_fee_cents, assessor_api_url, pro_se_tips,
  is_active, last_verified_date, verified_by
) values (
  '17031', 'Cook County', 'Illinois', 'IL',
  0.10, 0.25, 0.25, 'fractional',
  'Illinois uses fractional assessment. Residential at 10% of market value.
   Commercial and industrial at 25%. The assessed value is multiplied by the
   state equalizer to produce the Equalized Assessed Value (EAV).',
  'Cook County Board of Review',
  '118 N. Clark Street, Room 601, Chicago, IL 60602',
  '(312) 603-5542',
  'https://www.cookcountyboardofreview.com',
  true,
  'Appeals must be filed within 30 days of the township assessment notice.
   Notices are published by township on a rolling schedule. Check the CCBOR
   website for your specific township open period.',
  'Tax year 2024 assessments appealable in 2025 during township open period.',
  16, 52, false, 'written_only',
  'Residential Appeal Form BOR-1',
  'https://www.cookcountyboardofreview.com/forms',
  0,
  'https://datacatalog.cookcountyil.gov/resource/tx2p-k2g9.json',
  'File through the online portal. You need your 14-digit PIN (on your tax bill).
   Upload your appraisal report as a PDF. The portal issues a case number immediately.',
  true, '2025-01-01', 'platform-admin'
);
