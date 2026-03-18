import { describe, it, expect } from 'vitest';

import {
  attomToCollected,
  mergeCountyData,
} from './data-router';
import type {
  CollectPropertyDataParams,
  CollectedPropertyData,
  ServiceResult,
} from './data-router';
import type { AttomPropertyDetail } from './attom';

// ─── Test Fixtures ──────────────────────────────────────────────────────────

function makeAttomDetail(overrides: Partial<AttomPropertyDetail> = {}): AttomPropertyDetail {
  return {
    attomId: 12345,
    address: { line1: '123 Main St', line2: '', locality: 'Springfield', countrySubd: 'IL', postal1: '62701', postal2: '' },
    location: { latitude: 39.7817, longitude: -89.6502, countyFips: '17167', countyName: 'Sangamon' },
    summary: { propertyType: 'Single Family', propertyClass: null, propertyClassDescription: null, yearBuilt: 1985, buildingSquareFeet: 1500, livingSquareFeet: 1200, lotSquareFeet: 5000, bedrooms: 3, bathrooms: 2, stories: 1 },
    assessment: { assessedValue: 250000, marketValue: 300000, landValue: 50000, improvementValue: 200000, assessmentYear: 2025, taxAmount: 4500 },
    building: { garageType: 'Attached', garageSpaces: 2, basementType: 'Full', basementSquareFeet: 1500, exteriorMaterial: 'Brick', roofMaterial: 'Asphalt', heatingType: 'Forced Air', coolingType: 'Central', fireplaceCount: 1, pool: false },
    lot: { lotSquareFeet: 5000, zoning: 'R-1' },
    ...overrides,
  };
}

// ─── attomToCollected ──────────────────────────────────────────────────────

describe('attomToCollected', () => {
  it('maps ATTOM data to CollectedPropertyData', () => {
    const detail = makeAttomDetail();
    const result = attomToCollected(detail);

    expect(result.assessed_value).toBe(250000);
    expect(result.assessed_value_source).toBe('attom');
    expect(result.building_sqft_gross).toBe(1500);
    expect(result.building_sqft_living_area).toBe(1200);
    expect(result.lot_size_sqft).toBe(5000);
    expect(result.year_built).toBe(1985);
    expect(result.zoning_designation).toBe('R-1');
    expect(result.latitude).toBe(39.7817);
    expect(result.longitude).toBe(-89.6502);
    expect(result.countyFips).toBe('17167');
    expect(result.countyName).toBe('Sangamon');
    expect(result.tax_year_in_appeal).toBe(2025);
  });

  it('stores raw ATTOM response', () => {
    const detail = makeAttomDetail();
    const result = attomToCollected(detail);
    expect(result.attom_raw_response).toBeTruthy();
  });

  it('sets flood fields to null (populated separately)', () => {
    const result = attomToCollected(makeAttomDetail());
    expect(result.flood_zone_designation).toBeNull();
    expect(result.flood_map_panel_number).toBeNull();
  });

  it('handles null living area', () => {
    const detail = makeAttomDetail({
      summary: { ...makeAttomDetail().summary, livingSquareFeet: null },
    });
    const result = attomToCollected(detail);
    expect(result.building_sqft_living_area).toBeNull();
  });

  it('handles null zoning', () => {
    const detail = makeAttomDetail({
      lot: { lotSquareFeet: 5000, zoning: null },
    });
    const result = attomToCollected(detail);
    expect(result.zoning_designation).toBeNull();
  });
});

// ─── mergeCountyData ───────────────────────────────────────────────────────

describe('mergeCountyData', () => {
  const baseData = attomToCollected(makeAttomDetail());

  it('county assessed value takes precedence over ATTOM', () => {
    const county = {
      source: 'county_api' as const,
      assessment: {
        assessed_value: 200000,
        tax_year: 2025,
        building_sqft_gross: null,
        lot_size_sqft: null,
        year_built: null,
        property_class: null,
      },
      raw: { test: true },
    };

    const merged = mergeCountyData(baseData, county);

    // County assessed value takes precedence
    expect(merged.assessed_value).toBe(200000);
    expect(merged.assessed_value_source).toBe('county_api');
  });

  it('ATTOM physical attributes take precedence when both have values', () => {
    const county = {
      source: 'county_api' as const,
      assessment: {
        assessed_value: null,
        tax_year: null,
        building_sqft_gross: 1600, // County says 1600
        lot_size_sqft: 6000, // County says 6000
        year_built: 1990,
        property_class: 'R',
      },
      raw: {},
    };

    const merged = mergeCountyData(baseData, county);

    // ATTOM values are kept when present (base has 1500 sqft, 5000 lot)
    expect(merged.building_sqft_gross).toBe(1500);
    expect(merged.lot_size_sqft).toBe(5000);
    expect(merged.year_built).toBe(1985);
  });

  it('county supplements missing ATTOM physical attributes', () => {
    const baseWithGaps = {
      ...baseData,
      building_sqft_gross: null,
      lot_size_sqft: null,
      year_built: null,
    };

    const county = {
      source: 'county_api' as const,
      assessment: {
        assessed_value: null,
        tax_year: null,
        building_sqft_gross: 1600,
        lot_size_sqft: 6000,
        year_built: 1990,
        property_class: 'R',
      },
      raw: {},
    };

    const merged = mergeCountyData(baseWithGaps, county);

    // County fills gaps
    expect(merged.building_sqft_gross).toBe(1600);
    expect(merged.lot_size_sqft).toBe(6000);
    expect(merged.year_built).toBe(1990);
  });

  it('stores county raw response', () => {
    const county = {
      source: 'county_api' as const,
      assessment: {
        assessed_value: null,
        tax_year: null,
        building_sqft_gross: null,
        lot_size_sqft: null,
        year_built: null,
        property_class: null,
      },
      raw: { countyData: 'stored' },
    };

    const merged = mergeCountyData(baseData, county);
    expect(merged.county_assessor_raw_response).toEqual({ countyData: 'stored' });
  });

  it('county property_class takes precedence', () => {
    const county = {
      source: 'county_api' as const,
      assessment: {
        assessed_value: null,
        tax_year: null,
        building_sqft_gross: null,
        lot_size_sqft: null,
        year_built: null,
        property_class: 'R-1A',
      },
      raw: {},
    };

    const merged = mergeCountyData(baseData, county);
    expect(merged.property_class).toBe('R-1A');
  });
});

// ─── Type Contract Tests ───────────────────────────────────────────────────

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
