import { createAdminClient } from '@/lib/supabase/admin';
import {
  advancePipelineRunRpc,
  claimPipelineRunRpc,
  completePipelineRunRpc,
  enqueuePipelineRunRpc,
  failPipelineRunRpc,
  getPipelineQueueHealthRpc,
} from '@/lib/supabase/rpc';

import type {
  PipelineQueueHealth,
  PipelineRun,
  PipelineRunError,
  PipelineRunSource,
} from './run-types';

const DEFAULT_MAX_STAGE_ATTEMPTS = 3;
const DEFAULT_LEASE_SECONDS = 360;

function requireSingleResult<T>(
  data: T[] | null,
  operation: string
): T {
  const result = data?.[0];
  if (!result) {
    throw new Error(`${operation} did not return a pipeline run`);
  }
  return result;
}

export interface EnqueuePipelineRunInput {
  reportId: string;
  source: PipelineRunSource;
  idempotencyKey: string;
  startStage?: number;
  maxStageAttempts?: number;
  metadata?: Record<string, unknown>;
  replaceActive?: boolean;
}

export async function enqueuePipelineRun(
  input: EnqueuePipelineRunInput
): Promise<PipelineRun> {
  const supabase = createAdminClient();
  const { data, error } = await enqueuePipelineRunRpc(supabase, {
    reportId: input.reportId,
    source: input.source,
    idempotencyKey: input.idempotencyKey,
    startStage: input.startStage ?? 1,
    maxStageAttempts: input.maxStageAttempts ?? DEFAULT_MAX_STAGE_ATTEMPTS,
    metadata: input.metadata ?? {},
    replaceActive: input.replaceActive ?? false,
  });

  if (error) {
    throw new Error(`Failed to enqueue pipeline run: ${error.message}`);
  }
  return requireSingleResult(data, 'enqueue_pipeline_run');
}

export async function claimPipelineRun(
  workerId: string,
  leaseSeconds: number = DEFAULT_LEASE_SECONDS
): Promise<PipelineRun | null> {
  const supabase = createAdminClient();
  const { data, error } = await claimPipelineRunRpc(
    supabase,
    workerId,
    leaseSeconds
  );

  if (error) {
    throw new Error(`Failed to claim pipeline run: ${error.message}`);
  }
  return data?.[0] ?? null;
}

export async function advancePipelineRun(input: {
  runId: string;
  workerId: string;
  nextStage: number;
  completedStage: string;
  metadata?: Record<string, unknown>;
}): Promise<PipelineRun> {
  const supabase = createAdminClient();
  const { data, error } = await advancePipelineRunRpc(supabase, {
    ...input,
    metadata: input.metadata ?? {},
  });

  if (error) {
    throw new Error(`Failed to advance pipeline run: ${error.message}`);
  }
  return requireSingleResult(data, 'advance_pipeline_run');
}

export async function completePipelineRun(input: {
  runId: string;
  workerId: string;
  completedStage: string;
  metadata?: Record<string, unknown>;
}): Promise<PipelineRun> {
  const supabase = createAdminClient();
  const { data, error } = await completePipelineRunRpc(supabase, {
    ...input,
    metadata: input.metadata ?? {},
  });

  if (error) {
    throw new Error(`Failed to complete pipeline run: ${error.message}`);
  }
  return requireSingleResult(data, 'complete_pipeline_run');
}

export async function failPipelineRun(input: {
  runId: string;
  workerId: string;
  error: PipelineRunError;
  retryDelaySeconds: number;
}): Promise<PipelineRun> {
  const supabase = createAdminClient();
  const { data, error } = await failPipelineRunRpc(supabase, input);

  if (error) {
    throw new Error(`Failed to record pipeline failure: ${error.message}`);
  }
  return requireSingleResult(data, 'fail_pipeline_run');
}

export async function getPipelineQueueHealth(): Promise<PipelineQueueHealth> {
  const supabase = createAdminClient();
  const { data, error } = await getPipelineQueueHealthRpc(supabase);

  if (error) {
    throw new Error(`Failed to read pipeline queue health: ${error.message}`);
  }

  const health = data?.[0];
  if (!health) {
    throw new Error('get_pipeline_queue_health returned no result');
  }

  return {
    ...health,
    queued_count: Number(health.queued_count),
    running_count: Number(health.running_count),
    retrying_count: Number(health.retrying_count),
    dead_letter_count: Number(health.dead_letter_count),
    succeeded_last_24h_count: Number(
      health.succeeded_last_24h_count
    ),
    expired_lease_count: Number(health.expired_lease_count),
    oldest_due_age_seconds:
      health.oldest_due_age_seconds === null
        ? null
        : Number(health.oldest_due_age_seconds),
  };
}
