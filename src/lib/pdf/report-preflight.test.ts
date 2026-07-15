import { describe, expect, it } from 'vitest';
import { preflightReport } from './report-preflight';
import type { ReportTemplateData } from '@/lib/templates/report-template';

function makeData(overrides: Partial<ReportTemplateData> = {}): ReportTemplateData {
  return {
    report: {
      property_address: '123 Main St',
      city: 'Example',
      state: 'IL',
      state_abbreviation: 'IL',
      county: 'Example County',
      county_fips: '17001',
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

function makeValidTaxAppealData(
  overrides: Partial<ReportTemplateData> = {}
): ReportTemplateData {
  return makeData({
    report: {
      ...makeData().report,
      service_type: 'tax_appeal',
    },
    countyRule: {
      county_fips: '17001',
      state_abbreviation: 'IL',
      is_active: true,
      last_verified_date: '2026-06-01',
    } as ReportTemplateData['countyRule'],
    filingGuide: {
      appeal_board_name: 'Example Board of Review',
      filing_deadline: '2026-08-01',
      steps: ['Submit the appeal form and evidence package.'],
      required_documents: ['Assessment notice', 'Comparable evidence'],
      tips: [],
    },
    ...overrides,
  });
}

const FIXED_NOW = new Date('2026-07-15T12:00:00.000Z');

describe('preflightReport', () => {
  it('accepts an evidence-backed report and permits non-blocking warnings', () => {
    const result = preflightReport(makeData(), FIXED_NOW);
    expect(result.ok).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'evidence.photos')).toBe(true);
  });

  it('blocks a report without any evidence-backed valuation approach', () => {
    const data = makeData({ comparableSales: [], incomeAnalysis: null });
    const result = preflightReport(data, FIXED_NOW);
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
    const result = preflightReport(data, FIXED_NOW);
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'narrative.raw_layout_markup', severity: 'error' })
    );
  });

  it('blocks model-authored headings so report components own hierarchy', () => {
    const data = makeData({
      narratives: [
        {
          section_name: 'market_analysis',
          content: '## Market Overview\n\nThe market evidence supports the conclusion.',
        } as ReportTemplateData['narratives'][number],
      ],
    });
    const result = preflightReport(data, FIXED_NOW);
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'narrative.model_heading', severity: 'error' })
    );
  });

  it('blocks model-authored Markdown tables so structured evidence owns tables', () => {
    const data = makeData({
      narratives: [
        {
          section_name: 'market_analysis',
          content: '| Metric | Value |\n| --- | ---: |\n| Vacancy | 7.5% |',
        } as ReportTemplateData['narratives'][number],
      ],
    });
    const result = preflightReport(data, FIXED_NOW);
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'narrative.model_table', severity: 'error' })
    );
  });

  it('permits bounded prose and lists while warning on overlong lists', () => {
    const items = Array.from({ length: 9 }, (_, index) => `- Evidence point ${index + 1}`).join('\n');
    const data = makeData({
      narratives: [
        {
          section_name: 'market_analysis',
          content: `The market analysis remains evidence grounded.\n\n${items}`,
        } as ReportTemplateData['narratives'][number],
      ],
    });
    const result = preflightReport(data, FIXED_NOW);
    expect(result.ok).toBe(true);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'narrative.long_list', severity: 'warning' })
    );
  });

  it('requires both a jurisdiction package and filing guide for tax-appeal delivery', () => {
    const data = makeData({
      report: {
        ...makeData().report,
        service_type: 'tax_appeal',
      },
    });
    const result = preflightReport(data, FIXED_NOW);
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'jurisdiction.rules', severity: 'error' }),
        expect.objectContaining({ code: 'appeal.filing_guide', severity: 'error' }),
      ])
    );
  });

  it('accepts a current, active, jurisdiction-matched tax-appeal package', () => {
    const result = preflightReport(makeValidTaxAppealData(), FIXED_NOW);
    expect(result.ok).toBe(true);
  });

  it('blocks stale jurisdiction intelligence', () => {
    const data = makeValidTaxAppealData({
      countyRule: {
        ...makeValidTaxAppealData().countyRule!,
        last_verified_date: '2025-01-01',
      },
    });
    const result = preflightReport(data, FIXED_NOW);
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'jurisdiction.stale', severity: 'error' })
    );
  });

  it('blocks a county-rule FIPS mismatch', () => {
    const data = makeValidTaxAppealData({
      countyRule: {
        ...makeValidTaxAppealData().countyRule!,
        county_fips: '17003',
      },
    });
    const result = preflightReport(data, FIXED_NOW);
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'jurisdiction.fips_mismatch', severity: 'error' })
    );
  });

  it('blocks an incomplete filing guide', () => {
    const data = makeValidTaxAppealData({
      filingGuide: {
        appeal_board_name: 'Example Board of Review',
        filing_deadline: '',
        steps: [],
        required_documents: [],
        tips: [],
      },
    });
    const result = preflightReport(data, FIXED_NOW);
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'appeal.deadline', severity: 'error' }),
        expect.objectContaining({ code: 'appeal.filing_steps', severity: 'error' }),
        expect.objectContaining({ code: 'appeal.required_documents', severity: 'error' }),
      ])
    );
  });

  it('blocks duplicate narrative section identities', () => {
    const narrative = {
      section_name: 'market_analysis',
      content: 'Evidence-grounded market analysis.',
    } as ReportTemplateData['narratives'][number];
    const result = preflightReport(
      makeData({ narratives: [narrative, narrative] }),
      FIXED_NOW
    );
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'narrative.duplicate_section', severity: 'error' })
    );
  });
});
