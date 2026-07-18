import { createHash } from 'node:crypto';

import { AI_MODELS } from '@/config/ai';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import type { ServiceType } from '@/types/database';
import { buildReportProfile } from './report-profile';
import { evaluateAssessmentContext } from '@/lib/valuation/assessment-context-policy';
import { evaluateCaseStrategy, type CaseStrategyFlag } from '@/lib/valuation/case-strategy-policy';
import {
  evaluateNationwideReportIntegrity,
  type NationwideReportIntegrityCode,
} from '@/lib/valuation/nationwide-report-integrity-policy';
import type { PdfReleasePolicyResult } from '@/lib/valuation/pdf-release-policy';
import type { TaxAppealReleaseResult } from '@/lib/valuation/tax-appeal-release-policy';
import {
  getClassificationSourceEvidence,
  getJurisdictionPlugin,
  getValuationEffectiveDateEvidence,
  isRetrospectiveAssignment,
} from '@/lib/valuation/workfile-provenance';

export const REPORT_MANIFEST_SCHEMA_VERSION = '1.5.0';
export const REPORT_RENDERER_VERSION = 'react-pdf-2';

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
    profileId: string;
    documentTitle: string;
    narrativeSections: string[];
  };
  jurisdiction: {
    reportCountyFips: string | null;
    ruleCountyFips: string | null;
    reportState: string | null;
    ruleState: string | null;
    ruleLastVerifiedDate: string | null;
    pluginKey: string | null;
    pluginVersion: number | null;
    releaseReady: boolean;
    releaseCode: string;
    assessmentYear: number | null;
    valuationDate: string;
    valuationDateSource: string | null;
    appliedAssessmentRatio: number | null;
    expectedAssessmentRatio: number | null;
    classificationSourceVerified: boolean;
    requiresYearSpecificEqualizationSource: boolean;
  };
  strategy: {
    flags: CaseStrategyFlag[];
    isRetrospectiveAssignment: boolean;
    recentSubjectSaleDate: string | null;
    warnings: string[];
  };
  integrity: {
    releaseReady: boolean;
    warningCodes: NationwideReportIntegrityCode[];
    hardFailureCodes: NationwideReportIntegrityCode[];
  };
  evidence: {
    comparableSales: number;
    comparableRentals: number;
    photos: number;
    narratives: number;
    sourceBackedComparableSales: number;
    distressedComparableSales: number;
    filingGuideIncluded: boolean;
    incomeApproachReleaseReady: boolean;
    costApproachReleaseReady: boolean;
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

  return parsed.toISOString().replace(/[-:.]/g, '');
}

function effectiveServiceType(
  assignmentKind: 'tax_appeal' | 'pre_purchase' | 'pre_listing' | 'independent_valuation'
): ServiceType {
  if (assignmentKind === 'tax_appeal') return 'tax_appeal';
  if (assignmentKind === 'pre_listing') return 'pre_listing';
  return 'pre_purchase';
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
  jurisdictionRelease: TaxAppealReleaseResult;
}): ReportArtifactManifest {
  const {
    data,
    pdfBuffer,
    generatedAt,
    valuationRelease,
    jurisdictionRelease,
  } = input;
  const sha256 = hashPdfBuffer(pdfBuffer);
  const paths = buildReportArtifactPaths(data.report.id, generatedAt, sha256);
  const profile = buildReportProfile(data);
  const releaseServiceType = effectiveServiceType(profile.assignmentKind);
  const classificationSource = getClassificationSourceEvidence(data);
  const effectiveDateEvidence = getValuationEffectiveDateEvidence(data);
  const jurisdictionPlugin = getJurisdictionPlugin(data.countyRule);
  const costAssessment = valuationRelease.costAssessment;
  const assessmentContext = evaluateAssessmentContext({
    serviceType: releaseServiceType,
    countyFips: data.report.county_fips,
    propertyType: data.report.property_type,
    taxYearInAppeal: data.property.tax_year_in_appeal,
    valuationDate: data.valuationDate,
    assessmentRatio: data.property.assessment_ratio,
    assessmentMethodology: data.property.assessment_methodology,
    propertyClassDescription: data.property.property_class_description,
    classificationSourceAuthority: classificationSource.authority,
    classificationSourceUrl: classificationSource.url,
    countyRule: data.countyRule,
  });
  const caseStrategy = evaluateCaseStrategy(data);
  const nationwideIntegrity = evaluateNationwideReportIntegrity(data);
  const sourceBackedComparableSales = data.comparableSales.filter(
    (sale) => Boolean(sale.county_recorder_url?.trim() || sale.deed_document_number?.trim())
  ).length;
  const distressedComparableSales = data.comparableSales.filter(
    (sale) => sale.is_distressed_sale
  ).length;

  return {
    schemaVersion: REPORT_MANIFEST_SCHEMA_VERSION,
    rendererVersion: REPORT_RENDERER_VERSION,
    generatedAt: new Date(generatedAt).toISOString(),
    report: {
      id: data.report.id,
      serviceType: data.report.service_type,
      propertyType: data.report.property_type,
      reviewTier: data.report.review_tier,
      profileId: profile.id,
      documentTitle: profile.documentTitle,
      narrativeSections: profile.narrativeSections.map((section) => section.key),
    },
    jurisdiction: {
      reportCountyFips: data.report.county_fips,
      ruleCountyFips: data.countyRule?.county_fips ?? null,
      reportState: data.report.state_abbreviation ?? data.report.state,
      ruleState: data.countyRule?.state_abbreviation ?? null,
      ruleLastVerifiedDate: data.countyRule?.last_verified_date ?? null,
      pluginKey: jurisdictionPlugin?.key ?? null,
      pluginVersion: jurisdictionPlugin?.version ?? null,
      releaseReady: jurisdictionRelease.allowed,
      releaseCode: jurisdictionRelease.code,
      assessmentYear: data.property.tax_year_in_appeal,
      valuationDate: data.valuationDate,
      valuationDateSource: effectiveDateEvidence.source,
      appliedAssessmentRatio: assessmentContext.appliedAssessmentRatio,
      expectedAssessmentRatio: assessmentContext.expectedAssessmentRatio,
      classificationSourceVerified: classificationSource.isVerified,
      requiresYearSpecificEqualizationSource:
        assessmentContext.requiresYearSpecificEqualizationSource,
    },
    strategy: {
      flags: caseStrategy.flags,
      isRetrospectiveAssignment: isRetrospectiveAssignment(data),
      recentSubjectSaleDate: caseStrategy.recentSubjectSaleDate,
      warnings: [...caseStrategy.warnings],
    },
    integrity: {
      releaseReady: nationwideIntegrity.hardFailures.length === 0,
      warningCodes: [...nationwideIntegrity.warningCodes],
      hardFailureCodes: [...nationwideIntegrity.hardFailureCodes],
    },
    evidence: {
      comparableSales: data.comparableSales.length,
      comparableRentals: data.comparableRentals.length,
      photos: data.photos.length,
      narratives: data.narratives.length,
      sourceBackedComparableSales,
      distressedComparableSales,
      filingGuideIncluded: data.filingGuide != null,
      incomeApproachReleaseReady: valuationRelease.incomeAssessment?.isReleaseReady === true,
      costApproachReleaseReady: costAssessment?.isReleaseReady === true,
    },
    valuation: {
      concludedValue: data.concludedValue,
      evidenceBackedAlternatives: valuationRelease.evidenceBackedAlternatives.map((approach) => ({
        label: approach.label,
        value: approach.value,
      })),
      warnings: [
        ...valuationRelease.warnings,
        ...assessmentContext.warnings,
        ...(costAssessment?.warnings ?? []),
        ...caseStrategy.warnings,
        ...nationwideIntegrity.warnings,
      ],
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
