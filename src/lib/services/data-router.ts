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
  getPropertyDetailFromPublicRecords,
} from './public-records';

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

  // Location info (written to the Report, not PropertyData)
  latitude: number | null;
  longitude: number | null;
  countyFips: string | null;
  countyName: string | null;
}

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

function attomToCollected(detail: AttomPropertyDetail, source: string): CollectedPropertyData {
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

    latitude: detail.location.latitude || null,
    longitude: detail.location.longitude || null,
    countyFips: detail.location.countyFips || null,
    countyName: detail.location.countyName || null,
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
    data_collection_notes: notes,
  };
}

// ─── Data Quality Check ──────────────────────────────────────────────────────

function hasMinimumData(data: CollectedPropertyData): boolean {
  // We need at least assessed value + building sqft to run a useful analysis
  return !!(data.assessed_value && data.building_sqft_gross);
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
  console.log(`[data-router] Trying public records for "${params.address}"...`);

  const publicResult = await getPropertyDetailFromPublicRecords({
    address: params.address,
    city: params.city,
    state: params.state,
    county: params.county ?? params.countyRules?.county_name ?? null,
  });

  if (publicResult.data) {
    collected = attomToCollected(publicResult.data, 'public_records');
    notes.push('Public records: property data extracted');
    console.log(`[data-router] Public records returned data for "${params.address}"`);

    if (hasMinimumData(collected)) {
      console.log(`[data-router] Public records sufficient — skipping ATTOM`);
      collected.data_collection_notes = notes.join('; ');
      return { data: collected, error: null };
    }

    notes.push('Public records: partial data — trying ATTOM for supplement');
  } else {
    notes.push(`Public records: ${publicResult.error ?? 'no data found'}`);
    console.log(`[data-router] Public records returned no data, trying ATTOM...`);
  }

  // ── Source 2: ATTOM (PAID, optional) ────────────────────────────────────
  const attomKey = process.env.ATTOM_API_KEY;

  if (attomKey) {
    const attomResult = await attomGetPropertyDetail(params.address);

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
      console.warn(`[data-router] ATTOM also failed for "${params.address}"`);
    }
  } else {
    notes.push('ATTOM: not configured (no API key)');
    console.log(`[data-router] ATTOM not configured — using public records only`);
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
