// ─── Legacy Inline Pipeline Orchestrator ─────────────────────────────────────
// Production request handlers no longer call this function. The durable worker
// executes one stage per invocation through durable-runner.ts. This inline path
// remains for controlled local tooling and compatibility while the migration is
// rolled out; it deliberately does not use Promise.race timeouts because those
// do not cancel the underlying stage and can release ownership prematurely.

import { createAdminClient } from '@/lib/supabase/admin';
import { sendAdminNotification } from '@/lib/services/resend-email';
import { getAppUrl } from '@/lib/utils/app-url';
import { pipelineLogger } from '@/lib/logger';
import { acquirePipelineLock, releasePipelineLock } from '@/lib/supabase/rpc';
import type { Report, ReportUpdate } from '@/types/database';

import {
  PIPELINE_STAGES,
  type PipelineStageDefinition,
  type StageResult,
} from './stage-registry';

export type { StageResult } from './stage-registry';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

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

/**
 * @deprecated Production execution must enqueue a pipeline_runs record and let
 * /api/cron/pipeline-worker own each stage durably.
 */
export async function runPipeline(
  reportId: string,
  startFromStage: number = 1
): Promise<StageResult> {
  const supabase = createAdminClient();

  const { data: lockAcquired, error: lockError } = await acquirePipelineLock(
    supabase,
    reportId
  );

  if (lockError) {
    pipelineLogger.error(
      { reportId, error: lockError.message },
      'Failed to acquire legacy pipeline lock'
    );
    return {
      success: false,
      error: `Failed to acquire pipeline lock: ${lockError.message}`,
    };
  }

  if (!lockAcquired) {
    pipelineLogger.warn(
      { reportId },
      'Could not acquire legacy lock — pipeline already running'
    );
    return {
      success: false,
      error: 'Pipeline already running for this report',
    };
  }

  const { data, error: fetchError } = await supabase
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .single();
  const report = data as Report | null;

  if (fetchError || !report) {
    const message = fetchError?.message ?? 'not found';
    pipelineLogger.error({ reportId, error: message }, 'Failed to fetch report');
    await releasePipelineLock(supabase, reportId);
    return {
      success: false,
      error: `Failed to fetch report ${reportId}: ${message}`,
    };
  }

  try {
    await updateReportOrThrow(
      supabase,
      reportId,
      {
        status: 'processing',
        pipeline_started_at: new Date().toISOString(),
        pipeline_error_log: null,
      },
      'Failed to mark legacy pipeline processing'
    );

    pipelineLogger.info(
      { reportId, startFromStage },
      'Starting legacy inline pipeline'
    );

    for (const stage of PIPELINE_STAGES) {
      if (stage.number < startFromStage) {
        pipelineLogger.info(
          { reportId, stage: stage.name, stageNumber: stage.number },
          'Skipping stage — already completed'
        );
        continue;
      }

      if (stage.skipWhen?.(report.property_type, report.service_type)) {
        pipelineLogger.info(
          {
            reportId,
            stage: stage.name,
            propertyType: report.property_type,
            serviceType: report.service_type,
          },
          'Skipping stage — not applicable'
        );
        await updateReportOrThrow(
          supabase,
          reportId,
          { pipeline_last_completed_stage: stage.name },
          `Failed to persist skipped stage ${stage.name}`
        );
        continue;
      }

      pipelineLogger.info(
        { reportId, stage: stage.name, stageNumber: stage.number },
        'Running stage'
      );
      const stageStart = Date.now();

      try {
        const result = await stage.run(reportId, supabase);

        if (!result.success) {
          await handleStageFailure(
            supabase,
            reportId,
            stage,
            result.error ?? 'Unknown error'
          );
          return {
            success: false,
            error: `Stage ${stage.number} (${stage.name}) failed: ${result.error}`,
          };
        }

        pipelineLogger.info(
          {
            reportId,
            stage: stage.name,
            durationMs: Date.now() - stageStart,
          },
          'Stage completed'
        );

        await updateReportOrThrow(
          supabase,
          reportId,
          { pipeline_last_completed_stage: stage.name },
          `Failed to persist completion of ${stage.name}`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        await handleStageFailure(
          supabase,
          reportId,
          stage,
          message,
          stack
        );
        return {
          success: false,
          error: `Stage ${stage.number} (${stage.name}) threw: ${message}`,
        };
      }
    }

    await updateReportOrThrow(
      supabase,
      reportId,
      {
        pipeline_completed_at: new Date().toISOString(),
        status: 'pending_approval',
      },
      'Failed to finalize legacy pipeline'
    );

    try {
      const adminReviewUrl = `${getAppUrl()}/admin/reports/${encodeURIComponent(
        reportId
      )}/review`;
      const notification = await sendAdminNotification({
        reportId,
        propertyAddress: report.property_address,
        propertyType: report.property_type,
        reviewUrl: adminReviewUrl,
        clientEmail: report.client_email || undefined,
        county: report.county || undefined,
      });

      if (notification.error) {
        throw new Error(notification.error);
      }
    } catch (emailError) {
      pipelineLogger.error(
        {
          reportId,
          error:
            emailError instanceof Error
              ? emailError.message
              : String(emailError),
        },
        'Failed to send admin notification email'
      );
    }

    pipelineLogger.info(
      { reportId },
      'Legacy pipeline complete — pending admin approval'
    );
    return { success: true };
  } finally {
    try {
      const { error: releaseError } = await releasePipelineLock(
        supabase,
        reportId
      );
      if (releaseError) throw new Error(releaseError.message);
    } catch (error) {
      pipelineLogger.error(
        {
          reportId,
          error: error instanceof Error ? error.message : String(error),
        },
        'CRITICAL: Failed to release legacy pipeline lock'
      );
    }
  }
}

async function handleStageFailure(
  supabase: SupabaseAdmin,
  reportId: string,
  stage: PipelineStageDefinition,
  errorMessage: string,
  errorStack?: string
) {
  pipelineLogger.error(
    {
      reportId,
      stage: stage.name,
      stageNumber: stage.number,
      error: errorMessage,
    },
    'Stage failed'
  );

  const { error } = await supabase
    .from('reports')
    .update({
      status: 'failed',
      pipeline_error_log: {
        stage: stage.name,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        stack: errorStack ?? errorMessage,
      },
    })
    .eq('id', reportId);

  if (error) {
    pipelineLogger.error(
      { reportId, stage: stage.name, dbError: error.message },
      'CRITICAL: Stage failed and report failure state could not be persisted'
    );
  }
}
