import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { cronLogger } from '@/lib/logger';
import {
  executeClaimedPipelineRun,
  PipelineStageExecutionError,
} from '@/lib/pipeline/durable-runner';
import {
  claimPipelineRun,
  failPipelineRun,
} from '@/lib/pipeline/queue';
import { calculateRetryDelaySeconds } from '@/lib/pipeline/run-types';
import { verifyCronAuth } from '@/lib/utils/cron-auth';

export const maxDuration = 300;

const WORKER_LEASE_SECONDS = 360;
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET(request: NextRequest) {
  const authFailure = verifyCronAuth(request);
  if (authFailure) return authFailure;

  const workerId = [
    process.env.VERCEL_REGION ?? 'local',
    process.env.VERCEL_DEPLOYMENT_ID ?? 'unknown-deployment',
    randomUUID(),
  ].join(':');

  let run;
  try {
    run = await claimPipelineRun(workerId, WORKER_LEASE_SECONDS);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    cronLogger.error(
      { workerId, error: message },
      '[pipeline-worker] Failed to claim work'
    );
    return NextResponse.json(
      { success: false, phase: 'claim', error: message },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  if (!run) {
    return NextResponse.json(
      {
        success: true,
        disposition: 'idle',
        timestamp: new Date().toISOString(),
      },
      { headers: NO_STORE_HEADERS }
    );
  }

  try {
    const outcome = await executeClaimedPipelineRun(run, workerId);
    return NextResponse.json(
      {
        success: true,
        disposition: outcome.disposition,
        runId: outcome.runId,
        reportId: outcome.reportId,
        stage: outcome.stage,
        stageName: outcome.stageName,
        durationMs: outcome.durationMs,
        timestamp: new Date().toISOString(),
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const message = rawMessage.slice(0, 2_000);
    const stage =
      error instanceof PipelineStageExecutionError
        ? error.stage
        : run.current_stage;
    const stageName =
      error instanceof PipelineStageExecutionError
        ? error.stageName
        : `stage-${run.current_stage}`;
    const retryDelaySeconds = calculateRetryDelaySeconds(
      run.stage_attempt_count
    );

    try {
      const failedRun = await failPipelineRun({
        runId: run.id,
        workerId,
        retryDelaySeconds,
        error: {
          stage: stageName,
          error: message,
          timestamp: new Date().toISOString(),
        },
      });

      cronLogger.error(
        {
          runId: run.id,
          reportId: run.report_id,
          stage,
          stageName,
          nextStatus: failedRun.status,
          retryDelaySeconds,
          error: message,
        },
        '[pipeline-worker] Stage failed and durable retry state was recorded'
      );

      return NextResponse.json(
        {
          success: false,
          disposition: failedRun.status,
          runId: run.id,
          reportId: run.report_id,
          stage,
          stageName,
          retryDelaySeconds:
            failedRun.status === 'retrying' ? retryDelaySeconds : null,
          error: message,
          timestamp: new Date().toISOString(),
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    } catch (recordingError) {
      const recordingMessage =
        recordingError instanceof Error
          ? recordingError.message
          : String(recordingError);
      cronLogger.fatal(
        {
          runId: run.id,
          reportId: run.report_id,
          stage,
          workerId,
          pipelineError: message,
          recordingError: recordingMessage,
        },
        '[pipeline-worker] CRITICAL: stage failed and retry state could not be persisted'
      );

      return NextResponse.json(
        {
          success: false,
          disposition: 'ownership-uncertain',
          runId: run.id,
          reportId: run.report_id,
          stage,
          error: 'Pipeline failed and durable failure recording also failed',
          timestamp: new Date().toISOString(),
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  }
}
