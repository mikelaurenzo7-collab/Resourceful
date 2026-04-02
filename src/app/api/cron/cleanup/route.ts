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

    let photosDeleted = 0;
    let pdfsDeleted = 0;

    for (const report of failedReports) {
      // Delete photos for this report
      const { data: photos } = await supabase
        .from('photos')
        .select('storage_path')
        .eq('report_id', report.id);

      if (photos && photos.length > 0) {
        const paths = photos.map(p => p.storage_path).filter(Boolean);
        if (paths.length > 0) {
          await supabase.storage.from('photos').remove(paths);
          photosDeleted += paths.length;
        }
        // Delete photo DB rows
        await supabase.from('photos').delete().eq('report_id', report.id);
      }

      // Delete PDF if it exists
      if (report.report_pdf_storage_path) {
        await supabase.storage.from('reports').remove([report.report_pdf_storage_path]);
        pdfsDeleted++;
      }

      // Clean up related data
      await supabase.from('property_data').delete().eq('report_id', report.id);
      await supabase.from('comparable_sales').delete().eq('report_id', report.id);
      await supabase.from('report_narratives').delete().eq('report_id', report.id);
      await supabase.from('measurements').delete().eq('report_id', report.id);
    }

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
