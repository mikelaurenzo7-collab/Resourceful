import { describe, expect, it } from 'vitest';

import type { ReportTemplateData } from '@/lib/templates/report-template';
import type { PdfReleasePolicyResult } from '@/lib/valuation/pdf-release-policy';
import type { TaxAppealReleaseResult } from '@/lib/valuation/tax-appeal-release-policy';
import {
  createReportArtifactManifest,
  serializeReportArtifactManifest,
  type ReportArtifactManifest,
} from './report-artifact-manifest';
import {
  manifestPathForPdf,
  releaseKeyForPdfPath,
  verifyReportArtifact,
} from './report-artifact-verification';

const pdf = Buffer.from('%PDF-1.7 verified artifact');
const valuationRelease: PdfReleasePolicyResult = {
  hasComparableSales: true,
  hasConcludedValue: true,
  incomeAssessment: null,
  costAssessment: null,
  evidenceBackedAlternatives: [],
  conclusionReconcilesToAlternative: false,
  warnings: [],
  hardFailures: [],
};
const jurisdictionRelease: TaxAppealReleaseResult = {
  allowed: true,
  code: 'JURISDICTION_RELEASE_READY',
  message: 'ready',
  jurisdictionEvaluation: null,
};

function createData(): ReportTemplateData {
  return {
    report: {
      id: 'report-123',
      service_type: 'tax_appeal',
      desired_outcome: null,
      is_retrospective_assignment: false,
      valuation_effective_date: '2026-01-01',
      valuation_effective_date_source: 'jurisdiction_convention',
      created_at: '2026-01-15T00:00:00.000Z',
      property_type: 'residential',
      review_tier: 'expert_reviewed',
      county_fips: '17031',
      state: 'Illinois',
      state_abbreviation: 'IL',
    },
    property: {},
    comparableSales: [],
    comparableRentals: [],
    photos: [],
    narratives: [],
    countyRule: null,
    filingGuide: null,
    maps: {},
    incomeAnalysis: null,
    concludedValue: 425_000,
    valuationDate: '2026-01-01',
    reportDate: '2026-07-18',
  } as unknown as ReportTemplateData;
}

function createManifestJson(): string {
  return serializeReportArtifactManifest(
    createReportArtifactManifest({
      data: createData(),
      pdfBuffer: pdf,
      generatedAt: '2026-07-18T15:04:05.678Z',
      valuationRelease,
      jurisdictionRelease,
    })
  ).toString('utf8');
}

function parseManifest(manifestJson = createManifestJson()): ReportArtifactManifest {
  return JSON.parse(manifestJson) as ReportArtifactManifest;
}

function verify(manifestJson = createManifestJson(), pdfBuffer = pdf) {
  const parsed = parseManifest(manifestJson);
  return verifyReportArtifact({
    reportId: 'report-123',
    serviceType: 'tax_appeal',
    propertyType: 'residential',
    reviewTier: 'expert_reviewed',
    pdfPath: parsed.artifact.pdfPath,
    pdfBuffer,
    manifestJson,
  });
}

describe('verifyReportArtifact', () => {
  it('verifies an internally consistent PDF and manifest pair', () => {
    expect(verify()).toMatchObject({
      verified: true,
      code: 'REPORT_ARTIFACT_VERIFIED',
    });
  });

  it('derives the adjacent manifest path and immutable release key', () => {
    const path = 'report/releases/20260718T150405678Z_a1b2c3d4e5f60718.pdf';
    expect(manifestPathForPdf(path)).toBe(
      'report/releases/20260718T150405678Z_a1b2c3d4e5f60718.manifest.json'
    );
    expect(releaseKeyForPdfPath(path)).toBe('20260718T150405678Z_a1b2c3d4e5f60718');
    expect(() => manifestPathForPdf('report/releases/release.txt')).toThrow('.pdf storage path');
    expect(() => releaseKeyForPdfPath('report/releases/not safe.pdf')).toThrow('safe immutable release key');
  });

  it('rejects corrupted PDF bytes by length and hash', () => {
    expect(verify(createManifestJson(), Buffer.from('%PDF-corrupted'))).toMatchObject({
      verified: false,
      code: 'ARTIFACT_BYTE_LENGTH_MISMATCH',
    });

    const equalLengthCorruption = Buffer.from(pdf);
    equalLengthCorruption[equalLengthCorruption.length - 1] ^= 1;
    expect(verify(createManifestJson(), equalLengthCorruption)).toMatchObject({
      verified: false,
      code: 'ARTIFACT_HASH_MISMATCH',
    });
  });

  it('rejects report-contract, path, and jurisdiction contradictions', () => {
    const manifest = parseManifest();

    const wrongReport = structuredClone(manifest);
    wrongReport.report.id = 'report-other';
    expect(verify(JSON.stringify(wrongReport))).toMatchObject({ code: 'REPORT_ID_MISMATCH' });

    const wrongTier = structuredClone(manifest);
    wrongTier.report.reviewTier = 'auto';
    expect(verify(JSON.stringify(wrongTier))).toMatchObject({ code: 'REPORT_CONTRACT_MISMATCH' });

    const wrongPath = structuredClone(manifest);
    wrongPath.artifact.manifestPath = 'wrong.manifest.json';
    expect(verify(JSON.stringify(wrongPath))).toMatchObject({ code: 'ARTIFACT_PATH_MISMATCH' });

    const notReady = structuredClone(manifest);
    notReady.jurisdiction.releaseReady = false;
    expect(verify(JSON.stringify(notReady))).toMatchObject({ code: 'JURISDICTION_RELEASE_NOT_READY' });
  });

  it('rejects invalid JSON, unsupported schemas, and malformed 1.3/1.4 provenance', () => {
    const invalidJson = verifyReportArtifact({
      reportId: 'report-123',
      serviceType: 'tax_appeal',
      propertyType: 'residential',
      reviewTier: 'expert_reviewed',
      pdfPath: 'report-123/releases/release.pdf',
      pdfBuffer: pdf,
      manifestJson: '{',
    });
    expect(invalidJson.code).toBe('MANIFEST_JSON_INVALID');

    const manifest = parseManifest();
    manifest.schemaVersion = '2.0.0';
    expect(verify(JSON.stringify(manifest))).toMatchObject({ code: 'MANIFEST_SCHEMA_UNSUPPORTED' });

    const missingCostReadiness = structuredClone(parseManifest()) as unknown as Record<string, unknown>;
    const evidence = missingCostReadiness.evidence as Record<string, unknown>;
    delete evidence.costApproachReleaseReady;
    expect(verify(JSON.stringify(missingCostReadiness))).toMatchObject({
      code: 'MANIFEST_JSON_INVALID',
    });

    const missingDateSource = structuredClone(parseManifest()) as unknown as Record<string, unknown>;
    const jurisdiction = missingDateSource.jurisdiction as Record<string, unknown>;
    delete jurisdiction.valuationDateSource;
    expect(verify(JSON.stringify(missingDateSource))).toMatchObject({
      code: 'MANIFEST_JSON_INVALID',
    });

    const missingRetrospectiveFlag = structuredClone(parseManifest()) as unknown as Record<string, unknown>;
    const strategy = missingRetrospectiveFlag.strategy as Record<string, unknown>;
    delete strategy.isRetrospectiveAssignment;
    expect(verify(JSON.stringify(missingRetrospectiveFlag))).toMatchObject({
      code: 'MANIFEST_JSON_INVALID',
    });
  });
});
