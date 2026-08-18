// ─── Admin Rerun Pipeline API ────────────────────────────────────────────────
// POST: reset a reviewable report and establish durable stage-1 ownership.

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { apiLogger } from '@/lib/logger';
import { enqueuePipelineRun } from '@/lib/pipeline/queue';
import {
  createApprovalEvent,
  isAdminWithEmailMatch,
} from '@/lib/repository/admin';
import { getReportById } from '@/lib/repository/reports';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;
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

    const adminCheck = await isAdminWithEmailMatch(user.id, user.email);
    if (!adminCheck) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const report = await getReportById(reportId);
    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    const rerunnableStatuses = [
      'failed',
      'rejected',
      'pending_approval',
    ];
    if (!rerunnableStatuses.includes(report.status)) {
      return NextResponse.json(
        {
          error: `Cannot rerun a report in '${report.status}' status. Allowed: ${rerunnableStatuses.join(
            ', '
          )}`,
        },
        { status: 409 }
      );
    }

    const actionId = randomUUID();

    await createApprovalEvent({
      report_id: reportId,
      admin_user_id: user.id,
      action: 'rerun_pipeline',
      section_name: null,
      notes: `Durable pipeline rerun requested. Previous status: ${report.status}. Action ID: ${actionId}`,
    });

    // enqueue_pipeline_run atomically cancels any active lease, resets the
    // report to paid, and inserts replacement ownership for admin reruns.
    const run = await enqueuePipelineRun({
      reportId,
      source: 'admin',
      idempotencyKey: `admin:${reportId}:${actionId}`,
      startStage: 1,
      replaceActive: true,
      metadata: {
        action_id: actionId,
        admin_user_id: user.id,
        previous_status: report.status,
      },
    });

    apiLogger.info(
      {
        reportId,
        runId: run.id,
        actionId,
        currentStage: run.current_stage,
      },
      '[api/admin/rerun] Durable pipeline rerun queued'
    );

    return NextResponse.json(
      {
        message: 'Pipeline rerun queued',
        reportId,
        runId: run.id,
        status: run.status,
        currentStage: run.current_stage,
      },
      { status: 202 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    apiLogger.error(
      { err: message },
      '[api/admin/rerun] Unhandled error'
    );
    const activeLeaseConflict = message.includes(
      'currently leased and cannot be replaced safely'
    );
    return NextResponse.json(
      {
        error: activeLeaseConflict
          ? 'The pipeline is currently running. Retry after the active stage finishes.'
          : 'Internal server error',
      },
      { status: activeLeaseConflict ? 409 : 500 }
    );
  }
}
