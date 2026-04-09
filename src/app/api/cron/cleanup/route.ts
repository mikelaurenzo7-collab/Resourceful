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
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  try {
    // ── Clean up stale intake reports (no payment, older than 1 hour) ────
    let staleIntakeCleaned = 0;
    try {
      const { data: staleIntakes } = await supabase
        .from('reports')
        .delete()
        .eq('status', 'intake')
        .is('stripe_payment_intent_id', null)
        .lt('created_at', oneHourAgo)
        .select('id');
      staleIntakeCleaned = staleIntakes?.length ?? 0;
      if (staleIntakeCleaned > 0) {
        console.log(`[cron/cleanup] Removed ${staleIntakeCleaned} stale intake reports (no payment)`);
      }
    } catch (intakeErr) {
      console.warn('[cron/cleanup] Stale intake cleanup failed (non-fatal):', intakeErr);
    }

    // Find failed reports older than 7 days
    const { data: failedReports } = await supabase
      .from('reports')
      .select('id, report_pdf_storage_path')
      .eq('status', 'failed')
      .lt('created_at', sevenDaysAgo);

    if (!failedReports || failedReports.length === 0) {
      return NextResponse.json({ cleaned: 0, staleIntakeCleaned, message: 'No stale failed reports found' });
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

    // ── Clean up expired rate limit entries ─────────────────────────────
    let rateLimitCleaned = 0;
    try {
      const { data: expired } = await supabase
        .from('rate_limit_entries')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('key');
      rateLimitCleaned = expired?.length ?? 0;
    } catch {
      console.warn('[cron/cleanup] Rate limit cleanup failed (table may not exist yet)');
    }

    console.log(
      `[cron/cleanup] Cleaned ${failedReports.length} failed reports: ${photosDeleted} photos, ${pdfsDeleted} PDFs, ${rateLimitCleaned} rate limit entries`
    );

    return NextResponse.json({
      cleaned: failedReports.length,
      staleIntakeCleaned,
      photosDeleted,
      pdfsDeleted,
      rateLimitCleaned,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron/cleanup] Error: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
