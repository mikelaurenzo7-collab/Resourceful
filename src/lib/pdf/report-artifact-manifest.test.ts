import { describe, expect, it } from 'vitest';

import type { ReportTemplateData } from '@/lib/templates/report-template';
import type { PdfReleasePolicyResult } from '@/lib/valuation/pdf-release-policy';
import type { TaxAppealReleaseResult } from '@/lib/valuation/tax-appeal-release-policy';
import {
  buildReportArtifactPaths,
  createReportArtifactManifest,
  hashPdfBuffer,
  serializeReportArtifactManifest,
} from './report-artifact-manifest';

const valuationRelease: PdfReleasePolicyResult = {
  hasComparableSales: true,
  hasConcludedValue: true,
  incomeAssessment: null,
  evidenceBackedAlternatives: [],
  conclusionReconcilesToAlternative: false,
  warnings: ['Only 2 comparable sales (minimum 3 recommended)'],
  hardFailures: [],
};

const jurisdictionRelease: TaxAppealReleaseResult = {
  allowed: true,
  code: 'JURISDICTION_RELEASE_READY',
  message: 'The tax-appeal filing package matches the current verified jurisdiction record.',
  jurisdictionEvaluation: null,
};

function createData(): ReportTemplateData {
  return {
    report: {
      id: 'report-123',
      client_email: 'private@example.com',
      client_name: 'Private Customer',
      property_address: '123 Private Street',
      service_type: 'tax_appeal',
      property_type: 'residential',
      review_tier: 'expert_reviewed',
      county_fips: '17031',
      state: 'Illinois',
      state_abbreviation: 'IL',
    },
    property: {},
    comparableSales: [{ id: 'sale-1' }, { id: 'sale-2' }],
    comparableRentals: [],
    photos: [{ id: 'photo-1' }],
    narratives: [{ id: 'narrative-1' }],
    countyRule: {
      county_fips: '17031',
      state_abbreviation: 'IL',
      last_verified_date: '2026-07-01',
    },
    filingGuide: {
      appeal_board_name: 'Cook County Board of Review',
      filing_deadline: 'See current township schedule',
      steps: ['Prepare evidence'],
      required_documents: ['Assessment notice'],
      tips: [],
    },
    maps: {},
    incomeAnalysis: null,
    concludedValue: 425_000,
    valuationDate: '2026-01-01',
    reportDate: '2026-07-18',
  } as unknown as ReportTemplateData;
}

describe('report artifact manifest', () => {
  it('uses the PDF bytes to produce immutable release paths', () => {
    const pdf = Buffer.from('%PDF-1.7 deterministic bytes');
    const hash = hashPdfBuffer(pdf);
    const paths = buildReportArtifactPaths('report-123', '2026-07-18T15:04:05.678Z', hash);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(paths).toEqual({
      pdfPath: `report-123/releases/20260718T150405678Z_${hash.slice(0, 16)}.pdf`,
      manifestPath: `report-123/releases/20260718T150405678Z_${hash.slice(0, 16)}.manifest.json`,
    });
  });

  it('records structural provenance without customer PII or report prose', () => {
    const pdf = Buffer.from('%PDF-1.7 deterministic bytes');
    const manifest = createReportArtifactManifest({
      data: createData(),
      pdfBuffer: pdf,
      generatedAt: '2026-07-18T15:04:05.678Z',
      valuationRelease,
      jurisdictionRelease,
    });
    const serialized = serializeReportArtifactManifest(manifest).toString('utf8');

    expect(manifest.artifact.bytes).toBe(pdf.byteLength);
    expect(manifest.artifact.sha256).toBe(hashPdfBuffer(pdf));
    expect(manifest.evidence).toMatchObject({
      comparableSales: 2,
      comparableRentals: 0,
      photos: 1,
      narratives: 1,
      filingGuideIncluded: true,
    });
    expect(manifest.jurisdiction).toMatchObject({
      reportCountyFips: '17031',
      ruleCountyFips: '17031',
      reportState: 'IL',
      ruleState: 'IL',
      releaseReady: true,
      releaseCode: 'JURISDICTION_RELEASE_READY',
    });
    expect(serialized).not.toContain('private@example.com');
    expect(serialized).not.toContain('Private Customer');
    expect(serialized).not.toContain('123 Private Street');
    expect(serialized).not.toContain('Prepare evidence');
  });

  it('rejects malformed artifact identity inputs', () => {
    expect(() => buildReportArtifactPaths('', '2026-07-18T15:04:05.678Z', 'a'.repeat(64))).toThrow(
      'Report ID is required'
    );
    expect(() => buildReportArtifactPaths('report-123', 'not-a-date', 'a'.repeat(64))).toThrow(
      'valid date'
    );
    expect(() => buildReportArtifactPaths('report-123', '2026-07-18T15:04:05.678Z', 'not-a-hash')).toThrow(
      '64-character hexadecimal'
    );
  });
});
