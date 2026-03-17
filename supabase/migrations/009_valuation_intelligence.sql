-- ─── Migration 009: Valuation Intelligence ───────────────────────────────────
-- Adds fields to support IAAO-based depreciation, property subtype routing,
-- case strength scoring, two-way analysis, and arms-length comp screening.

-- ── property_data ─────────────────────────────────────────────────────────────

-- Resolved property subtype (e.g., 'residential_sfr', 'commercial_office')
-- Derived from ATTOM propertyClass in Stage 1.
ALTER TABLE property_data
  ADD COLUMN IF NOT EXISTS property_subtype text;

-- Physical depreciation as a percentage (0-90).
-- Computed from effective_age / economic_life for the building's subtype.
ALTER TABLE property_data
  ADD COLUMN IF NOT EXISTS physical_depreciation_pct numeric(5,2);

-- Source of the effective_age value.
-- 'year_built_baseline' = Stage 1 estimate from chronological age.
-- 'photo_adjusted' = Stage 4 refinement after photo condition is known.
ALTER TABLE property_data
  ADD COLUMN IF NOT EXISTS effective_age_source text;

-- ── reports ───────────────────────────────────────────────────────────────────

-- Case strength score (0-100). Computed in Stage 5.
-- Drives attorney network routing and admin review prioritisation.
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS case_strength_score integer;

-- Dollar value of the overassessment (assessed_value - concluded_value).
-- Zero when property is underassessed. Used for attorney referral decisions.
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS case_value_at_stake integer;

-- True when our concluded_value is materially higher than the assessed_value.
-- Relevant for pre-purchase/pre-listing service types and as a strategic flag
-- for tax_appeal users (filing may invite upward reassessment).
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS is_underassessed boolean NOT NULL DEFAULT false;

-- Percentage by which concluded_value exceeds assessed_value.
-- Null when property is overassessed or at parity.
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS underassessment_pct numeric(5,2);

-- ── comparable_sales ──────────────────────────────────────────────────────────

-- True when ATTOM sale transaction data indicates a non-arms-length transfer
-- (foreclosure, REO, short sale, related-party). These comps are kept in the
-- grid but flagged so the narrative AI can treat them appropriately.
ALTER TABLE comparable_sales
  ADD COLUMN IF NOT EXISTS is_distressed_sale boolean NOT NULL DEFAULT false;

-- Human-readable note about the sale condition (e.g., 'REO sale — foreclosure').
ALTER TABLE comparable_sales
  ADD COLUMN IF NOT EXISTS sale_condition_notes text;

-- Estimated effective age of the comparable property (years).
-- Derived from year_built assuming average condition (we have no photos for comps).
ALTER TABLE comparable_sales
  ADD COLUMN IF NOT EXISTS comp_effective_age integer;
