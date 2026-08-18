// ─── Durable Pipeline Run Contracts ─────────────────────────────────────────
// These types mirror migration 036 plus later control-plane extensions. They are
// intentionally isolated from customer-facing database types because app code
// never reads pipeline_runs directly; every state transition is atomic in SQL.

export type PipelineRunSource =
  | 'stripe'
  | 'founder'
  | 'partner_api'
  | 'admin'
  | 'stale_recovery'
  | 'migration_recovery';

export type PipelineRunStatus =
  | 'queued'
  | 'running'
  | 'retrying'
  | 'succeeded'
  | 'dead_letter'
  | 'cancelled';

export interface PipelineRun {
  id: string;
  report_id: string;
  source: PipelineRunSource;
  status: PipelineRunStatus;
  start_stage: number;
  current_stage: number;
  stage_attempt_count: number;
  total_attempt_count: number;
  max_stage_attempts: number;
  available_at: string;
  lease_owner: string | null;
  lease_expires_at: string | null;
  idempotency_key: string;
  workflow_version: string;
  last_completed_stage: string | null;
  last_error: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineQueueHealth {
  queued_count: number;
  running_count: number;
  retrying_count: number;
  dead_letter_count: number;
  succeeded_last_24h_count: number;
  expired_lease_count: number;
  oldest_due_at: string | null;
  oldest_due_age_seconds: number | null;
}

export interface PipelineRunError extends Record<string, unknown> {
  stage: number | string;
  error: string;
  timestamp: string;
}

const STAGE_NUMBER_BY_NAME: Readonly<Record<string, number>> = {
  'stage-1-data': 1,
  'stage-2-comps': 2,
  'stage-3-income': 3,
  'stage-4-photos': 4,
  'stage-5-narratives': 5,
  'stage-6-filing': 6,
  'stage-7-pdf': 7,
};

export function getCompletedStageNumber(stageName: string | null): number {
  if (!stageName) return 0;
  return STAGE_NUMBER_BY_NAME[stageName] ?? 0;
}

/**
 * Returns the first stage that still needs durable ownership.
 *
 * Stage 7 remains 7 after completion so the worker can reconcile a legacy run
 * that generated the PDF but died before it persisted pending_approval and the
 * queue's terminal state.
 */
export function inferNextStageNumber(lastCompletedStage: string | null): number {
  const completed = getCompletedStageNumber(lastCompletedStage);
  if (completed <= 0) return 1;
  return Math.min(7, completed + 1);
}

export function calculateRetryDelaySeconds(stageAttemptCount: number): number {
  const normalizedAttempt = Math.max(1, Math.floor(stageAttemptCount));
  return Math.min(15 * 60, 30 * (2 ** (normalizedAttempt - 1)));
}
