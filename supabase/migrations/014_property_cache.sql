-- ─── Property Cache ─────────────────────────────────────────────────────────
-- Caches ATTOM property lookups to avoid redundant API calls.
-- Used at three points: (1) address entry in wizard, (2) instant preview
-- post-payment, (3) pipeline Stage 1 data collection.
-- TTL: 90 days for property characteristics, assessment data refreshes annually.

CREATE TABLE IF NOT EXISTS property_cache (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address_key   text NOT NULL,              -- normalized: lower(trim(line1, city, state))
  attom_raw     jsonb NOT NULL,             -- full AttomPropertyDetail JSON
  property_type text,                       -- detected: residential, commercial, industrial, land
  year_built    integer,
  bedrooms      integer,
  bathrooms     numeric,
  building_sqft integer,
  lot_sqft      integer,
  stories       numeric,
  assessed_value numeric,
  tax_amount    numeric,
  assessment_year integer,
  county_fips   text,
  county_name   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '90 days')
);

-- Fast lookup by normalized address
CREATE UNIQUE INDEX IF NOT EXISTS idx_property_cache_address_key
  ON property_cache (address_key);

-- TTL cleanup index
CREATE INDEX IF NOT EXISTS idx_property_cache_expires_at
  ON property_cache (expires_at);

-- RLS: publicly readable (no secrets in property data), only service role can write
ALTER TABLE property_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_cache_read_all"
  ON property_cache FOR SELECT
  USING (true);

CREATE POLICY "property_cache_service_write"
  ON property_cache FOR INSERT
  WITH CHECK (true);

CREATE POLICY "property_cache_service_update"
  ON property_cache FOR UPDATE
  USING (true);

-- ─── Add attom_cache_id to reports ──────────────────────────────────────────
-- Links a report to the cached ATTOM lookup so the pipeline can reuse it.

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS attom_cache_id uuid REFERENCES property_cache(id);
