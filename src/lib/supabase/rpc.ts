import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';
import type {
  PipelineQueueHealth,
  PipelineRun,
  PipelineRunError,
  PipelineRunSource,
} from '@/lib/pipeline/run-types';

type RpcClient = Pick<SupabaseClient<Database>, 'rpc'>;

interface RpcError {
  message: string;
}

interface RpcResponse<TResult> {
  data: TResult | null;
  error: RpcError | null;
}

/**
 * Supabase's generated Database type intentionally has no hand-maintained RPC
 * signatures. Keep the unavoidable cast in one place and expose typed wrappers
 * for every service-role function used by application code.
 */
function callRpc<TArgs extends Record<string, unknown>, TResult>(
  client: RpcClient,
  functionName: string,
  args: TArgs
): Promise<RpcResponse<TResult>> {
  return client.rpc(functionName as never, args as never) as unknown as Promise<
    RpcResponse<TResult>
  >;
}

export function acquirePipelineLock(client: RpcClient, reportId: string) {
  return callRpc<{ p_report_id: string }, boolean>(client, 'acquire_pipeline_lock', {
    p_report_id: reportId,
  });
}

export function releasePipelineLock(client: RpcClient, reportId: string) {
  return callRpc<{ p_report_id: string }, boolean>(client, 'release_pipeline_lock', {
    p_report_id: reportId,
  });
}

export function incrementRateLimit(
  client: RpcClient,
  key: string,
  windowExpiresIso: string
) {
  return callRpc<{ p_key: string; p_window_expires: string }, number>(
    client,
    'increment_rate_limit',
    {
      p_key: key,
      p_window_expires: windowExpiresIso,
    }
  );
}

export function enqueuePipelineRunRpc(
  client: RpcClient,
  args: {
    reportId: string;
    source: PipelineRunSource;
    idempotencyKey: string;
    startStage: number;
    maxStageAttempts: number;
    metadata: Record<string, unknown>;
    replaceActive: boolean;
  }
) {
  return callRpc<
    {
      p_report_id: string;
      p_source: PipelineRunSource;
      p_idempotency_key: string;
      p_start_stage: number;
      p_max_stage_attempts: number;
      p_metadata: Record<string, unknown>;
      p_replace_active: boolean;
    },
    PipelineRun[]
  >(client, 'enqueue_pipeline_run', {
    p_report_id: args.reportId,
    p_source: args.source,
    p_idempotency_key: args.idempotencyKey,
    p_start_stage: args.startStage,
    p_max_stage_attempts: args.maxStageAttempts,
    p_metadata: args.metadata,
    p_replace_active: args.replaceActive,
  });
}

export function claimPipelineRunRpc(
  client: RpcClient,
  workerId: string,
  leaseSeconds: number
) {
  return callRpc<
    { p_worker_id: string; p_lease_seconds: number },
    PipelineRun[]
  >(client, 'claim_pipeline_run', {
    p_worker_id: workerId,
    p_lease_seconds: leaseSeconds,
  });
}

export function advancePipelineRunRpc(
  client: RpcClient,
  args: {
    runId: string;
    workerId: string;
    nextStage: number;
    completedStage: string;
    metadata: Record<string, unknown>;
  }
) {
  return callRpc<
    {
      p_run_id: string;
      p_worker_id: string;
      p_next_stage: number;
      p_completed_stage: string;
      p_metadata: Record<string, unknown>;
    },
    PipelineRun[]
  >(client, 'advance_pipeline_run', {
    p_run_id: args.runId,
    p_worker_id: args.workerId,
    p_next_stage: args.nextStage,
    p_completed_stage: args.completedStage,
    p_metadata: args.metadata,
  });
}

export function completePipelineRunRpc(
  client: RpcClient,
  args: {
    runId: string;
    workerId: string;
    completedStage: string;
    metadata: Record<string, unknown>;
  }
) {
  return callRpc<
    {
      p_run_id: string;
      p_worker_id: string;
      p_completed_stage: string;
      p_metadata: Record<string, unknown>;
    },
    PipelineRun[]
  >(client, 'complete_pipeline_run', {
    p_run_id: args.runId,
    p_worker_id: args.workerId,
    p_completed_stage: args.completedStage,
    p_metadata: args.metadata,
  });
}

export function failPipelineRunRpc(
  client: RpcClient,
  args: {
    runId: string;
    workerId: string;
    error: PipelineRunError;
    retryDelaySeconds: number;
  }
) {
  return callRpc<
    {
      p_run_id: string;
      p_worker_id: string;
      p_error: PipelineRunError;
      p_retry_delay_seconds: number;
    },
    PipelineRun[]
  >(client, 'fail_pipeline_run', {
    p_run_id: args.runId,
    p_worker_id: args.workerId,
    p_error: args.error,
    p_retry_delay_seconds: args.retryDelaySeconds,
  });
}

export function getPipelineQueueHealthRpc(client: RpcClient) {
  return callRpc<Record<string, never>, PipelineQueueHealth[]>(
    client,
    'get_pipeline_queue_health',
    {}
  );
}
