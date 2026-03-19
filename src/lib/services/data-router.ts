// ─── Property Data Collection Router ─────────────────────────────────────────
// Nationwide data source strategy powered by ATTOM:
//   1. ATTOM covers every county in every state — this is the universal source.
//   2. If a county has a dedicated assessor API (county_rules.assessor_api_url),
//      a future adapter can try it first for authoritative assessed values.
//   3. County API results take precedence for assessed values when available.
//
// No county-specific adapters are hardcoded. When a county_rules row has an
// assessor_api_url, the collectFromCountyApi() function can route to the
// appropriate adapter. Adding a new adapter means adding a case to that switch.
// Every county works via ATTOM regardless of whether an adapter exists.

import type {
  PropertyData,
  CountyRule,
} from '@/types/database';

import {
  getPropertyDetail as attomGetPropertyDetail,
  type AttomPropertyDetail,
} from './attom';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CollectPropertyDataParams {
  address: string;
  pin?: string | null;
  countyFips: string | null;
  countyRules: Pick<
    CountyRule,
    | 'county_name'
    | 'state_abbreviation'
    | 'county_fips'
    | 'assessment_methodology'
    | 'assessment_ratio_residential'
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

  // Location info from ATTOM (written to the Report, not PropertyData)
  latitude: number | null;
  longitude: number | null;
  countyFips: string | null;
  countyName: string | null;
}

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

// ─── County API Adapters ─────────────────────────────────────────────────────
// Future county-specific API adapters go here. Each adapter is keyed by
// county_fips from the county_rules table (not by hardcoded county names).

interface CountyApiResult {
  source: 'county_api';
  assessment: {
    assessed_value: number | null;
    tax_year: number | null;
    building_sqft_gross: number | null;
    lot_size_sqft: number | null;
    year_built: number | null;
    property_class: string | null;
  };
  raw: Record<string, unknown>;
}

/**
 * Attempt to collect data from a county-specific assessor API.
 * Checks county_rules.assessor_api_url to determine if a direct adapter exists.
 * Returns null gracefully when no adapter is available — ATTOM covers everything.
 *
 * To add a new county adapter:
 *   1. Set assessor_api_url in the county_rules row for that county
 *   2. Add a case below keyed by county_fips
 *   3. Implement the adapter function that returns CountyApiResult
 */
async function collectFromCountyApi(
  _params: CollectPropertyDataParams
): Promise<ServiceResult<CountyApiResult>> {
  // Only attempt if the county has a configured assessor API URL
  if (!_params.countyRules?.assessor_api_url) {
    return { data: null, error: null };
  }

  // Route by county FIPS code (not hardcoded county names)
  const _fips = _params.countyRules.county_fips;

  // No adapters currently active — ATTOM handles all counties.
  // When a county adapter is needed, add a case here:
  //
  // switch (fips) {
  //   case '06037': // Los Angeles County, CA
  //     return collectFromLACounty(params);
  //   default:
  //     break;
  // }

  return { data: null, error: null };
}

// ─── ATTOM Adapter ───────────────────────────────────────────────────────────

/** @internal Exported for testing */
export function attomToCollected(detail: AttomPropertyDetail): CollectedPropertyData {
  return {
    assessed_value: detail.assessment.assessedValue ?? null,
    assessed_value_source: 'attom',
    market_value_estimate_low: null,
    market_value_estimate_high: null,
    assessment_ratio: null,
    assessment_methodology: null,
    lot_size_sqft: detail.lot.lotSquareFeet ?? null,
    building_sqft_gross: detail.summary.buildingSquareFeet ?? null,
    building_sqft_living_area: detail.summary.livingSquareFeet ?? null,
    year_built: detail.summary.yearBuilt ?? null,
    property_class: null,
    property_class_description: detail.summary.propertyType || null,
    zoning_designation: detail.lot.zoning,
    zoning_ordinance_citation: null,
    zoning_conformance: null,
    flood_zone_designation: null, // Populated separately by FEMA service
    flood_map_panel_number: null,
    flood_map_panel_date: null,
    tax_year_in_appeal: detail.assessment.assessmentYear ?? null,
    assessment_history: null,
    deed_history: null,
    attom_raw_response: detail as unknown as Record<string, unknown>,
    county_assessor_raw_response: null,
    data_collection_notes: null,

    latitude: detail.location.latitude ?? null,
    longitude: detail.location.longitude ?? null,
    countyFips: detail.location.countyFips ?? null,
    countyName: detail.location.countyName ?? null,
  };
}

// ─── Merge Logic ─────────────────────────────────────────────────────────────

/**
 * Merge county API results into the base ATTOM data.
 * County-sourced assessed values take precedence since they come directly
 * from the authority of record.
 */
/** @internal Exported for testing */
export function mergeCountyData(
  base: CollectedPropertyData,
  county: CountyApiResult
): CollectedPropertyData {
  const ca = county.assessment;

  return {
    ...base,

    // County assessed values take precedence
    assessed_value: ca.assessed_value ?? base.assessed_value,
    assessed_value_source: 'county_api',
    tax_year_in_appeal: ca.tax_year ?? base.tax_year_in_appeal,

    // Supplement physical attributes if ATTOM was missing them
    building_sqft_gross: base.building_sqft_gross ?? ca.building_sqft_gross,
    lot_size_sqft: base.lot_size_sqft ?? ca.lot_size_sqft,
    year_built: base.year_built ?? ca.year_built,
    property_class: ca.property_class ?? base.property_class,

    // Store county raw response
    county_assessor_raw_response: county.raw,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Collect property data from ATTOM (universal) and optionally from a
 * county-specific assessor API if one is configured in county_rules.
 *
 * Sets assessed_value_source to 'county_api' or 'attom'.
 */
export async function collectPropertyData(
  params: CollectPropertyDataParams
): Promise<ServiceResult<CollectedPropertyData>> {
  // Step 1: Always fetch from ATTOM (our universal data source)
  const attomResult = await attomGetPropertyDetail(params.address);

  if (attomResult.error || !attomResult.data) {
    console.error(
      `[data-router] ATTOM failed for "${params.address}": ${attomResult.error}`
    );
    return {
      data: null,
      error: `Property data collection failed: ${attomResult.error}`,
    };
  }

  let collected = attomToCollected(attomResult.data);

  // Step 2: Try county-specific API if rules indicate one exists
  if (params.countyRules?.assessor_api_url) {
    const countyResult = await collectFromCountyApi(params);

    if (countyResult.data) {
      collected = mergeCountyData(collected, countyResult.data);
      console.log(
        `[data-router] Merged county data for "${params.address}" — assessed_value_source: county_api`
      );
    } else if (countyResult.error) {
      console.warn(
        `[data-router] County API failed, using ATTOM only: ${countyResult.error}`
      );
    }
  }

  return { data: collected, error: null };
}
