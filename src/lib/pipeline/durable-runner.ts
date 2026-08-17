// ─── Durable One-Stage Pipeline Runner ───────────────────────────────────────
// A claimed pipeline_runs lease owns exactly one stage. No request handler
// launches the seven-stage workflow in the background. If Vercel terminates the
// invocation, the lease expires and another worker reclaims the same stage.

import { pipelineLogger } from '@/lib/logger';
import { sendAdminNotification } from '@/lib/services/resend-email';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAppUrl } from '@/lib/utils/app-url';
import type { Report, ReportUpdate } from '@/types/database';

import {
  advancePipelineRun,
  completePipelineRun,
} from './queue';
import {
  getCompletedStageNumber,
  type PipelineRun,
} from './run-types';
import { getPipelineStage, type StageResult } from './stage-registry';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

const TERMINAL_REPORT_STATUSES = new Set([
  'pending_approval',
  'approved',
  'delivering',
  'delivered',
  'rejected',
]);

export interface PipelineWorkerOutcome {
  runId: string;
  reportId: string;
  stage: number;
  stageName: string;
  disposition: 'advanced' | 'completed' | 'reconciled' | 'skipped';
  durationMs: number;
}

export class PipelineStageExecutionError extends Error {
  readonly runId: string;
  readonly reportId: string;
  readonly stage: number;
  readonly stageName: string;

  constructor(input: {
    runId: string;
    reportId: string;
    stage: number;
    stageName: string;
    message: string;
  }) {
    super(input.message);
    this.name = 'PipelineStageExecutionError';
    this.runId = input.runId;
    this.reportId = input.reportId;
    this.stage = input.stage;
    this.stageName = input.stageName;
  }
}

async function updateReportOrThrow(
  supabase: SupabaseAdmin,
  reportId: string,
  update: ReportUpdate,
  operation: string
) {
  const { error } = await supabase
    .from('reports')
    .update(update)
    .eq('id', reportId);

  if (error) {
    throw new Error(`${operation}: ${error.message}`);
  }
}

async function completeTerminalRun(
  run: PipelineRun,
  workerId: string,
  report: Report,
  disposition: PipelineWorkerOutcome['disposition'],
  durationMs: number
): Promise<PipelineWorkerOutcome> {
  const completedStage =
    report.pipeline_last_completed_stage ??
    (run.current_stage === 7 ? 'stage-7-pdf' : `terminal-stage-${run.current_stage}`);

  await completePipelineRun({
    runId: run.id,
    workerId,
    completedStage,
    metadata: {
      reconciled_report_status: report.status,
      reconciled_at: new Date().toISOString(),
    },
  });

  return {
    runId: run.id,
    reportId: run.report_id,
    stage: run.current_stage,
    stageName: completedStage,
    disposition,
    durationMs,
  };
}

async function finalizeReport(
  supabase: SupabaseAdmin,
  run: PipelineRun,
  workerId: string,
  report: Report,
  durationMs: number,
  disposition: PipelineWorkerOutcome['disposition']
): Promise<PipelineWorkerOutcome> {
  const completedAt = new Date().toISOString();

  if (!TERMINAL_REPORT_STATUSES.has(report.status)) {
    await updateReportOrThrow(
      supabase,
      report.id,
      {
        status: 'pending_approval',
        pipeline_last_completed_stage: 'stage-7-pdf',
        pipeline_completed_at: report.pipeline_completed_at ?? completedAt,
        pipeline_error_log: null,
      },
      'Failed to finalize report after stage 7'
    );
  }

  await completePipelineRun({
    runId: run.id,
    workerId,
    completedStage: 'stage-7-pdf',
    metadata: {
      finalized_at: completedAt,
      final_stage_duration_ms: durationMs,
    },
  });

  // Admin email is a convenience signal, not the source of truth. The durable
  // pending_approval state and admin queue exist before this notification.
  try {
    const notification = await sendAdminNotification({
      reportId: report.id,
      propertyAddress: report.property_address,
      propertyType: report.property_type,
      reviewUrl: `${getAppUrl()}/admin/reports/${encodeURIComponent(
        report.id
      )}/review`,
      clientEmail: report.client_email || undefined,
      county: report.county || undefined,
    });

    if (notification.error) {
      throw new Error(notification.error);
    }
  } catch (error) {
    pipelineLogger.error(
      {
        runId: run.id,
        reportId: report.id,
        error: error instanceof Error ? error.message : String(error),
      },
      'Pipeline finalized but admin notification failed'
    );
  }

  return {
    runId: run.id,
    reportId: run.report_id,
    stage: 7,
    stageName: 'stage-7-pdf',
    disposition,
    durationMs,
  };
}

export async function executeClaimedPipelineRun(
  run: PipelineRun,
  workerId: string
): Promise<PipelineWorkerOutcome> {
  if (run.status !== 'running' || run.lease_owner !== workerId) {
    throw new Error(
      `Pipeline run ${run.id} is not leased to worker ${workerId}`
    );
  }

  const startedAt = Date.now();
  const supabase = createAdminClient();
  const stage = getPipelineStage(run.current_stage);

  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', run.report_id)
    .single();
  const report = data as Report | null;

  if (error || !report) {
    throw new PipelineStageExecutionError({
      runId: run.id,
      reportId: run.report_id,
      stage: stage.number,
      stageName: stage.name,
      message: `Failed to load report: ${error?.message ?? 'not found'}`,
    });
  }

  if (TERMINAL_REPORT_STATUSES.has(report.status)) {
    return completeTerminalRun(
      run,
      workerId,
      report,
      'reconciled',
      Date.now() - startedAt
    );
  }

  // Stage 7 publishes immutable artifacts before the orchestration marker is
  // updated. If that final marker write was interrupted, the report path is a
  // stronger completion signal than rerendering and publishing another PDF.
  if (stage.number === 7 && report.report_pdf_storage_path) {
    return finalizeReport(
      supabase,
      run,
      workerId,
      report,
      Date.now() - startedAt,
      'reconciled'
    );
  }

  const completedStageNumber = getCompletedStageNumber(
    report.pipeline_last_completed_stage
  );

  // A previous worker may have committed the stage immediately before being
  // terminated. Reconcile from report state instead of repeating side effects.
  if (completedStageNumber >= stage.number) {
    if (completedStageNumber >= 7) {
      return finalizeReport(
        supabase,
        run,
        workerId,
        report,
        Date.now() - startedAt,
        'reconciled'
      );
    }

    const nextStage = Math.min(7, completedStageNumber + 1);
    await advancePipelineRun({
      runId: run.id,
      workerId,
      nextStage,
      completedStage: report.pipeline_last_completed_stage ?? stage.name,
      metadata: {
        reconciled_completed_stage: completedStageNumber,
        reconciled_at: new Date().toISOString(),
      },
    });

    return {
      runId: run.id,
      reportId: run.report_id,
      stage: stage.number,
      stageName: stage.name,
      disposition: 'reconciled',
      durationMs: Date.now() - startedAt,
    };
  }

  if (report.status === 'intake') {
    throw new PipelineStageExecutionError({
      runId: run.id,
      reportId: report.id,
      stage: stage.number,
      stageName: stage.name,
      message: 'Refusing to process a report before durable payment state',
    });
  }

  await updateReportOrThrow(
    supabase,
    report.id,
    {
      status: 'processing',
      pipeline_started_at: report.pipeline_started_at ?? new Date().toISOString(),
    },
    'Failed to mark report processing'
  );

  if (stage.skipWhen?.(report.property_type, report.service_type)) {
    await updateReportOrThrow(
      supabase,
      report.id,
      {
        pipeline_last_completed_stage: stage.name,
        pipeline_error_log: null,
      },
      `Failed to persist skipped stage ${stage.name}`
    );

    await advancePipelineRun({
      runId: run.id,
      workerId,
      nextStage: Math.min(7, stage.number + 1),
      completedStage: stage.name,
      metadata: {
        skipped_stage: stage.name,
        skipped_at: new Date().toISOString(),
      },
    });

    return {
      runId: run.id,
      reportId: report.id,
      stage: stage.number,
      stageName: stage.name,
      disposition: 'skipped',
      durationMs: Date.now() - startedAt,
    };
  }

  pipelineLogger.info(
    {
      runId: run.id,
      reportId: report.id,
      stage: stage.number,
      stageName: stage.name,
      attempt: run.stage_attempt_count,
      workerId,
    },
    'Durable pipeline stage started'
  );

  let result: StageResult;
  try {
    result = await stage.run(report.id, supabase);
  } catch (error) {
    throw new PipelineStageExecutionError({
      runId: run.id,
      reportId: report.id,
      stage: stage.number,
      stageName: stage.name,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (!result.success) {
    throw new PipelineStageExecutionError({
      runId: run.id,
      reportId: report.id,
      stage: stage.number,
      stageName: stage.name,
      message: result.error ?? 'Stage returned an unsuccessful result',
    });
  }

  const durationMs = Date.now() - startedAt;

  await updateReportOrThrow(
    supabase,
    report.id,
    {
      pipeline_last_completed_stage: stage.name,
      pipeline_error_log: null,
    },
    `Failed to persist completion of ${stage.name}`
  );

  if (stage.number === 7) {
    return finalizeReport(
      supabase,
      run,
      workerId,
      {
        ...report,
        pipeline_last_completed_stage: stage.name,
      },
      durationMs,
      'completed'
    );
  }

  await advancePipelineRun({
    runId: run.id,
    workerId,
    nextStage: stage.number + 1,
    completedStage: stage.name,
    metadata: {
      last_stage_duration_ms: durationMs,
      last_stage_completed_at: new Date().toISOString(),
    },
  });

  pipelineLogger.info(
    {
      runId: run.id,
      reportId: report.id,
      stage: stage.number,
      stageName: stage.name,
      durationMs,
    },
    'Durable pipeline stage completed'
  );

  return {
    runId: run.id,
    reportId: report.id,
    stage: stage.number,
    stageName: stage.name,
    disposition: 'advanced',
    durationMs,
  };
}
