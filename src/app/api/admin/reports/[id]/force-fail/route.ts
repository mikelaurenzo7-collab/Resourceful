// ─── Admin Force-Fail Report API ─────────────────────────────────────────────
// POST: Force a stuck report (in 'paid' or 'processing') into 'failed' status.
// Used when the stale pipeline detector isn't enough and manual intervention
// is needed. After force-failing, the admin can use the rerun endpoint to retry.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin, createApprovalEvent } from '@/lib/repository/admin';
import { getReportById } from '@/lib/repository/reports';
import { apiLogger } from '@/lib/logger';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;

    // ── Authenticate + verify admin ─────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!(await isAdmin(user.id))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // ── Verify report exists ────────────────────────────────────────────
    const report = await getReportById(reportId);
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // ── Only allow force-fail from stuck states ─────────────────────────
    const forceFailableStatuses = ['paid', 'processing', 'data_pull', 'photo_pending'];
    if (!forceFailableStatuses.includes(report.status)) {
      return NextResponse.json(
        { error: `Cannot force-fail a report in '${report.status}' status. Allowed: ${forceFailableStatuses.join(', ')}` },
        { status: 409 }
      );
    }

    // ── Force-fail the report ───────────────────────────────────────────
    const admin = createAdminClient();

    await admin
      .from('reports')
      .update({
        status: 'failed' as const,
        pipeline_error_log: {
          stage: report.pipeline_last_completed_stage ?? 'pre-pipeline',
          error: `Force-failed by admin (was stuck in '${report.status}')`,
          timestamp: new Date().toISOString(),
          forced_by: user.id,
        },
      })
      .eq('id', reportId);

    // Release any held pipeline lock
    try {
      await (admin.rpc as any)('release_pipeline_lock', { p_report_id: reportId });
    } catch {
      // Lock may not exist
    }

    // ── Record approval event ───────────────────────────────────────────
    await createApprovalEvent({
      report_id: reportId,
      admin_user_id: user.id,
      action: 'rerun_pipeline',
      section_name: null,
      notes: `Force-failed from '${report.status}' status (report was stuck)`,
    });

    apiLogger.info(
      { reportId, previousStatus: report.status, adminId: user.id },
      '[force-fail] Report force-failed by admin'
    );

    return NextResponse.json({
      message: 'Report force-failed',
      reportId,
      previousStatus: report.status,
      newStatus: 'failed',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    apiLogger.error({ err: message }, '[force-fail] Unhandled error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
