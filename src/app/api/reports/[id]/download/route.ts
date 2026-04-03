// ─── GET /api/reports/[id]/download ──────────────────────────────────────────
// On-demand PDF download. Generates a fresh signed URL (1-hour expiry) and
// redirects the user to it. No more 7-day expiring links — users can always
// download their report from the dashboard or report page.
//
// Auth: report owner (via Supabase auth) OR the report's UUID is unguessable
// (consistent with existing viewer endpoint pattern).

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Report } from '@/types/database';

const SIGNED_URL_EXPIRY_SECONDS = 60 * 60; // 1 hour (short-lived, on-demand)

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

  if (!report.report_pdf_storage_path) {
    return NextResponse.json(
      { error: 'PDF not yet generated for this report' },
      { status: 400 }
    );
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase
    .storage
    .from('reports')
    .createSignedUrl(report.report_pdf_storage_path, SIGNED_URL_EXPIRY_SECONDS);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    console.error(`[download] Failed to create signed URL for report ${reportId}:`, signedUrlError?.message);
    return NextResponse.json(
      { error: 'Failed to generate download link' },
      { status: 500 }
    );
  }

  // Redirect to the signed URL for immediate download
  return NextResponse.redirect(signedUrlData.signedUrl);
}
