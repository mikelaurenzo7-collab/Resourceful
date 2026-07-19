import { describe, expect, it } from 'vitest';

import type { ReportTemplateData } from '@/lib/templates/report-template';
import {
  buildFloodEnvironmentalContext,
  buildValueConclusionRows,
  getReportIncomeAssessment,
  hasFloodEnvironmentalContext,
  hasReleaseReadyIncomeApproach,
} from './section-data';

describe('buildValueConclusionRows', () => {
  it('builds weighted approach rows with explicit value-per-square-foot metrics', () => {
    const data = createTemplateData({
      report: { property_type: 'commercial' },
      property: {
        building_sqft_gross: 10_000,
        valuation_method: 'sales_income_blend',
        cost_approach_rcn: 1_000_000,
        cost_approach_value: 920_000,
        physical_depreciation_pct: 20,
        functional_obsolescence_pct: 0,
        land_value: 120_000,
        cost_replacement_source_authority: 'Marshall & Swift cost service',
        cost_depreciation_source_authority: 'Age-life depreciation analysis',
        cost_land_source_authority: 'Verified land allocation study',
        cost_source_references: {
          rcn: 'cost/rcn-2026',
          depreciation: 'cost/depreciation-2026',
          land: 'cost/land-2026',
        },
        cost_methodology: 'Replacement cost new less physical and functional depreciation, plus land value.',
        cost_effective_date: '2026-04-10',
        cost_verification_state: 'verified',
        cost_verified_by: 'Test Reviewer',
        cost_verified_at: '2026-04-10T12:00:00.000Z',
      },
      comparableSales: [
        { sale_price: 950_000, adjusted_price_per_sqft: 100 },
        { sale_price: 1_025_000, adjusted_price_per_sqft: 110 },
        { sale_price: 1_100_000, adjusted_price_per_sqft: 120 },
      ],
      comparableRentals: [{ address: '100 Rental Ave' }],
      incomeAnalysis: {
        net_operating_income: 78_400,
        concluded_cap_rate: 0.08,
        concluded_value_income_approach: 980_000,
        investor_survey_reference: 'Market participant survey',
      },
    });

    expect(buildValueConclusionRows(data)).toEqual([
      { approach: 'Sales Comparison', total: 1_100_000, valuePerSqFt: 110, role: 'Primary (70%)' },
      { approach: 'Income Capitalization', total: 980_000, valuePerSqFt: 98, role: 'Supporting (30%)' },
      { approach: 'Cost Approach', total: 920_000, valuePerSqFt: 92, role: 'Supporting check' },
    ]);
    expect(hasReleaseReadyIncomeApproach(data)).toBe(true);
  });

  it('omits income conclusions for an ordinary residential property', () => {
    const data = createTemplateData({
      report: { property_type: 'residential' },
      property: {
        building_sqft_gross: 2_000,
        property_class_description: 'Single-family residence with home office',
      },
      comparableSales: [{ sale_price: 500_000, adjusted_price_per_sqft: 250 }],
      comparableRentals: [{ address: '100 Rental Ave' }],
      incomeAnalysis: {
        net_operating_income: 30_000,
        concluded_cap_rate: 0.06,
        concluded_value_income_approach: 500_000,
        investor_survey_reference: 'Market participant survey',
      },
    });

    expect(buildValueConclusionRows(data).map((row) => row.approach)).toEqual([
      'Sales Comparison',
    ]);
    expect(getReportIncomeAssessment(data)).toBeNull();
    expect(hasReleaseReadyIncomeApproach(data)).toBe(false);
  });

  it('omits incomplete or unreconciled income conclusions', () => {
    const data = createTemplateData({
      report: { property_type: 'commercial' },
      property: { building_sqft_gross: 10_000 },
      comparableRentals: [],
      incomeAnalysis: {
        net_operating_income: 100_000,
        concluded_cap_rate: 8,
        concluded_value_income_approach: 1_250_000,
        investor_survey_reference: null,
      },
    });

    const assessment = getReportIncomeAssessment(data);
    expect(assessment?.isReleaseReady).toBe(false);
    expect(buildValueConclusionRows(data)).toEqual([]);
    expect(hasReleaseReadyIncomeApproach(data)).toBe(false);
  });

  it('supports residential multifamily income evidence', () => {
    const data = createTemplateData({
      report: { property_type: 'residential' },
      property: {
        building_sqft_gross: 8_000,
        property_subtype: 'multifamily',
      },
      comparableRentals: [{ address: '100 Rental Ave' }, { address: '200 Rental Ave' }],
      incomeAnalysis: {
        net_operating_income: 120_000,
        concluded_cap_rate: 0.075,
        concluded_value_income_approach: 1_600_000,
        investor_survey_reference: 'Regional apartment investor survey',
      },
    });

    expect(hasReleaseReadyIncomeApproach(data)).toBe(true);
    expect(buildValueConclusionRows(data)).toEqual([
      {
        approach: 'Income Capitalization',
        total: 1_600_000,
        valuePerSqFt: 200,
        role: 'Supporting',
      },
    ]);
  });
});

describe('buildFloodEnvironmentalContext', () => {
  it('derives flood facts and observed environmental notes from current report data', () => {
    const data = createTemplateData({
      property: {
        flood_zone_designation: 'AE',
        flood_map_panel_number: '17031C0126J',
        flood_map_panel_date: '2023-08-01',
      },
      photos: [
        {
          photo_type: 'environmental_concern',
          caption: 'Standing water visible near the rear lot line.',
          ai_analysis: {
            professional_caption: 'Standing water observed along the rear drainage swale.',
            defects: [
              {
                type: 'drainage',
                description: 'Water pooling at grade',
                report_language: 'Drainage-related ponding is visible along the rear yard.',
              },
            ],
          },
        },
      ],
    });

    const context = buildFloodEnvironmentalContext(data);

    expect(context.facts).toEqual([
      { label: 'Flood Zone', value: 'AE' },
      { label: 'FEMA Panel', value: '17031C0126J' },
      { label: 'Panel Effective Date', value: '2023-08-01' },
    ]);
    expect(context.observations).toContain(
      'Public mapping identifies the subject within flood zone AE, which may affect insurance cost, lender requirements, and marketability.'
    );
    expect(context.observations).toContain('Standing water observed along the rear drainage swale.');
    expect(context.observations).toContain('Drainage-related ponding is visible along the rear yard.');
    expect(hasFloodEnvironmentalContext(data)).toBe(true);
  });
});

function createTemplateData(overrides: {
  report?: Record<string, unknown>;
  property?: Record<string, unknown>;
  photos?: unknown[];
  comparableSales?: unknown[];
  comparableRentals?: unknown[];
  incomeAnalysis?: Record<string, unknown> | null;
}): ReportTemplateData {
  const base = {
    report: {
      property_address: '123 Main St',
      property_type: 'residential',
      service_type: 'tax_appeal',
    },
    property: {
      building_sqft_gross: 0,
      building_sqft_living_area: null,
      property_subtype: null,
      property_class_description: null,
      valuation_method: 'sales_comparison',
      cost_approach_value: null,
      flood_zone_designation: null,
      flood_map_panel_number: null,
      flood_map_panel_date: null,
      zoning_overlay_district: null,
    },
    photos: [],
    comparableSales: [],
    comparableRentals: [],
    incomeAnalysis: null,
    narratives: [],
    countyRule: null,
    maps: {},
    filingGuide: null,
    concludedValue: 0,
    valuationDate: '2026-04-10',
    reportDate: '2026-04-10',
  };

  return {
    ...base,
    ...overrides,
    report: { ...base.report, ...(overrides.report ?? {}) },
    property: { ...base.property, ...(overrides.property ?? {}) },
  } as unknown as ReportTemplateData;
}
