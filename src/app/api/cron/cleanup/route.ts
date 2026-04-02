// ─── Storage Cleanup Cron ─────────────────────────────────────────────────────
// Runs daily to clean up orphaned files from failed/abandoned reports.
// Deletes photos and PDFs for reports that failed >7 days ago.
// Vercel cron: "0 3 * * *" (3 AM daily)

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // Find failed reports older than 7 days
    const { data: failedReports } = await supabase
      .from('reports')
      .select('id, report_pdf_storage_path')
      .eq('status', 'failed')
      .lt('created_at', sevenDaysAgo);

    if (!failedReports || failedReports.length === 0) {
      return NextResponse.json({ cleaned: 0, message: 'No stale failed reports found' });
    }

    const reportIds = failedReports.map((r: { id: string; report_pdf_storage_path: string | null }) => r.id);

    // ── Batch delete photos from storage ──────────────────────────────────
    const { data: allPhotos } = await supabase
      .from('photos')
      .select('storage_path')
      .in('report_id', reportIds);

    let photosDeleted = 0;
    if (allPhotos && allPhotos.length > 0) {
      const paths = allPhotos.map((p: { storage_path: string }) => p.storage_path).filter(Boolean);
      if (paths.length > 0) {
        await supabase.storage.from('photos').remove(paths);
        photosDeleted = paths.length;
      }
    }

    // ── Batch delete PDFs from storage ────────────────────────────────────
    const pdfPaths = failedReports
      .map((r: { id: string; report_pdf_storage_path: string | null }) => r.report_pdf_storage_path)
      .filter(Boolean) as string[];
    let pdfsDeleted = 0;
    if (pdfPaths.length > 0) {
      await supabase.storage.from('reports').remove(pdfPaths);
      pdfsDeleted = pdfPaths.length;
    }

    // ── Batch delete all related DB rows ──────────────────────────────────
    await Promise.all([
      supabase.from('photos').delete().in('report_id', reportIds),
      supabase.from('property_data').delete().in('report_id', reportIds),
      supabase.from('comparable_sales').delete().in('report_id', reportIds),
      supabase.from('report_narratives').delete().in('report_id', reportIds),
      supabase.from('measurements').delete().in('report_id', reportIds),
    ]);

    console.log(
      `[cron/cleanup] Cleaned ${failedReports.length} failed reports: ${photosDeleted} photos, ${pdfsDeleted} PDFs`
    );

    return NextResponse.json({
      cleaned: failedReports.length,
      photosDeleted,
      pdfsDeleted,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron/cleanup] Error: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
