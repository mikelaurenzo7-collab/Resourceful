// ─── Property Data Collection Router ─────────────────────────────────────────
// Multi-source data strategy — free public records first, ATTOM as fallback:
//   1. Public Records (FREE): Web search + AI extraction from county assessor
//      pages. Works for any county, costs only Anthropic API usage.
//   2. ATTOM (PAID, optional): Universal coverage if API key is configured.
//      Falls back to this if public records don't return enough data.
//   3. County API adapters (future): Direct API calls for counties that
//      expose structured assessor data.
//
// The router tries sources in order and merges results. Public records are
// authoritative because they come directly from the county assessor.

import type {
  PropertyData,
  CountyRule,
} from '@/types/database';

import {
  getPropertyDetail as attomGetPropertyDetail,
  type AttomPropertyDetail,
} from './attom';

import {
  getPropertyDetail as lightboxGetPropertyDetail,
  type LightboxParcelDetail,
} from './lightbox';

import {
  getParcelByAddress,
} from './regrid';

import {
  getPropertyDetailFromPublicRecords,
} from './public-records';
import { apiLogger } from '@/lib/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CollectPropertyDataParams {
  address: string;
  city: string;
  state: string;
  county?: string | null;
  pin?: string | null;
  countyFips: string | null;
  countyRules: Pick<
    CountyRule,
    | 'county_name'
    | 'state_abbreviation'
    | 'county_fips'
    | 'assessment_methodology'
    | 'assessment_ratio_residential'
    | 'assessment_ratio_commercial'
    | 'assessment_ratio_industrial'
    | 'assessor_api_url'
  > | null;
}

/**
 * Data source trust levels — ordered from most to least trustworthy.
 * Per CLAUDE.md: user data > our measurements > independent sources > county records.
 */
export type DataConfidence = 'user_provided' | 'independently_verified' | 'county_records' | 'ai_extracted';

/**
 * Tracks which source supplied each key field and how much we trust it.
 * Passed downstream so narratives can frame "estimated" vs "confirmed" data.
 */
export interface DataSourceMap {
  assessed_value?: { source: string; confidence: DataConfidence };
  building_sqft?: { source: string; confidence: DataConfidence };
  year_built?: { source: string; confidence: DataConfidence };
  lot_size_sqft?: { source: string; confidence: DataConfidence };
  property_class?: { source: string; confidence: DataConfidence };
}

/**
 * Unified property data collected from all sources.
 * Maps directly to the PropertyData table columns (minus id/report_id).
 */
export interface CollectedPropertyData {
  assessed_value: number | null;
  assessed_value_source: string | null;
  market_value_estimate_low: number | null;
  market_value_estimate_high: number | null;
  assessment_ratio: number | null;
  assessment_methodology: PropertyData['assessment_methodology'];
  lot_size_sqft: number | null;
  building_sqft_gross: number | null;
  building_sqft_living_area: number | null;
  year_built: number | null;
  property_class: string | null;
  property_class_description: string | null;
  zoning_designation: string | null;
  zoning_ordinance_citation: string | null;
  zoning_conformance: string | null;
  flood_zone_designation: string | null;
  flood_map_panel_number: string | null;
  flood_map_panel_date: string | null;
  tax_year_in_appeal: number | null;
  assessment_history: Record<string, unknown>[] | null;
  deed_history: Record<string, unknown>[] | null;
  attom_raw_response: Record<string, unknown> | null;
  county_assessor_raw_response: Record<string, unknown> | null;
  data_collection_notes: string | null;

  // Data provenance — tracks which source supplied each key field
  data_source_map: DataSourceMap;

  // Location info (written to the Report, not PropertyData)
  latitude: number | null;
  longitude: number | null;
  countyFips: string | null;
  countyName: string | null;

  // Building details 
  bedroom_count: number | null;
  full_bath_count: number | null;
  half_bath_count: number | null;
  number_of_stories: number | null;

  // Regrid parcel intelligence (unique data not available from other sources)
  parcel_boundary_geojson: Record<string, unknown> | null;
  lot_frontage_ft: number | null;
  lot_depth_ft: number | null;
  lot_shape_description: string | null;
  legal_description: string | null;
  owner_name: string | null;
  owner_mailing_address: string | null;
  zoning_description: string | null;
  zoning_overlay_district: string | null;
  apn: string | null;
  regrid_parcel_id: string | null;
  parcel_data_source: string | null;
}

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

function attomToCollected(detail: AttomPropertyDetail, source: string): CollectedPropertyData {
  const confidence: DataConfidence = source === 'public_records' ? 'ai_extracted' : 'county_records';
  const sourceMap: DataSourceMap = {};

  if (detail.assessment.assessedValue) {
    sourceMap.assessed_value = { source, confidence };
  }
  if (detail.summary.buildingSquareFeet) {
    sourceMap.building_sqft = { source, confidence };
  }
  if (detail.summary.yearBuilt) {
    sourceMap.year_built = { source, confidence };
  }
  if (detail.lot.lotSquareFeet) {
    sourceMap.lot_size_sqft = { source, confidence };
  }
  if (detail.summary.propertyClass) {
    sourceMap.property_class = { source, confidence };
  }

  return {
    assessed_value: detail.assessment.assessedValue || null,
    assessed_value_source: source,
    market_value_estimate_low: null,
    market_value_estimate_high: null,
    assessment_ratio: null,
    assessment_methodology: null,
    lot_size_sqft: detail.lot.lotSquareFeet || null,
    building_sqft_gross: detail.summary.buildingSquareFeet || null,
    building_sqft_living_area: detail.summary.livingSquareFeet || null,
    year_built: detail.summary.yearBuilt || null,
    property_class: detail.summary.propertyClass || null,
    property_class_description: detail.summary.propertyType || null,
    zoning_designation: detail.lot.zoning,
    zoning_ordinance_citation: null,
    zoning_conformance: null,
    flood_zone_designation: null,
    flood_map_panel_number: null,
    flood_map_panel_date: null,
    tax_year_in_appeal: detail.assessment.assessmentYear || null,
    assessment_history: null,
    deed_history: null,
    attom_raw_response: detail as unknown as Record<string, unknown>,
    county_assessor_raw_response: null,
    data_collection_notes: null,

    data_source_map: sourceMap,

    latitude: detail.location.latitude || null,
    longitude: detail.location.longitude || null,
    countyFips: detail.location.countyFips || null,
    countyName: detail.location.countyName || null,

    // Building details from ATTOM
    bedroom_count: detail.summary.bedrooms || null,
    full_bath_count: detail.summary.bathrooms ? Math.floor(detail.summary.bathrooms) : null,
    half_bath_count: detail.summary.bathrooms ? (detail.summary.bathrooms % 1 >= 0.5 ? 1 : 0) : null,
    number_of_stories: detail.summary.stories || null,

    // Regrid fields — not populated from ATTOM
    parcel_boundary_geojson: null,
    lot_frontage_ft: null,
    lot_depth_ft: null,
    lot_shape_description: null,
    legal_description: null,
    owner_name: null,
    owner_mailing_address: null,
    zoning_description: null,
    zoning_overlay_district: null,
    apn: null,
    regrid_parcel_id: null,
    parcel_data_source: null,
  };
}

/**
 * Merge supplemental data into a base result.
 * Supplemental values only fill in gaps — they don't override existing data.
 */
function mergeSupplemental(
  base: CollectedPropertyData,
  supplement: CollectedPropertyData,
  supplementSource: string
): CollectedPropertyData {
  const notes = [base.data_collection_notes, `Supplemented with ${supplementSource}`]
    .filter(Boolean)
    .join('; ');

  // Merge source maps — base wins for fields it already has
  const mergedSourceMap: DataSourceMap = { ...base.data_source_map };
  for (const [key, val] of Object.entries(supplement.data_source_map) as [keyof DataSourceMap, DataSourceMap[keyof DataSourceMap]][]) {
    if (!mergedSourceMap[key] && val) {
      mergedSourceMap[key] = val;
    }
  }

  return {
    ...base,
    assessed_value: base.assessed_value ?? supplement.assessed_value,
    assessed_value_source: base.assessed_value
      ? base.assessed_value_source
      : supplement.assessed_value_source,
    lot_size_sqft: base.lot_size_sqft ?? supplement.lot_size_sqft,
    building_sqft_gross: base.building_sqft_gross ?? supplement.building_sqft_gross,
    building_sqft_living_area: base.building_sqft_living_area ?? supplement.building_sqft_living_area,
    year_built: base.year_built ?? supplement.year_built,
    property_class: base.property_class ?? supplement.property_class,
    property_class_description: base.property_class_description ?? supplement.property_class_description,
    zoning_designation: base.zoning_designation ?? supplement.zoning_designation,
    tax_year_in_appeal: base.tax_year_in_appeal ?? supplement.tax_year_in_appeal,
    latitude: base.latitude ?? supplement.latitude,
    longitude: base.longitude ?? supplement.longitude,
    countyFips: base.countyFips ?? supplement.countyFips,
    countyName: base.countyName ?? supplement.countyName,
    // Regrid parcel fields — supplement fills gaps
    parcel_boundary_geojson: base.parcel_boundary_geojson ?? supplement.parcel_boundary_geojson,
    lot_frontage_ft: base.lot_frontage_ft ?? supplement.lot_frontage_ft,
    lot_depth_ft: base.lot_depth_ft ?? supplement.lot_depth_ft,
    lot_shape_description: base.lot_shape_description ?? supplement.lot_shape_description,
    legal_description: base.legal_description ?? supplement.legal_description,
    owner_name: base.owner_name ?? supplement.owner_name,
    owner_mailing_address: base.owner_mailing_address ?? supplement.owner_mailing_address,
    zoning_description: base.zoning_description ?? supplement.zoning_description,
    zoning_overlay_district: base.zoning_overlay_district ?? supplement.zoning_overlay_district,
    apn: base.apn ?? supplement.apn,
    regrid_parcel_id: base.regrid_parcel_id ?? supplement.regrid_parcel_id,
    parcel_data_source: base.parcel_data_source ?? supplement.parcel_data_source,
    // Building details
    bedroom_count: base.bedroom_count ?? supplement.bedroom_count,
    full_bath_count: base.full_bath_count ?? supplement.full_bath_count,
    half_bath_count: base.half_bath_count ?? supplement.half_bath_count,
    number_of_stories: base.number_of_stories ?? supplement.number_of_stories,
    data_source_map: mergedSourceMap,
    data_collection_notes: notes,
  };
}

// ─── Lightbox Normalizer ─────────────────────────────────────────────────────

function lightboxToCollected(detail: LightboxParcelDetail): CollectedPropertyData {
  const sourceMap: DataSourceMap = {};
  if (detail.assessment.assessedValue) {
    sourceMap.assessed_value = { source: 'lightbox', confidence: 'county_records' };
  }
  if (detail.structure.grossSquareFeet) {
    sourceMap.building_sqft = { source: 'lightbox', confidence: 'county_records' };
  }
  if (detail.structure.yearBuilt) {
    sourceMap.year_built = { source: 'lightbox', confidence: 'county_records' };
  }
  if (detail.lot.squareFeet) {
    sourceMap.lot_size_sqft = { source: 'lightbox', confidence: 'county_records' };
  }
  if (detail.propertyUse.code) {
    sourceMap.property_class = { source: 'lightbox', confidence: 'county_records' };
  }

  return {
    assessed_value: detail.assessment.assessedValue ?? null,
    assessed_value_source: 'lightbox',
    market_value_estimate_low: null,
    market_value_estimate_high: null,
    assessment_ratio: null,
    assessment_methodology: null,
    lot_size_sqft: detail.lot.squareFeet ?? null,
    building_sqft_gross: detail.structure.grossSquareFeet ?? null,
    building_sqft_living_area: detail.structure.livableSquareFeet ?? null,
    year_built: detail.structure.yearBuilt ?? null,
    property_class: detail.propertyUse.code ?? null,
    property_class_description: detail.propertyUse.description ?? null,
    zoning_designation: detail.lot.zoning ?? null,
    zoning_ordinance_citation: null,
    zoning_conformance: null,
    flood_zone_designation: null,
    flood_map_panel_number: null,
    flood_map_panel_date: null,
    tax_year_in_appeal: detail.assessment.taxYear ?? null,
    assessment_history: null,
    deed_history: detail.saleHistory.length > 0
      ? detail.saleHistory.map((s) => ({
          date: s.date,
          price: s.amount,
          documentType: s.documentType,
          armsLength: s.armsLength,
          buyers: s.buyerNames,
          sellers: s.sellerNames,
        } as Record<string, unknown>))
      : null,
    attom_raw_response: null,
    county_assessor_raw_response: {
      source: 'lightbox',
      parcelId: detail.parcelId,
      apn: detail.apn,
      assessedValue: detail.assessment.assessedValue,
      landValue: detail.assessment.landValue,
      marketValue: detail.assessment.marketValue,
    },
    data_collection_notes: null,
    data_source_map: sourceMap,
    latitude: detail.location.latitude ?? null,
    longitude: detail.location.longitude ?? null,
    countyFips: detail.address.fips ?? null,
    countyName: detail.address.county ?? null,

    // Building details — not available from Lightbox basic
    bedroom_count: null,
    full_bath_count: null,
    half_bath_count: null,
    number_of_stories: null,

    // Regrid fields — not populated from Lightbox
    parcel_boundary_geojson: null,
    lot_frontage_ft: null,
    lot_depth_ft: null,
    lot_shape_description: null,
    legal_description: null,
    owner_name: null,
    owner_mailing_address: null,
    zoning_description: null,
    zoning_overlay_district: null,
    apn: detail.apn ?? null,  // Lightbox does have APN
    regrid_parcel_id: null,
    parcel_data_source: null,
  };
}

// ─── Data Quality Check ──────────────────────────────────────────────────────

function hasMinimumData(data: CollectedPropertyData): boolean {
  // We need at least assessed value + building sqft to run a useful analysis
  // Explicit > 0 checks: falsy 0 values must not pass
  return !!(data.assessed_value && data.assessed_value > 0 && data.building_sqft_gross && data.building_sqft_gross > 0);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Collect property data using a multi-source strategy:
 *   1. Try free public records first (web search + AI extraction)
 *   2. Fall back to ATTOM if configured and public records were insufficient
 *   3. Merge results from all sources
 *
 * The caller should still work if only partial data is returned.
 */
export async function collectPropertyData(
  params: CollectPropertyDataParams
): Promise<ServiceResult<CollectedPropertyData>> {
  const notes: string[] = [];
  let collected: CollectedPropertyData | null = null;

  // ── Source 1: Public Records (FREE) ─────────────────────────────────────
  apiLogger.info({ address: params.address }, '[data-router] Trying public records for ""...');

  const publicResult = await getPropertyDetailFromPublicRecords({
    address: params.address,
    city: params.city,
    state: params.state,
    county: params.county ?? params.countyRules?.county_name ?? null,
  });

  if (publicResult.data) {
    collected = attomToCollected(publicResult.data, 'public_records');
    notes.push('Public records: property data extracted');
    apiLogger.info({ address: params.address }, '[data-router] Public records returned data for ""');

    if (hasMinimumData(collected)) {
      apiLogger.info('[data-router] Public records sufficient — skipping ATTOM');
      collected.data_collection_notes = notes.join('; ');
      return { data: collected, error: null };
    }

    notes.push('Public records: partial data — trying ATTOM for supplement');
  } else {
    notes.push(`Public records: ${publicResult.error ?? 'no data found'}`);
    apiLogger.info('[data-router] Public records returned no data, trying ATTOM...');
  }

  // ── Source 2: ATTOM (PAID, optional) ────────────────────────────────────
  const attomKey = process.env.ATTOM_API_KEY;

  if (attomKey) {
    const attomResult = await attomGetPropertyDetail(params.address, params.city, params.state);

    if (attomResult.data) {
      const attomData = attomToCollected(attomResult.data, 'attom');
      notes.push('ATTOM: property data retrieved');

      if (collected) {
        // Public records had partial data — merge ATTOM as supplement
        collected = mergeSupplemental(collected, attomData, 'attom');
      } else {
        // Public records failed entirely — use ATTOM as primary
        collected = attomData;
      }
    } else {
      notes.push(`ATTOM: ${attomResult.error ?? 'failed'}`);
      apiLogger.warn({ address: params.address }, '[data-router] ATTOM also failed for ""');
    }
  } else {
    notes.push('ATTOM: not configured (no API key)');
    apiLogger.info('[data-router] ATTOM not configured — using public records only');
  }

  // ── Source 3: Lightbox (absolute last resort — only when both public records AND ATTOM failed) ──
  // Lightbox is a paid API that sources from the same county records as ATTOM.
  // Only called if we have critical missing fields AND no primary source succeeded.
  const hasCriticalGaps = !collected?.building_sqft_gross || !collected?.assessed_value;
  const primarySourcesFailed = !collected?.assessed_value_source || collected.assessed_value_source === 'none';
  if (hasCriticalGaps && primarySourcesFailed && process.env.LIGHTBOX_API_KEY && process.env.LIGHTBOX_API_SECRET) {
    apiLogger.info({ address: params.address }, '[data-router] Critical data gaps + primary sources failed — trying Lightbox for ""...');
    const lightboxResult = await lightboxGetPropertyDetail(params.address, params.city, params.state);

    if (lightboxResult.data) {
      const lightboxData = lightboxToCollected(lightboxResult.data);
      if (collected) {
        collected = mergeSupplemental(collected, lightboxData, 'lightbox');
        notes.push('Lightbox: supplemental property data retrieved');
      } else {
        collected = lightboxData;
        notes.push('Lightbox: primary property data source (public records + ATTOM both failed)');
      }
      apiLogger.info({ address: params.address }, '[data-router] Lightbox supplemented data for ""');
    } else {
      notes.push(`Lightbox: ${lightboxResult.error ?? 'no data found'}`);
      apiLogger.warn({ address: params.address, error: lightboxResult.error }, '[data-router] Lightbox also failed for ""');
    }
  }

  // ── Source 4: Regrid (parcel boundaries, zoning detail, legal description) ──
  // Regrid provides UNIQUE data no other source has (geometry, frontage/depth,
  // legal descriptions, zoning detail). Always called when configured.
  if (collected && process.env.REGRID_API_KEY) {
    apiLogger.info({ address: params.address }, '[data-router] Enriching with Regrid parcel data for ""...');
    const regridResult = await getParcelByAddress(params.address, params.city, params.state);

    if (regridResult.data) {
      const parcel = regridResult.data;
      collected.parcel_boundary_geojson = parcel.parcel.boundaryGeoJSON;
      collected.lot_frontage_ft = parcel.parcel.frontageFt;
      collected.lot_depth_ft = parcel.parcel.depthFt;
      collected.lot_shape_description = parcel.parcel.shapeDescription;
      collected.legal_description = parcel.parcel.legalDescription;
      collected.owner_name = parcel.owner.name;
      collected.owner_mailing_address = parcel.owner.mailingAddress;
      collected.zoning_description = parcel.zoning.description;
      collected.apn = collected.apn ?? parcel.apn;
      collected.regrid_parcel_id = parcel.parcelId;
      collected.parcel_data_source = 'regrid';

      // Regrid's GIS-computed lot sqft is geometrically authoritative
      if (!collected.lot_size_sqft && parcel.parcel.gisSqft) {
        collected.lot_size_sqft = parcel.parcel.gisSqft;
        collected.data_source_map.lot_size_sqft = {
          source: 'regrid',
          confidence: 'independently_verified',
        };
      }

      // Supplement zoning designation if missing
      if (!collected.zoning_designation && parcel.zoning.code) {
        collected.zoning_designation = parcel.zoning.code;
      }

      notes.push('Regrid: parcel boundary, zoning detail, and legal description enriched');
      apiLogger.info(
        { address: params.address, apn: parcel.apn, frontageFt: parcel.parcel.frontageFt, zoningCode: parcel.zoning.code },
        '[data-router] Regrid enrichment complete'
      );
    } else {
      notes.push(`Regrid: ${regridResult.error ?? 'no parcel found'}`);
      apiLogger.info({ error: regridResult.error, address: params.address }, '[data-router] Regrid: for ""');
    }
  }

  // ── Result ──────────────────────────────────────────────────────────────
  if (!collected) {
    return {
      data: null,
      error: 'No property data found from any source. Check the address and try again.',
    };
  }

  collected.data_collection_notes = notes.join('; ');
  return { data: collected, error: null };
}
