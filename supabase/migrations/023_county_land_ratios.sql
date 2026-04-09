-- Migration 023: Per-county land ratio overrides
-- The global LAND_RATIO_BY_SUBTYPE constants in valuation.ts are national
-- medians and are wrong for high-density urban markets. Dense urban counties
-- (e.g. Cook County IL) typically have land at 40-60% of total value vs the
-- 20% national median. These nullable columns allow per-county overrides;
-- stage5 uses them when set, falls back to the national constants otherwise.

alter table county_rules
  add column if not exists land_ratio_residential numeric(4, 3),
  add column if not exists land_ratio_commercial numeric(4, 3),
  add column if not exists land_ratio_industrial numeric(4, 3);

comment on column county_rules.land_ratio_residential is
  'County-specific land-to-value ratio for residential (cost approach fallback). '
  'Overrides the national IAAO constant when set. Typical range 0.15–0.65.';

comment on column county_rules.land_ratio_commercial is
  'County-specific land-to-value ratio for commercial.';

comment on column county_rules.land_ratio_industrial is
  'County-specific land-to-value ratio for industrial.';

-- Seed known values for counties we have in the database.
-- Cook County, IL (FIPS 17031): Chicago urban core — land typically 40-55% of
-- total value per IAAO studies and Appraisal Institute market data.
-- Using 0.45 (conservative midpoint, defensible in appeal context).
update county_rules
set
  land_ratio_residential = 0.45,
  land_ratio_commercial  = 0.40,
  land_ratio_industrial  = 0.30
where county_fips = '17031';
