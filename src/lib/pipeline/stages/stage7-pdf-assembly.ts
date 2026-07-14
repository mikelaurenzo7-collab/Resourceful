// ─── Stage 7: PDF Assembly ───────────────────────────────────────────────────
// Fetches all report data, renders to PDF via @react-pdf/renderer, uploads to
// Supabase Storage, and sets status to pending_approval.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { generateReportPDF } from '@/lib/pdf';
import { fetchReportTemplateData } from '@/lib/pdf/fetch-report-data';
import { pipelineLogger } from '@/lib/logger';

const ALTERNATIVE_APPROACH_RECONCILIATION_TOLERANCE = 0.35;

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

  const comparableSales = templateData.comparableSales ?? [];
  const hasComps = comparableSales.length > 0;
  const concludedValue = templateData.concludedValue ?? 0;
  const hasConcludedValue = concludedValue > 0;

  const incomeAnalysis = templateData.incomeAnalysis;
  const incomeValue = incomeAnalysis?.concluded_value_income_approach ?? 0;
  const hasIncomeApproach =
    (incomeAnalysis?.net_operating_income ?? 0) > 0 &&
    (incomeAnalysis?.concluded_cap_rate ?? 0) > 0 &&
    incomeValue > 0;

  const costValue = templateData.property.cost_approach_value ?? 0;
  const hasCostApproach =
    (templateData.property.cost_approach_rcn ?? 0) > 0 &&
    costValue > 0 &&
    templateData.property.physical_depreciation_pct != null;

  const evidenceBackedAlternatives = [
    hasIncomeApproach ? { label: 'income approach', value: incomeValue } : null,
    hasCostApproach ? { label: 'cost approach', value: costValue } : null,
  ].filter((approach): approach is { label: string; value: number } => approach != null);

  const conclusionReconcilesToAlternative =
    hasConcludedValue &&
    evidenceBackedAlternatives.some(({ value }) => {
      const minimum = value * (1 - ALTERNATIVE_APPROACH_RECONCILIATION_TOLERANCE);
      const maximum = value * (1 + ALTERNATIVE_APPROACH_RECONCILIATION_TOLERANCE);
      return concludedValue >= minimum && concludedValue <= maximum;
    });

  if (!hasComps) {
    if (evidenceBackedAlternatives.length === 0) {
      const issue = 'No evidence-backed valuation approach available';
      qaIssues.push(issue);
      hardFails.push(issue);
    } else if (!conclusionReconcilesToAlternative) {
      const issue = 'Concluded value is not reconciled to the available income or cost evidence';
      qaIssues.push(issue);
      hardFails.push(issue);
    } else {
      qaIssues.push(
        `No comparable sales found; PDF relies on ${evidenceBackedAlternatives
          .map(({ label }) => label)
          .join(' and ')}`
      );
    }
  } else if (comparableSales.length < 3) {
    qaIssues.push(`Only ${comparableSales.length} comparable sales (minimum 3 recommended)`);
  }

  if (!hasConcludedValue) {
    const issue = 'Concluded value is missing or zero';
    qaIssues.push(issue);
    hardFails.push(issue);
  }

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
        evidenceBackedAlternatives,
        concludedValue,
        conclusionReconcilesToAlternative,
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
