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

describe('buildReportArtifactManifest', () => {
  it('records artifact identity, evidence counts, validation, and a stable PDF hash', () => {
    const pdf = Buffer.from('resourceful-pdf-fixture');
    const generatedAt = new Date('2026-07-15T12:00:00.000Z');
    const manifest = buildReportArtifactManifest(makeData(), preflight, pdf, generatedAt);

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
      buildReportArtifactManifest(makeData(), preflight, pdf, generatedAt).pdf.sha256
    ).toBe(manifest.pdf.sha256);
  });

  it('classifies a current active tax-appeal jurisdiction package as verified', () => {
    const data = makeData({
      report: {
        ...makeData().report,
        service_type: 'tax_appeal',
      },
      countyRule: {
        county_fips: '17001',
        is_active: true,
        last_verified_date: '2026-06-01',
      } as ReportTemplateData['countyRule'],
      filingGuide: {
        appeal_board_name: 'Example Board of Review',
        filing_deadline: '2026-08-01',
        steps: [],
        required_documents: [],
        tips: [],
      },
    });

    const manifest = buildReportArtifactManifest(
      data,
      { ok: true, issues: [] },
      Buffer.from('pdf'),
      new Date('2026-07-15T12:00:00.000Z')
    );

    expect(manifest.jurisdiction.coverageStatus).toBe('verified');
    expect(manifest.jurisdiction.filingGuideAttached).toBe(true);
  });

  it('classifies an old jurisdiction verification as stale', () => {
    const data = makeData({
      report: {
        ...makeData().report,
        service_type: 'tax_appeal',
      },
      countyRule: {
        county_fips: '17001',
        is_active: true,
        last_verified_date: '2025-01-01',
      } as ReportTemplateData['countyRule'],
    });

    const manifest = buildReportArtifactManifest(
      data,
      { ok: true, issues: [] },
      Buffer.from('pdf'),
      new Date('2026-07-15T12:00:00.000Z')
    );

    expect(manifest.jurisdiction.coverageStatus).toBe('stale');
  });
});
