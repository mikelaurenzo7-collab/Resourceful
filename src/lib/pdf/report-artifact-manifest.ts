import { createHash } from 'node:crypto';

import { AI_MODELS } from '@/config/ai';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import type { PdfReleasePolicyResult } from '@/lib/valuation/pdf-release-policy';

export const REPORT_MANIFEST_SCHEMA_VERSION = '1.0.0';
export const REPORT_RENDERER_VERSION = 'react-pdf-1';

export interface ReportArtifactPaths {
  pdfPath: string;
  manifestPath: string;
}

export interface ReportArtifactManifest {
  schemaVersion: string;
  rendererVersion: string;
  generatedAt: string;
  report: {
    id: string;
    serviceType: string;
    propertyType: string;
    reviewTier: string;
  };
  jurisdiction: {
    reportCountyFips: string | null;
    ruleCountyFips: string | null;
    reportState: string | null;
    ruleState: string | null;
    ruleLastVerifiedDate: string | null;
  };
  evidence: {
    comparableSales: number;
    comparableRentals: number;
    photos: number;
    narratives: number;
    filingGuideIncluded: boolean;
    incomeApproachReleaseReady: boolean;
  };
  valuation: {
    concludedValue: number;
    evidenceBackedAlternatives: Array<{ label: string; value: number }>;
    warnings: string[];
  };
  models: {
    primary: string;
    research: string;
    vision: string;
    document: string;
  };
  artifact: {
    sha256: string;
    bytes: number;
    pdfPath: string;
    manifestPath: string;
  };
}

function compactTimestamp(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error('Report artifact generation time must be a valid date');
  }

  return parsed.toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
}

export function hashPdfBuffer(pdfBuffer: Buffer): string {
  return createHash('sha256').update(pdfBuffer).digest('hex');
}

export function buildReportArtifactPaths(
  reportId: string,
  generatedAt: string,
  pdfSha256: string
): ReportArtifactPaths {
  const normalizedReportId = reportId.trim();
  if (!normalizedReportId) {
    throw new Error('Report ID is required to build artifact paths');
  }
  if (!/^[a-f0-9]{64}$/i.test(pdfSha256)) {
    throw new Error('PDF SHA-256 must be a 64-character hexadecimal value');
  }

  const releaseId = `${compactTimestamp(generatedAt)}_${pdfSha256.slice(0, 16).toLowerCase()}`;
  const releaseRoot = `${normalizedReportId}/releases/${releaseId}`;

  return {
    pdfPath: `${releaseRoot}.pdf`,
    manifestPath: `${releaseRoot}.manifest.json`,
  };
}

export function createReportArtifactManifest(input: {
  data: ReportTemplateData;
  pdfBuffer: Buffer;
  generatedAt: string;
  valuationRelease: PdfReleasePolicyResult;
}): ReportArtifactManifest {
  const { data, pdfBuffer, generatedAt, valuationRelease } = input;
  const sha256 = hashPdfBuffer(pdfBuffer);
  const paths = buildReportArtifactPaths(data.report.id, generatedAt, sha256);

  return {
    schemaVersion: REPORT_MANIFEST_SCHEMA_VERSION,
    rendererVersion: REPORT_RENDERER_VERSION,
    generatedAt: new Date(generatedAt).toISOString(),
    report: {
      id: data.report.id,
      serviceType: data.report.service_type,
      propertyType: data.report.property_type,
      reviewTier: data.report.review_tier,
    },
    jurisdiction: {
      reportCountyFips: data.report.county_fips,
      ruleCountyFips: data.countyRule?.county_fips ?? null,
      reportState: data.report.state_abbreviation ?? data.report.state,
      ruleState: data.countyRule?.state_abbreviation ?? null,
      ruleLastVerifiedDate: data.countyRule?.last_verified_date ?? null,
    },
    evidence: {
      comparableSales: data.comparableSales.length,
      comparableRentals: data.comparableRentals.length,
      photos: data.photos.length,
      narratives: data.narratives.length,
      filingGuideIncluded: data.filingGuide != null,
      incomeApproachReleaseReady: valuationRelease.incomeAssessment?.isReleaseReady === true,
    },
    valuation: {
      concludedValue: data.concludedValue,
      evidenceBackedAlternatives: valuationRelease.evidenceBackedAlternatives.map((approach) => ({
        label: approach.label,
        value: approach.value,
      })),
      warnings: [...valuationRelease.warnings],
    },
    models: {
      primary: AI_MODELS.PRIMARY,
      research: AI_MODELS.RESEARCH,
      vision: AI_MODELS.VISION,
      document: AI_MODELS.DOCUMENT,
    },
    artifact: {
      sha256,
      bytes: pdfBuffer.byteLength,
      pdfPath: paths.pdfPath,
      manifestPath: paths.manifestPath,
    },
  };
}

export function serializeReportArtifactManifest(manifest: ReportArtifactManifest): Buffer {
  return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}
