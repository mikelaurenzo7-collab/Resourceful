// ─── GET /api/reports/[id]/download ──────────────────────────────────────────
// On-demand PDF download. Generates a fresh signed URL (1-hour expiry) and
// redirects the user to it. If the PDF doesn't exist in storage (pre-migration
// reports or pipeline failures), regenerates it on the fly.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Report } from '@/types/database';

const SIGNED_URL_EXPIRY_SECONDS = 60 * 60; // 1 hour

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reportId } = await params;

  if (!reportId) {
    return NextResponse.json({ error: 'Report ID required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: reportData, error: reportError } = await supabase
    .from('reports')
    .select('status, report_pdf_storage_path')
    .eq('id', reportId)
    .single();

  if (reportError || !reportData) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  const report = reportData as Pick<Report, 'status' | 'report_pdf_storage_path'>;

  if (!['delivered', 'approved', 'pending_approval'].includes(report.status)) {
    return NextResponse.json(
      { error: 'Report is not ready for download yet' },
      { status: 400 }
    );
  }

  let storagePath = report.report_pdf_storage_path;

  // ── On-demand regeneration fallback ───────────────────────────────────
  // If the PDF file doesn't exist, regenerate it transparently.
  if (!storagePath) {
    try {
      const { fetchReportTemplateData } = await import('@/lib/pdf/fetch-report-data');
      const { generateReportPDF } = await import('@/lib/pdf');

      const templateData = await fetchReportTemplateData(reportId, supabase);
      if (!templateData) {
        return NextResponse.json({ error: 'Report data not available for regeneration' }, { status: 500 });
      }

      const pdfBuffer = await generateReportPDF(templateData);

      const shortId = reportId.split('-')[0];
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      storagePath = `${reportId}/report_${shortId}_${dateStr}.pdf`;

      await supabase.storage.from('reports').upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

      await supabase.from('reports').update({ report_pdf_storage_path: storagePath }).eq('id', reportId);

      console.warn(`[PDF] Regenerated on demand for report ${reportId}`);
    } catch (err) {
      console.error(`[download] On-demand PDF regeneration failed for ${reportId}:`, err);
      return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
    }
  }

  // ── Generate signed URL ───────────────────────────────────────────────
  const { data: signedUrlData, error: signedUrlError } = await supabase
    .storage
    .from('reports')
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    console.error(`[download] Failed to create signed URL for report ${reportId}:`, signedUrlError?.message);
    return NextResponse.json(
      { error: 'Failed to generate download link' },
      { status: 500 }
    );
  }

  return NextResponse.redirect(signedUrlData.signedUrl);
}
