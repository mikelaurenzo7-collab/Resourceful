-- ============================================================================
-- Calibration System — Stores blind-test results and learned adjustment params
-- ============================================================================
-- Allows admin to feed known appraisals, compare against system output,
-- and statistically derive calibrated adjustment multipliers that improve
-- future valuations.

-- ============================================================
-- CALIBRATION_ENTRIES
-- ============================================================
-- Each row is one blind test: system's concluded value vs actual appraised value.
create table calibration_entries (
  id                      uuid primary key default uuid_generate_v4(),

  -- Property identification
  property_address        text not null,
  city                    text,
  state                   text,
  county                  text,
  county_fips             text,
  property_type           property_type_enum not null,

  -- Subject characteristics (from ATTOM at time of test)
  building_sqft           numeric(10, 2),
  lot_size_sqft           numeric(12, 2),
  year_built              integer,

  -- System output
  system_concluded_value  integer not null,
  comp_count              integer,
  median_adjusted_psf     numeric(10, 2),

  -- Actual value (entered by admin after blind test)
  actual_appraised_value  integer,

  -- Computed variance
  variance_dollars        integer,         -- actual - system
  variance_pct            numeric(6, 2),   -- (actual - system) / actual * 100

  -- Adjustment breakdown snapshot (averages across comps used)
  avg_adj_size            numeric(6, 2),
  avg_adj_condition       numeric(6, 2),
  avg_adj_market_trends   numeric(6, 2),
  avg_adj_land_ratio      numeric(6, 2),
  avg_net_adjustment      numeric(6, 2),

  -- Measurement calibration (optional — from appraisal field measurements)
  actual_building_sqft    numeric(10, 2),
  actual_lot_sqft         numeric(12, 2),
  attom_building_sqft     numeric(10, 2),
  attom_lot_sqft          numeric(12, 2),
  sqft_variance_pct       numeric(6, 2),   -- (attom - actual) / actual * 100

  -- Linked report (null for blind valuations, set for bulk imports)
  source_report_id        uuid references reports(id) on delete set null,

  -- Metadata
  status                  text not null default 'pending',  -- 'pending' | 'completed'
  notes                   text,
  submitted_by            uuid references users(id),
  created_at              timestamptz default now() not null,
  completed_at            timestamptz
);

alter table calibration_entries enable row level security;
create policy "No direct client access" on calibration_entries using (false);

create index idx_calibration_entries_property_type on calibration_entries(property_type);
create index idx_calibration_entries_county on calibration_entries(county_fips);
create index idx_calibration_entries_status on calibration_entries(status);

-- ============================================================
-- CALIBRATION_PARAMS
-- ============================================================
-- Learned adjustment multipliers derived from completed calibration entries.
-- Loaded by the pipeline to override hardcoded defaults.
create table calibration_params (
  id                        uuid primary key default uuid_generate_v4(),

  -- Scope: property_type is required; county_fips null = global for that type
  property_type             property_type_enum not null,
  county_fips               text,

  -- Adjustment multipliers (1.0 = no change from hardcoded default)
  size_multiplier           numeric(4, 2) not null default 1.0,
  condition_multiplier      numeric(4, 2) not null default 1.0,
  market_trend_multiplier   numeric(4, 2) not null default 1.0,
  land_ratio_multiplier     numeric(4, 2) not null default 1.0,

  -- Overall value bias correction
  -- Positive = system overvalues (apply downward), negative = system undervalues
  value_bias_pct            numeric(6, 2) not null default 0.0,

  -- Measurement correction factor
  -- e.g. 1.04 means ATTOM overreports sqft by 4%; divide ATTOM sqft by this
  sqft_correction_factor    numeric(5, 3) not null default 1.000,
  sqft_sample_size          integer not null default 0,

  -- Accuracy stats
  sample_size               integer not null default 0,
  mean_absolute_error_pct   numeric(6, 2),
  median_error_pct          numeric(6, 2),

  -- Metadata
  last_computed_at          timestamptz default now() not null,
  created_at                timestamptz default now() not null
);

alter table calibration_params enable row level security;
create policy "No direct client access" on calibration_params using (false);

-- Ensure one row per (property_type, county) scope
create unique index idx_calibration_params_scope
  on calibration_params(property_type, coalesce(county_fips, '__global__'));
