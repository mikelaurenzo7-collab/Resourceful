// ─── Stage 7: PDF Assembly ───────────────────────────────────────────────────
// Fetches all report data, renders to PDF via @react-pdf/renderer, uploads to
// Supabase Storage, and sets status to pending_approval.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { generateReportPDF } from '@/lib/pdf';
import { fetchReportTemplateData } from '@/lib/pdf/fetch-report-data';
import { evaluatePdfReleasePolicy } from '@/lib/valuation/pdf-release-policy';
import { pipelineLogger } from '@/lib/logger';

// ─── Stage Entry Point ──────────────────────────────────────────────────────

export async function runPdfAssembly(
  reportId: string,
  supabase: SupabaseClient<Database>
): Promise<StageResult> {
  // ── Fetch all report data ────────────────────────────────────────────
  const templateData = await fetchReportTemplateData(reportId, supabase);

  if (!templateData) {
    return { success: false, error: 'Failed to fetch report data for PDF assembly' };
  }

  // ── QA Pre-flight Checks ──────────────────────────────────────────────
  const qaIssues: string[] = [];
  const hardFails: string[] = [];

  const valuationRelease = evaluatePdfReleasePolicy({
    comparableSaleCount: templateData.comparableSales?.length ?? 0,
    concludedValue: templateData.concludedValue,
    incomeApproach: templateData.incomeAnalysis
      ? {
          netOperatingIncome: templateData.incomeAnalysis.net_operating_income,
          concludedCapRate: templateData.incomeAnalysis.concluded_cap_rate,
          concludedValue: templateData.incomeAnalysis.concluded_value_income_approach,
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

  // appeal_argument_summary and filingGuide are only required for tax_appeal reports
  const isTaxAppeal = templateData.report.service_type === 'tax_appeal';
  const criticalSections = isTaxAppeal
    ? ['executive_summary', 'appeal_argument_summary']
    : ['executive_summary'];
  const existingSections = new Set(templateData.narratives.map((n) => n.section_name));
  for (const section of criticalSections) {
    if (!existingSections.has(section)) {
      const issue = `Missing critical narrative: ${section}`;
      qaIssues.push(issue);
      if (section === 'executive_summary') hardFails.push(issue);
    }
  }

  if (isTaxAppeal && !templateData.filingGuide) {
    qaIssues.push('Filing guide not generated or failed to parse');
  }

  if (!templateData.property.building_sqft_living_area && !templateData.property.lot_size_sqft) {
    qaIssues.push('No square footage data (building or lot)');
  }

  if (qaIssues.length > 0) {
    pipelineLogger.warn(
      {
        reportId,
        qaIssues,
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

  // ── Generate PDF ─────────────────────────────────────────────────────
  pipelineLogger.info({ reportId }, '[stage7] Rendering PDF for report ...');

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateReportPDF(templateData);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `PDF generation failed: ${message}` };
  }

  // ── Upload to Supabase Storage ────────────────────────────────────────
  const shortId = reportId.split('-')[0];
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const storagePath = `${reportId}/report_${shortId}_${dateStr}.pdf`;

  const { error: uploadError } = await supabase
    .storage
    .from('reports')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    return {
      success: false,
      error: `Failed to upload PDF to storage: ${uploadError.message}`,
    };
  }

  // ── Update report ─────────────────────────────────────────────────────
  const { error: reportUpdateError } = await supabase
    .from('reports')
    .update({
      report_pdf_storage_path: storagePath,
    })
    .eq('id', reportId);

  if (reportUpdateError) {
    return { success: false, error: `Failed to update report after PDF upload: ${reportUpdateError.message}` };
  }

  // Admin notification is sent by the orchestrator after all stages complete.
  // Removed from stage7 to prevent duplicate emails.

  pipelineLogger.info(
    { reportId, sizeKB: (pdfBuffer.length / 1024).toFixed(0) },
    '[stage7] PDF assembled and uploaded'
  );

  return { success: true };
}
