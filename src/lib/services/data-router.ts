// ─── Property Data Collection Router ─────────────────────────────────────────
// Nationwide two-tier data source strategy:
//   1. ATTOM covers every county in the country — this is the universal source.
//   2. If a county has a dedicated assessor API (county_rules.assessor_api_url),
//      try it first for authoritative assessed values, then merge.
//   3. County API results take precedence for assessed values when available.
//
// Cook County IL is the first county adapter. Adding a new county API adapter
// means adding a case to the switch in collectFromCountyApi(). The rest of
// the pipeline remains unchanged — every county works via ATTOM regardless.

import type {
  PropertyData,
  CountyRule,
} from '@/types/database';

import {
  getPropertyDetail as attomGetPropertyDetail,
  type AttomPropertyDetail,
} from './attom';

import {
  getPropertyByPIN,
  searchByAddress as cookCountySearchByAddress,
  type CookCountyAssessment,
} from './cook-county';

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
 * Currently Cook County IL is implemented. Add new county adapters here as needed.
 */
async function collectFromCountyApi(
  params: CollectPropertyDataParams
): Promise<ServiceResult<CountyApiResult>> {
  // Only attempt if the county has a configured assessor API URL
  if (!params.countyRules?.assessor_api_url) {
    return { data: null, error: null }; // No county-specific API available
  }

  const countyName = params.countyRules.county_name?.toLowerCase() ?? '';
  const state = params.countyRules.state_abbreviation?.toUpperCase() ?? '';

  switch (true) {
    // ── Cook County, IL ──
    case countyName.includes('cook') && state === 'IL': {
      return collectFromCookCounty(params);
    }

    // ── Add new county adapters here ──
    // case countyName.includes('los angeles') && state === 'CA': {
    //   return collectFromLACounty(params);
    // }

    default:
      return { data: null, error: null }; // assessor_api_url set but no adapter yet
  }
}

async function collectFromCookCounty(
  params: CollectPropertyDataParams
): Promise<ServiceResult<CountyApiResult>> {
  try {
    let assessment: CookCountyAssessment | null = null;

    // Try by PIN first if available
    if (params.pin) {
      const pinResult = await getPropertyByPIN(params.pin);
      if (pinResult.data) {
        assessment = pinResult.data;
      }
    }

    // Fall back to address search
    if (!assessment) {
      const searchResult = await cookCountySearchByAddress(params.address);
      if (searchResult.data?.length) {
        // Use the first match and look up its full assessment
        const pinResult = await getPropertyByPIN(searchResult.data[0].pin);
        if (pinResult.data) {
          assessment = pinResult.data;
        }
      }
    }

    if (!assessment) {
      return { data: null, error: 'No Cook County assessment found' };
    }

    return {
      data: {
        source: 'county_api',
        assessment: {
          assessed_value: assessment.totalAssessedValue,
          tax_year: assessment.taxYear,
          building_sqft_gross: assessment.buildingSqFt,
          lot_size_sqft: assessment.landSqFt,
          year_built: assessment.yearBuilt,
          property_class: assessment.classCode || null,
        },
        raw: assessment as unknown as Record<string, unknown>,
      },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[data-router] Cook County collection failed: ${message}`);
    return { data: null, error: `Cook County API failed: ${message}` };
  }
}

// ─── ATTOM Adapter ───────────────────────────────────────────────────────────

function attomToCollected(detail: AttomPropertyDetail): CollectedPropertyData {
  return {
    assessed_value: detail.assessment.assessedValue || null,
    assessed_value_source: 'attom',
    market_value_estimate_low: null,
    market_value_estimate_high: null,
    assessment_ratio: null,
    assessment_methodology: null,
    lot_size_sqft: detail.lot.lotSquareFeet || null,
    building_sqft_gross: detail.summary.buildingSquareFeet || null,
    building_sqft_living_area: null, // ATTOM does not separate living area
    year_built: detail.summary.yearBuilt || null,
    property_class: null,
    property_class_description: detail.summary.propertyType || null,
    zoning_designation: detail.lot.zoning,
    zoning_ordinance_citation: null,
    zoning_conformance: null,
    flood_zone_designation: null, // Populated separately by FEMA service
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

// ─── Merge Logic ─────────────────────────────────────────────────────────────

/**
 * Merge county API results into the base ATTOM data.
 * County-sourced assessed values take precedence since they come directly
 * from the authority of record.
 */
function mergeCountyData(
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
 * Collect property data using the two-tier strategy:
 * 1. Try county-specific API if county_rules.assessor_api_url is set
 * 2. Always call ATTOM as fallback / supplement
 * 3. Merge results, county data takes precedence for assessed values
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
    // ATTOM is required — if it fails, we cannot proceed
    return {
      data: null,
      error: `Property data collection failed: ${attomResult.error}`,
    };
  }

  let collected = attomToCollected(attomResult.data);

  // Step 2: Try county-specific API if rules indicate one exists (assessor_api_url)
  if (params.countyRules?.assessor_api_url) {
    const countyResult = await collectFromCountyApi(params);

    if (countyResult.data) {
      // Step 3: Merge — county assessed values take precedence
      collected = mergeCountyData(collected, countyResult.data);
      console.log(
        `[data-router] Merged county data for "${params.address}" — assessed_value_source: county_api`
      );
    } else if (countyResult.error) {
      // County API failed but ATTOM succeeded — log and continue with ATTOM data
      console.warn(
        `[data-router] County API failed, using ATTOM only: ${countyResult.error}`
      );
    }
  }

  return { data: collected, error: null };
}
