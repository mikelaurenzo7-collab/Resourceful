import { describe, expect, it } from 'vitest';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import type { ReportPreflightResult } from './report-preflight';
import { buildReportArtifactManifest } from './report-manifest';

function makeData(overrides: Partial<ReportTemplateData> = {}): ReportTemplateData {
  return {
    report: {
      id: 'report-1',
      property_address: '123 Main St',
      city: 'Example',
      state: 'IL',
      state_abbreviation: 'IL',
      county: 'Example County',
      county_fips: '17001',
      service_type: 'pre_purchase',
      property_type: 'residential',
      review_tier: 'expert_reviewed',
    } as ReportTemplateData['report'],
    property: {
      building_sqft_gross: 1000,
      building_sqft_living_area: null,
      cost_approach_value: null,
    } as ReportTemplateData['property'],
    photos: [
      { storage_path: 'subject/front.jpg' } as ReportTemplateData['photos'][number],
    ],
    comparableSales: [
      {
        address: '125 Main St',
        sale_price: 250000,
        sale_date: '2026-01-01',
      } as ReportTemplateData['comparableSales'][number],
    ],
    comparableRentals: [],
    incomeAnalysis: null,
    narratives: [
      {
        section_name: 'market_analysis',
        content: 'Evidence-grounded market analysis.',
        model_used: 'gpt-5.6',
      } as ReportTemplateData['narratives'][number],
    ],
    countyRule: null,
    maps: {
      regional: { url: 'regional.png', caption: 'Regional map' },
    },
    filingGuide: null,
    concludedValue: 250000,
    valuationDate: '2026-01-01',
    reportDate: '2026-01-15',
    ...overrides,
  };
}

function makeTaxAppealData(
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

const preflight: ReportPreflightResult = {
  ok: true,
  issues: [
    {
      code: 'evidence.photos',
      severity: 'warning',
      message: 'Example warning',
    },
  ],
};

const GENERATED_AT = new Date('2026-07-15T12:00:00.000Z');

describe('buildReportArtifactManifest', () => {
  it('records artifact identity, evidence counts, validation, and a stable PDF hash', () => {
    const pdf = Buffer.from('resourceful-pdf-fixture');
    const manifest = buildReportArtifactManifest(makeData(), preflight, pdf, GENERATED_AT);

    expect(manifest.generatedAt).toBe('2026-07-15T12:00:00.000Z');
    expect(manifest.report.id).toBe('report-1');
    expect(manifest.evidence).toMatchObject({
      subjectPhotos: 1,
      comparableSales: 1,
      comparableRentals: 0,
      narratives: 1,
      maps: 1,
      aiModelsUsed: ['gpt-5.6'],
    });
    expect(manifest.validation).toMatchObject({
      passed: true,
      errorCount: 0,
      warningCount: 1,
    });
    expect(manifest.pdf.byteLength).toBe(pdf.byteLength);
    expect(manifest.pdf.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(
      buildReportArtifactManifest(makeData(), preflight, pdf, GENERATED_AT).pdf.sha256
    ).toBe(manifest.pdf.sha256);
  });

  it('classifies a current active tax-appeal jurisdiction package as verified', () => {
    const manifest = buildReportArtifactManifest(
      makeTaxAppealData(),
      { ok: true, issues: [] },
      Buffer.from('pdf'),
      GENERATED_AT
    );

    expect(manifest.jurisdiction.coverageStatus).toBe('verified');
    expect(manifest.jurisdiction.filingGuideAttached).toBe(true);
  });

  it('classifies an old jurisdiction verification as stale', () => {
    const data = makeTaxAppealData({
      countyRule: {
        ...makeTaxAppealData().countyRule!,
        last_verified_date: '2025-01-01',
      },
    });

    const manifest = buildReportArtifactManifest(
      data,
      { ok: true, issues: [] },
      Buffer.from('pdf'),
      GENERATED_AT
    );

    expect(manifest.jurisdiction.coverageStatus).toBe('stale');
  });

  it('never labels a FIPS-mismatched jurisdiction package as verified', () => {
    const data = makeTaxAppealData({
      countyRule: {
        ...makeTaxAppealData().countyRule!,
        county_fips: '17003',
      },
    });

    const manifest = buildReportArtifactManifest(
      data,
      { ok: true, issues: [] },
      Buffer.from('pdf'),
      GENERATED_AT
    );

    expect(manifest.jurisdiction.coverageStatus).toBe('unsupported');
  });

  it('classifies incomplete appeal delivery intelligence as partial', () => {
    const manifest = buildReportArtifactManifest(
      makeTaxAppealData(),
      {
        ok: false,
        issues: [
          {
            code: 'appeal.deadline',
            severity: 'error',
            message: 'The filing guide must state the applicable filing deadline.',
          },
        ],
      },
      Buffer.from('pdf'),
      GENERATED_AT
    );

    expect(manifest.jurisdiction.coverageStatus).toBe('partial');
    expect(manifest.validation.passed).toBe(false);
  });

  it('does not accept a future jurisdiction verification date', () => {
    const data = makeTaxAppealData({
      countyRule: {
        ...makeTaxAppealData().countyRule!,
        last_verified_date: '2027-01-01',
      },
    });

    const manifest = buildReportArtifactManifest(
      data,
      { ok: true, issues: [] },
      Buffer.from('pdf'),
      GENERATED_AT
    );

    expect(manifest.jurisdiction.coverageStatus).toBe('partial');
  });
});
