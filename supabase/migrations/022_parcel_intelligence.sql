-- ============================================================================
-- Parcel intelligence — Regrid integration
-- ============================================================================
-- Adds parcel-level data fields populated by the Regrid API.
-- These are NOT available from ATTOM, LightBox, or any other current source.
-- Parcel geometry, frontage/depth, zoning detail, legal descriptions, and
-- owner info strengthen Site Description, HBU analysis, and Cost Approach.

ALTER TABLE property_data
  ADD COLUMN IF NOT EXISTS parcel_boundary_geojson  jsonb,
  ADD COLUMN IF NOT EXISTS lot_frontage_ft          numeric(10, 2),
  ADD COLUMN IF NOT EXISTS lot_depth_ft             numeric(10, 2),
  ADD COLUMN IF NOT EXISTS lot_shape_description    text,
  ADD COLUMN IF NOT EXISTS legal_description        text,
  ADD COLUMN IF NOT EXISTS owner_name               text,
  ADD COLUMN IF NOT EXISTS owner_mailing_address    text,
  ADD COLUMN IF NOT EXISTS zoning_description       text,
  ADD COLUMN IF NOT EXISTS zoning_overlay_district  text,
  ADD COLUMN IF NOT EXISTS apn                      text,
  ADD COLUMN IF NOT EXISTS regrid_parcel_id         text,
  ADD COLUMN IF NOT EXISTS parcel_data_source       text;

COMMENT ON COLUMN property_data.parcel_boundary_geojson IS 'GeoJSON polygon from Regrid — exact parcel boundaries';
COMMENT ON COLUMN property_data.lot_frontage_ft IS 'Street frontage derived from parcel geometry';
COMMENT ON COLUMN property_data.lot_depth_ft IS 'Lot depth derived from parcel geometry';
COMMENT ON COLUMN property_data.lot_shape_description IS 'rectangular, irregular, triangular, etc.';
COMMENT ON COLUMN property_data.legal_description IS 'Metes-and-bounds or lot/block from county records';
COMMENT ON COLUMN property_data.zoning_description IS 'Human-readable zoning description (not just code)';
COMMENT ON COLUMN property_data.apn IS 'Assessor Parcel Number from Regrid';
