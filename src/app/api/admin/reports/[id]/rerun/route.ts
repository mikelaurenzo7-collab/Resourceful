// ─── Admin Rerun Pipeline API ────────────────────────────────────────────────
// POST: Reset report to 'paid' status and trigger full pipeline from stage 1.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin, createApprovalEvent } from '@/lib/repository/admin';
import { getReportById, updateReport } from '@/lib/repository/reports';
import { runPipeline } from '@/lib/pipeline/orchestrator';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;

    // ── Authenticate user ──────────────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // ── Verify admin ───────────────────────────────────────────────────────
    const adminCheck = await isAdmin(user.id);
    if (!adminCheck) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // ── Verify report exists ───────────────────────────────────────────────
    const report = await getReportById(reportId);
    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // ── Guard: only allow rerun for reports that have been paid ──────────
    const rerunAllowedStatuses = ['paid', 'processing', 'pending_approval', 'approved', 'delivered', 'rejected', 'failed'];
    if (!rerunAllowedStatuses.includes(report.status)) {
      return NextResponse.json(
        {
          error: `Report status is '${report.status}' — cannot rerun pipeline for unpaid reports`,
        },
        { status: 400 }
      );
    }

    // ── Reset report to 'paid' status ──────────────────────────────────────
    await updateReport(reportId, {
      status: 'paid',
      pipeline_started_at: null,
      pipeline_completed_at: null,
      pipeline_error_log: null,
      pipeline_last_completed_stage: null,
      report_pdf_storage_path: null,
    });

    // ── Record approval event ──────────────────────────────────────────────
    await createApprovalEvent({
      report_id: reportId,
      admin_user_id: user.id,
      action: 'rerun_pipeline',
      section_name: null,
      notes: `Pipeline rerun triggered. Previous status: ${report.status}`,
    });

    // ── Trigger full pipeline from stage 1 (fire-and-forget) ───────────────
    console.log(`[api/admin/rerun] Triggering full pipeline rerun for report ${reportId}`);

    runPipeline(reportId, 1).catch((err) => {
      console.error(
        `[api/admin/rerun] Pipeline failed for report ${reportId}: ${err}`
      );
    });

    return NextResponse.json(
      {
        message: 'Pipeline rerun triggered',
        reportId,
        status: 'paid',
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/rerun] Unhandled error:', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
