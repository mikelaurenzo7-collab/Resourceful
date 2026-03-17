import { describe, it, expect } from 'vitest';

// We test the pure transformation functions by importing the module.
// collectPropertyData requires live ATTOM calls so we test the exported
// helper logic via the module internals. Since attomToCollected and
// mergeCountyData are not exported, we test them via a lightweight
// integration approach — importing the module and checking types.

// For now, test the CollectedPropertyData shape and ServiceResult contract
// by verifying the module exports compile and the types are correct.

// NOTE: attomToCollected and mergeCountyData are private functions.
// To properly unit-test them we'd need to export them. For now, we test
// the public collectPropertyData interface contract.

import type {
  CollectPropertyDataParams,
  CollectedPropertyData,
  ServiceResult,
} from './data-router';

describe('data-router types', () => {
  it('CollectedPropertyData has all required fields', () => {
    const sample: CollectedPropertyData = {
      assessed_value: 250000,
      assessed_value_source: 'attom',
      market_value_estimate_low: null,
      market_value_estimate_high: null,
      assessment_ratio: null,
      assessment_methodology: null,
      lot_size_sqft: 5000,
      building_sqft_gross: 1500,
      building_sqft_living_area: null,
      year_built: 1985,
      property_class: null,
      property_class_description: 'Single Family',
      zoning_designation: 'R-1',
      zoning_ordinance_citation: null,
      zoning_conformance: null,
      flood_zone_designation: null,
      flood_map_panel_number: null,
      flood_map_panel_date: null,
      tax_year_in_appeal: 2025,
      assessment_history: null,
      deed_history: null,
      attom_raw_response: null,
      county_assessor_raw_response: null,
      data_collection_notes: null,
      latitude: 41.8781,
      longitude: -87.6298,
      countyFips: '17031',
      countyName: 'Cook',
    };

    expect(sample.assessed_value).toBe(250000);
    expect(sample.assessed_value_source).toBe('attom');
    expect(sample.latitude).toBe(41.8781);
  });

  it('ServiceResult can represent success', () => {
    const result: ServiceResult<string> = { data: 'ok', error: null };
    expect(result.data).toBe('ok');
    expect(result.error).toBeNull();
  });

  it('ServiceResult can represent failure', () => {
    const result: ServiceResult<string> = { data: null, error: 'something failed' };
    expect(result.data).toBeNull();
    expect(result.error).toBe('something failed');
  });

  it('CollectPropertyDataParams accepts minimal input', () => {
    const params: CollectPropertyDataParams = {
      address: '123 Main St, Springfield, IL',
      countyFips: null,
      countyRules: null,
    };
    expect(params.address).toBeTruthy();
  });
});
