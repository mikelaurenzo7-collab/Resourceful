import { createHash } from 'node:crypto';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import type { ReportPreflightResult } from './report-preflight';

export const REPORT_MANIFEST_VERSION = '1.0.0';
export const REPORT_SCHEMA_VERSION = 'resourceful-report-v1';
export const REPORT_RENDERER_VERSION = 'react-pdf-v1';

export type JurisdictionCoverageStatus =
  | 'not_applicable'
  | 'verified'
  | 'stale'
  | 'partial'
  | 'unsupported';

export interface ReportArtifactManifest {
  manifestVersion: string;
  reportSchemaVersion: string;
  renderer: {
    engine: '@react-pdf/renderer';
    version: string;
  };
  generatedAt: string;
  report: {
    id: string;
    serviceType: string;
    propertyType: string;
    reviewTier: string;
    propertyAddress: string;
    city: string | null;
    state: string | null;
    county: string | null;
    countyFips: string | null;
    valuationDate: string;
    reportDate: string;
    concludedValue: number;
  };
  jurisdiction: {
    coverageStatus: JurisdictionCoverageStatus;
    countyRuleAttached: boolean;
    countyRuleFips: string | null;
    countyRuleLastVerifiedDate: string | null;
    countyRuleActive: boolean | null;
    filingGuideAttached: boolean;
  };
  evidence: {
    subjectPhotos: number;
    comparableSales: number;
    comparableRentals: number;
    narratives: number;
    maps: number;
    incomeApproachAttached: boolean;
    costApproachAttached: boolean;
    aiModelsUsed: string[];
  };
  validation: {
    passed: boolean;
    errorCount: number;
    warningCount: number;
    issues: ReportPreflightResult['issues'];
  };
  pdf: {
    byteLength: number;
    sha256: string;
  };
}

const VERIFIED_RULE_MAX_AGE_DAYS = 180;

function resolveJurisdictionCoverage(
  data: ReportTemplateData,
  generatedAt: Date
): JurisdictionCoverageStatus {
  if (data.report.service_type !== 'tax_appeal') return 'not_applicable';

  const rule = data.countyRule;
  if (!rule || !rule.is_active) return 'unsupported';
  if (!rule.last_verified_date) return 'partial';

  const verifiedAt = new Date(rule.last_verified_date);
  if (Number.isNaN(verifiedAt.getTime())) return 'partial';

  const ageDays = Math.floor(
    (generatedAt.getTime() - verifiedAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  return ageDays > VERIFIED_RULE_MAX_AGE_DAYS ? 'stale' : 'verified';
}

export function buildReportArtifactManifest(
  data: ReportTemplateData,
  preflight: ReportPreflightResult,
  pdfBuffer: Buffer,
  generatedAt: Date = new Date()
): ReportArtifactManifest {
  const aiModelsUsed = Array.from(
    new Set(
      data.narratives
        .map((narrative) => narrative.model_used)
        .filter((model): model is string => typeof model === 'string' && model.trim().length > 0)
    )
  ).sort();

  const mapCount = [data.maps.regional, data.maps.neighborhood, data.maps.parcel]
    .filter(Boolean)
    .length;

  const errorCount = preflight.issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = preflight.issues.filter((issue) => issue.severity === 'warning').length;

  return {
    manifestVersion: REPORT_MANIFEST_VERSION,
    reportSchemaVersion: REPORT_SCHEMA_VERSION,
    renderer: {
      engine: '@react-pdf/renderer',
      version: REPORT_RENDERER_VERSION,
    },
    generatedAt: generatedAt.toISOString(),
    report: {
      id: data.report.id,
      serviceType: data.report.service_type,
      propertyType: data.report.property_type,
      reviewTier: data.report.review_tier,
      propertyAddress: data.report.property_address,
      city: data.report.city,
      state: data.report.state,
      county: data.report.county,
      countyFips: data.report.county_fips,
      valuationDate: data.valuationDate,
      reportDate: data.reportDate,
      concludedValue: data.concludedValue,
    },
    jurisdiction: {
      coverageStatus: resolveJurisdictionCoverage(data, generatedAt),
      countyRuleAttached: data.countyRule != null,
      countyRuleFips: data.countyRule?.county_fips ?? null,
      countyRuleLastVerifiedDate: data.countyRule?.last_verified_date ?? null,
      countyRuleActive: data.countyRule?.is_active ?? null,
      filingGuideAttached: data.filingGuide != null,
    },
    evidence: {
      subjectPhotos: data.photos.filter((photo) => photo.storage_path.trim().length > 0).length,
      comparableSales: data.comparableSales.length,
      comparableRentals: data.comparableRentals.length,
      narratives: data.narratives.length,
      maps: mapCount,
      incomeApproachAttached: data.incomeAnalysis != null,
      costApproachAttached:
        typeof data.property.cost_approach_value === 'number' &&
        Number.isFinite(data.property.cost_approach_value) &&
        data.property.cost_approach_value > 0,
      aiModelsUsed,
    },
    validation: {
      passed: preflight.ok,
      errorCount,
      warningCount,
      issues: preflight.issues,
    },
    pdf: {
      byteLength: pdfBuffer.byteLength,
      sha256: createHash('sha256').update(pdfBuffer).digest('hex'),
    },
  };
}
