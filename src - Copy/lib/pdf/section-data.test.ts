import { describe, expect, it } from 'vitest';

import type { ReportTemplateData } from '@/lib/templates/report-template';
import { buildFloodEnvironmentalContext, buildValueConclusionRows, hasFloodEnvironmentalContext } from './section-data';

describe('buildValueConclusionRows', () => {
  it('builds weighted approach rows from existing valuation data', () => {
    const data = createTemplateData({
      property: {
        building_sqft_gross: 10000,
        valuation_method: 'sales_income_blend',
        cost_approach_value: 920000,
      },
      comparableSales: [
        { sale_price: 950000, adjusted_price_per_sqft: 100 },
        { sale_price: 1025000, adjusted_price_per_sqft: 110 },
        { sale_price: 1100000, adjusted_price_per_sqft: 120 },
      ],
      incomeAnalysis: {
        concluded_value_income_approach: 980000,
      },
    });

    expect(buildValueConclusionRows(data)).toEqual([
      { approach: 'Sales Comparison', total: 1100000, perUnit: 110, role: 'Primary (70%)' },
      { approach: 'Income Capitalization', total: 980000, perUnit: 98, role: 'Supporting (30%)' },
      { approach: 'Cost Approach', total: 920000, perUnit: 92, role: 'Supporting check' },
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

function createTemplateData(overrides: Record<string, unknown>): ReportTemplateData {
  return {
    report: {
      property_address: '123 Main St',
      service_type: 'tax_appeal',
    },
    property: {
      building_sqft_gross: 0,
      building_sqft_living_area: null,
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
    ...overrides,
  } as unknown as ReportTemplateData;
}