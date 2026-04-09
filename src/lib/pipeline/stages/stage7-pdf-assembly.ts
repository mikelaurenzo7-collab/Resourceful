// ─── Stage 7: PDF Assembly ───────────────────────────────────────────────────
// Fetches all report data, renders to PDF via @react-pdf/renderer, uploads to
// Supabase Storage, and sets status to pending_approval.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { generateReportPDF } from '@/lib/pdf';
import { fetchReportTemplateData } from '@/lib/pdf/fetch-report-data';
import { pipelineLogger } from '@/lib/logger';

// ─── Stage Entry Point ──────────────────────────────────────────────────────

export async function runPdfAssembly(
  reportId: string,
  supabase: SupabaseClient<Database>
): Promise<StageResult> {
  // ── Fetch all report data ────────────────────────────────────────────
  const templateData = await fetchReportTemplateData(reportId, supabase);

  if (!templateData) {
    return { success: false, error: `Failed to fetch report data for PDF assembly` };
  }

  // ── QA Pre-flight Checks ──────────────────────────────────────────────
  const qaIssues: string[] = [];

  if (!templateData.comparableSales || templateData.comparableSales.length === 0) {
    qaIssues.push('No comparable sales found');
  } else if (templateData.comparableSales.length < 3) {
    qaIssues.push(`Only ${templateData.comparableSales.length} comparable sales (minimum 3 recommended)`);
  }

  if (!templateData.concludedValue || templateData.concludedValue <= 0) {
    qaIssues.push('Concluded value is missing or zero');
  }

  const criticalSections = ['executive_summary', 'appeal_argument_summary'] as const;
  const existingSections = new Set(templateData.narratives.map(n => n.section_name));
  for (const section of criticalSections) {
    if (!existingSections.has(section)) {
      qaIssues.push(`Missing critical narrative: ${section}`);
    }
  }

  if (!templateData.filingGuide) {
    qaIssues.push('Filing guide not generated or failed to parse');
  }

  if (!templateData.property.building_sqft_living_area && !templateData.property.lot_size_sqft) {
    qaIssues.push('No square footage data (building or lot)');
  }

  if (qaIssues.length > 0) {
    pipelineLogger.warn({ err: qaIssues }, `QA pre-flight warnings for report ${reportId}`);
    // Hard-fail on critical issues (no comps, no concluded value)
    const hardFails = qaIssues.filter(
      i => i.includes('No comparable sales') || i.includes('Concluded value')
    );
    if (hardFails.length > 0) {
      return { success: false, error: `QA pre-flight failed: ${hardFails.join('; ')}` };
    }
  }

  const report = templateData.report;
  const propertyAddress = [
    report.property_address,
    report.city,
    report.state,
  ].filter(Boolean).join(', ');

  // ── Generate PDF ─────────────────────────────────────────────────────
  pipelineLogger.info(`[stage7] Rendering PDF for report ${reportId}...`);

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
    `[stage7] PDF assembled and uploaded for report ${reportId}. Size: ${(pdfBuffer.length / 1024).toFixed(0)}KB`
  );

  return { success: true };
}
