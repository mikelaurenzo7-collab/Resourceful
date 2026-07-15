import { describe, expect, it } from 'vitest';
import { preflightReport } from './report-preflight';
import type { ReportTemplateData } from '@/lib/templates/report-template';

function makeData(overrides: Partial<ReportTemplateData> = {}): ReportTemplateData {
  return {
    report: {
      property_address: '123 Main St',
      city: 'Example',
      state: 'IL',
      service_type: 'pre_purchase',
    } as ReportTemplateData['report'],
    property: {
      building_sqft_gross: 1000,
      building_sqft_living_area: null,
      cost_approach_value: null,
    } as ReportTemplateData['property'],
    photos: [],
    comparableSales: [
      {
        address: '125 Main St',
        sale_price: 250000,
        sale_date: '2026-01-01',
      } as ReportTemplateData['comparableSales'][number],
    ],
    comparableRentals: [],
    incomeAnalysis: null,
    narratives: [],
    countyRule: null,
    maps: {},
    filingGuide: null,
    concludedValue: 250000,
    valuationDate: '2026-01-01',
    reportDate: '2026-01-15',
    ...overrides,
  };
}

describe('preflightReport', () => {
  it('accepts an evidence-backed report and permits non-blocking warnings', () => {
    const result = preflightReport(makeData());
    expect(result.ok).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'evidence.photos')).toBe(true);
  });

  it('blocks a report without any evidence-backed valuation approach', () => {
    const data = makeData({ comparableSales: [], incomeAnalysis: null });
    const result = preflightReport(data);
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'valuation.evidence', severity: 'error' })
    );
  });

  it('blocks raw HTML and fenced code from narrative content', () => {
    const data = makeData({
      narratives: [
        {
          section_name: 'market_analysis',
          content: '<div>Do not use layout markup from the model.</div>',
        } as ReportTemplateData['narratives'][number],
      ],
    });
    const result = preflightReport(data);
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'narrative.raw_layout_markup', severity: 'error' })
    );
  });

  it('requires a filing guide for tax-appeal delivery', () => {
    const data = makeData({
      report: {
        ...makeData().report,
        service_type: 'tax_appeal',
      },
    });
    const result = preflightReport(data);
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'appeal.filing_guide', severity: 'error' })
    );
  });

  it('blocks duplicate narrative section identities', () => {
    const narrative = {
      section_name: 'market_analysis',
      content: 'Evidence-grounded market analysis.',
    } as ReportTemplateData['narratives'][number];
    const result = preflightReport(makeData({ narratives: [narrative, narrative] }));
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'narrative.duplicate_section', severity: 'error' })
    );
  });
});
