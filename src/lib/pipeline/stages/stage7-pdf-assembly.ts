// ─── Stage 7: PDF Assembly ───────────────────────────────────────────────────
// Fetches all report data, renders to PDF via @react-pdf/renderer, uploads to
// Supabase Storage, and sets status to pending_approval.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { sendAdminNotification } from '@/lib/services/resend-email';
import { generateReportPDF } from '@/lib/pdf';
import { fetchReportTemplateData } from '@/lib/pdf/fetch-report-data';

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

  const report = templateData.report;
  const propertyAddress = [
    report.property_address,
    report.city,
    report.state,
  ].filter(Boolean).join(', ');

  // ── Generate PDF ─────────────────────────────────────────────────────
  console.log(`[stage7] Rendering PDF for report ${reportId}...`);

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

  // ── Send admin notification ───────────────────────────────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const reviewUrl = `${appUrl}/admin/reports/${reportId}`;

  const notifResult = await sendAdminNotification({
    reportId,
    propertyAddress,
    propertyType: report.property_type ?? 'residential',
    reviewUrl,
  });

  if (notifResult.error) {
    console.warn(`[stage7] Admin notification failed: ${notifResult.error}`);
  }

  console.log(
    `[stage7] PDF assembled and uploaded for report ${reportId}. Size: ${(pdfBuffer.length / 1024).toFixed(0)}KB`
  );

  return { success: true };
}
