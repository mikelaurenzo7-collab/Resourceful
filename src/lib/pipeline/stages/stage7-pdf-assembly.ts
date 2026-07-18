// ─── Stage 7: PDF Assembly ───────────────────────────────────────────────────
// Fetches all report data, validates release evidence and case profile, renders
// the authoritative React-PDF document, and publishes an immutable artifact pair.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ServiceType } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { generateReportPDF } from '@/lib/pdf';
import { fetchReportTemplateData } from '@/lib/pdf/fetch-report-data';
import {
  createReportArtifactManifest,
  serializeReportArtifactManifest,
} from '@/lib/pdf/report-artifact-manifest';
import { evaluateReportProfileCompleteness } from '@/lib/pdf/report-profile';
import { evaluateAssessmentContext } from '@/lib/valuation/assessment-context-policy';
import { evaluateCaseStrategy } from '@/lib/valuation/case-strategy-policy';
import {
  hasAnyCostApproachEvidence,
  type CostApproachEvidenceInput,
} from '@/lib/valuation/cost-approach-policy';
import { evaluateNationwideReportIntegrity } from '@/lib/valuation/nationwide-report-integrity-policy';
import { evaluatePdfReleasePolicy } from '@/lib/valuation/pdf-release-policy';
import { supportsIncomeApproach } from '@/lib/valuation/property-type-policy';
import { evaluateReportConclusionIntegrity } from '@/lib/valuation/report-conclusion-integrity-policy';
import { evaluateTaxAppealRelease } from '@/lib/valuation/tax-appeal-release-policy';
import { getClassificationSourceEvidence } from '@/lib/valuation/workfile-provenance';
import { pipelineLogger } from '@/lib/logger';

function effectiveServiceType(
  assignmentKind: 'tax_appeal' | 'pre_purchase' | 'pre_listing' | 'independent_valuation'
): ServiceType {
  if (assignmentKind === 'tax_appeal') return 'tax_appeal';
  if (assignmentKind === 'pre_listing') return 'pre_listing';
  return 'pre_purchase';
}

function uniqueMessages(messages: string[]): string[] {
  return [...new Set(messages)];
}

async function rollbackArtifacts(
  supabase: SupabaseClient<Database>,
  paths: string[]
): Promise<string | null> {
  try {
    const { error } = await supabase.storage.from('reports').remove(paths);
    if (!error) return null;

    pipelineLogger.error(
      { paths, error: error.message },
      '[stage7] Failed to roll back partially published report artifacts'
    );
    return error.message;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pipelineLogger.error(
      { paths, error: message },
      '[stage7] Report artifact rollback threw unexpectedly'
    );
    return message;
  }
}

export async function runPdfAssembly(
  reportId: string,
  supabase: SupabaseClient<Database>
): Promise<StageResult> {
  const templateData = await fetchReportTemplateData(reportId, supabase);

  if (!templateData) {
    return { success: false, error: 'Failed to fetch report data for PDF assembly' };
  }

  const qaIssues: string[] = [];
  const hardFails: string[] = [];
  const profileAssessment = evaluateReportProfileCompleteness(templateData);
  const releaseServiceType = effectiveServiceType(profileAssessment.profile.assignmentKind);
  const classificationSource = getClassificationSourceEvidence(templateData);
  qaIssues.push(...profileAssessment.warnings, ...profileAssessment.hardFailures);
  hardFails.push(...profileAssessment.hardFailures);

  const propertySupportsIncomeApproach = supportsIncomeApproach({
    propertyType: templateData.report.property_type,
    propertySubtype: templateData.property.property_subtype,
    propertyClassDescription: templateData.property.property_class_description,
  });
  const costApproachInput: CostApproachEvidenceInput = {
    replacementCostNew: templateData.property.cost_approach_rcn,
    concludedValue: templateData.property.cost_approach_value,
    physicalDepreciationPct: templateData.property.physical_depreciation_pct,
    functionalObsolescencePct: templateData.property.functional_obsolescence_pct,
    landValue: templateData.property.land_value,
    replacementCostSourceAuthority: templateData.property.cost_replacement_source_authority,
    depreciationSourceAuthority: templateData.property.cost_depreciation_source_authority,
    landValueSourceAuthority: templateData.property.cost_land_source_authority,
    sourceReferences: templateData.property.cost_source_references,
    methodology: templateData.property.cost_methodology,
    costEffectiveDate: templateData.property.cost_effective_date,
    expectedEffectiveDate: templateData.valuationDate,
    verificationState: templateData.property.cost_verification_state,
    verifiedBy: templateData.property.cost_verified_by,
    verifiedAt: templateData.property.cost_verified_at,
  };

  const valuationRelease = evaluatePdfReleasePolicy({
    comparableSaleCount: templateData.comparableSales?.length ?? 0,
    concludedValue: templateData.concludedValue,
    incomeApproach: templateData.incomeAnalysis
      ? {
          supportedForProperty: propertySupportsIncomeApproach,
          netOperatingIncome: templateData.incomeAnalysis.net_operating_income,
          concludedCapRate: templateData.incomeAnalysis.concluded_cap_rate,
          concludedValue: templateData.incomeAnalysis.concluded_value_income_approach,
          comparableRentalCount: templateData.comparableRentals?.length ?? 0,
          investorSurveyReference: templateData.incomeAnalysis.investor_survey_reference,
        }
      : null,
    costApproach: hasAnyCostApproachEvidence(costApproachInput)
      ? costApproachInput
      : null,
  });

  qaIssues.push(...valuationRelease.warnings, ...valuationRelease.hardFailures);
  hardFails.push(...valuationRelease.hardFailures);

  const jurisdictionRelease = evaluateTaxAppealRelease({
    serviceType: releaseServiceType,
    reportCountyFips: templateData.report.county_fips,
    reportState: templateData.report.state_abbreviation ?? templateData.report.state,
    countyRule: templateData.countyRule,
    filingGuide: templateData.filingGuide,
  });

  if (!jurisdictionRelease.allowed) {
    qaIssues.push(jurisdictionRelease.message);
    hardFails.push(jurisdictionRelease.message);
  }

  const assessmentContext = evaluateAssessmentContext({
    serviceType: releaseServiceType,
    countyFips: templateData.report.county_fips,
    propertyType: templateData.report.property_type,
    taxYearInAppeal: templateData.property.tax_year_in_appeal,
    valuationDate: templateData.valuationDate,
    assessmentRatio: templateData.property.assessment_ratio,
    assessmentMethodology: templateData.property.assessment_methodology,
    propertyClassDescription: templateData.property.property_class_description,
    classificationSourceAuthority: classificationSource.authority,
    classificationSourceUrl: classificationSource.url,
    countyRule: templateData.countyRule,
  });
  qaIssues.push(...assessmentContext.warnings, ...assessmentContext.hardFailures);
  hardFails.push(...assessmentContext.hardFailures);

  const caseStrategy = evaluateCaseStrategy(templateData);
  qaIssues.push(...caseStrategy.warnings, ...caseStrategy.hardFailures);
  hardFails.push(...caseStrategy.hardFailures);

  const nationwideIntegrity = evaluateNationwideReportIntegrity(templateData);
  qaIssues.push(...nationwideIntegrity.warnings, ...nationwideIntegrity.hardFailures);
  hardFails.push(...nationwideIntegrity.hardFailures);

  const conclusionIntegrity = evaluateReportConclusionIntegrity(templateData);
  qaIssues.push(...conclusionIntegrity.warnings, ...conclusionIntegrity.hardFailures);
  hardFails.push(...conclusionIntegrity.hardFailures);

  if (!templateData.property.building_sqft_living_area && !templateData.property.lot_size_sqft) {
    qaIssues.push('No square footage data (building or lot)');
  }

  const uniqueQaIssues = uniqueMessages(qaIssues);
  const uniqueHardFails = uniqueMessages(hardFails);

  if (uniqueQaIssues.length > 0) {
    pipelineLogger.warn(
      {
        reportId,
        reportProfile: profileAssessment.profile.id,
        assignmentKind: profileAssessment.profile.assignmentKind,
        releaseServiceType,
        caseStrategyFlags: caseStrategy.flags,
        recentSubjectSaleDate: caseStrategy.recentSubjectSaleDate,
        nationwideIntegrity,
        conclusionIntegrity,
        qaIssues: uniqueQaIssues,
        jurisdictionRelease,
        assessmentContext,
        incomeAssessment: valuationRelease.incomeAssessment,
        costAssessment: valuationRelease.costAssessment,
        evidenceBackedAlternatives: valuationRelease.evidenceBackedAlternatives,
        concludedValue: templateData.concludedValue,
        conclusionReconcilesToAlternative: valuationRelease.conclusionReconcilesToAlternative,
      },
      '[stage7] QA pre-flight findings'
    );
  }

  if (uniqueHardFails.length > 0) {
    return { success: false, error: `QA pre-flight failed: ${uniqueHardFails.join('; ')}` };
  }

  pipelineLogger.info(
    {
      reportId,
      reportProfile: profileAssessment.profile.id,
      assignmentKind: profileAssessment.profile.assignmentKind,
      caseStrategyFlags: caseStrategy.flags,
      nationwideIntegrityWarningCodes: nationwideIntegrity.warningCodes,
      conclusionIntegrityWarningCodes: conclusionIntegrity.warningCodes,
    },
    '[stage7] Rendering case-specific PDF report ...'
  );

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateReportPDF(templateData);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `PDF generation failed: ${message}` };
  }

  const generatedAt = new Date().toISOString();
  const manifest = createReportArtifactManifest({
    data: templateData,
    pdfBuffer,
    generatedAt,
    valuationRelease,
    jurisdictionRelease,
  });
  const manifestBuffer = serializeReportArtifactManifest(manifest);
  const { pdfPath, manifestPath } = manifest.artifact;

  const { error: pdfUploadError } = await supabase
    .storage
    .from('reports')
    .upload(pdfPath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (pdfUploadError) {
    return {
      success: false,
      error: `Failed to upload immutable PDF artifact: ${pdfUploadError.message}`,
    };
  }

  const { error: manifestUploadError } = await supabase
    .storage
    .from('reports')
    .upload(manifestPath, manifestBuffer, {
      contentType: 'application/json; charset=utf-8',
      upsert: false,
    });

  if (manifestUploadError) {
    const rollbackError = await rollbackArtifacts(supabase, [pdfPath]);
    return {
      success: false,
      error: [
        `Failed to upload report artifact manifest: ${manifestUploadError.message}`,
        rollbackError ? `Rollback also failed: ${rollbackError}` : null,
      ].filter(Boolean).join('; '),
    };
  }

  const { error: reportUpdateError } = await supabase
    .from('reports')
    .update({
      report_pdf_storage_path: pdfPath,
      notification_sent_at: null,
    })
    .eq('id', reportId);

  if (reportUpdateError) {
    const rollbackError = await rollbackArtifacts(supabase, [pdfPath, manifestPath]);
    return {
      success: false,
      error: [
        `Failed to update report after artifact publication: ${reportUpdateError.message}`,
        rollbackError ? `Rollback also failed: ${rollbackError}` : null,
      ].filter(Boolean).join('; '),
    };
  }

  pipelineLogger.info(
    {
      reportId,
      reportProfile: profileAssessment.profile.id,
      assignmentKind: profileAssessment.profile.assignmentKind,
      caseStrategyFlags: caseStrategy.flags,
      nationwideIntegrityWarningCodes: nationwideIntegrity.warningCodes,
      conclusionIntegrityWarningCodes: conclusionIntegrity.warningCodes,
      sizeKB: (pdfBuffer.length / 1024).toFixed(0),
      pdfSha256: manifest.artifact.sha256,
      jurisdictionReleaseCode: jurisdictionRelease.code,
      pdfPath,
      manifestPath,
    },
    '[stage7] Immutable PDF and manifest published'
  );

  return { success: true };
}
