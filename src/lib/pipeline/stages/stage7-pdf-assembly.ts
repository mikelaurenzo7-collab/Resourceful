// ─── Stage 7: PDF Assembly ───────────────────────────────────────────────────
// Fetches all report data, validates release evidence, renders to PDF via
// @react-pdf/renderer, and publishes an immutable PDF/manifest artifact pair.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { generateReportPDF } from '@/lib/pdf';
import { fetchReportTemplateData } from '@/lib/pdf/fetch-report-data';
import {
  createReportArtifactManifest,
  serializeReportArtifactManifest,
} from '@/lib/pdf/report-artifact-manifest';
import { evaluatePdfReleasePolicy } from '@/lib/valuation/pdf-release-policy';
import { supportsIncomeApproach } from '@/lib/valuation/property-type-policy';
import { evaluateTaxAppealRelease } from '@/lib/valuation/tax-appeal-release-policy';
import { pipelineLogger } from '@/lib/logger';

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
  const propertySupportsIncomeApproach = supportsIncomeApproach({
    propertyType: templateData.report.property_type,
    propertySubtype: templateData.property.property_subtype,
    propertyClassDescription: templateData.property.property_class_description,
  });

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
    costApproach: {
      replacementCostNew: templateData.property.cost_approach_rcn,
      concludedValue: templateData.property.cost_approach_value,
      physicalDepreciationPct: templateData.property.physical_depreciation_pct,
    },
  });

  qaIssues.push(...valuationRelease.warnings, ...valuationRelease.hardFailures);
  hardFails.push(...valuationRelease.hardFailures);

  const jurisdictionRelease = evaluateTaxAppealRelease({
    serviceType: templateData.report.service_type,
    reportCountyFips: templateData.report.county_fips,
    reportState: templateData.report.state_abbreviation ?? templateData.report.state,
    countyRule: templateData.countyRule,
    filingGuide: templateData.filingGuide,
  });

  if (!jurisdictionRelease.allowed) {
    qaIssues.push(jurisdictionRelease.message);
    hardFails.push(jurisdictionRelease.message);
  }

  const isTaxAppeal = templateData.report.service_type === 'tax_appeal';
  const criticalSections = isTaxAppeal
    ? ['executive_summary', 'appeal_argument_summary']
    : ['executive_summary'];
  const existingSections = new Set(templateData.narratives.map((n) => n.section_name));
  for (const section of criticalSections) {
    if (!existingSections.has(section)) {
      const issue = `Missing critical narrative: ${section}`;
      qaIssues.push(issue);
      hardFails.push(issue);
    }
  }

  if (!templateData.property.building_sqft_living_area && !templateData.property.lot_size_sqft) {
    qaIssues.push('No square footage data (building or lot)');
  }

  if (qaIssues.length > 0) {
    pipelineLogger.warn(
      {
        reportId,
        qaIssues,
        jurisdictionRelease,
        incomeAssessment: valuationRelease.incomeAssessment,
        evidenceBackedAlternatives: valuationRelease.evidenceBackedAlternatives,
        concludedValue: templateData.concludedValue,
        conclusionReconcilesToAlternative: valuationRelease.conclusionReconcilesToAlternative,
      },
      '[stage7] QA pre-flight warnings'
    );
  }

  if (hardFails.length > 0) {
    return { success: false, error: `QA pre-flight failed: ${hardFails.join('; ')}` };
  }

  pipelineLogger.info({ reportId }, '[stage7] Rendering PDF for report ...');

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
      // A new immutable artifact requires its own delivery notification. Never
      // let a prior release's receipt suppress retries for this release.
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
