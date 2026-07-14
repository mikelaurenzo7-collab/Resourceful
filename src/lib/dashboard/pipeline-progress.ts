import type { ReportStatus } from '@/types/database';

export const CUSTOMER_PIPELINE_STAGE_COUNT = 7;

function clampStageIndex(index: number): number {
  return Math.min(Math.max(index, -1), CUSTOMER_PIPELINE_STAGE_COUNT - 1);
}

function processingStageIndex(lastCompletedStage?: number | null): number {
  if (lastCompletedStage == null || lastCompletedStage <= 0) return 1;
  if (lastCompletedStage <= 3) return 1; // Data collection, comps, and income evidence
  if (lastCompletedStage <= 5) return 3; // Photos and narrative generation
  return 4; // Filing/PDF assembly complete; entering quality review
}

function failureStageIndex(lastCompletedStage?: number | null): number {
  if (lastCompletedStage == null || lastCompletedStage <= 0) return 0;
  if (lastCompletedStage <= 3) return 1;
  if (lastCompletedStage <= 5) return 3;
  return 4;
}

/**
 * Resolve the customer-facing progress step. Database pipeline stages are not
 * one-to-one with the seven customer milestones, so report status remains the
 * authoritative source for review, approval, delivery, and terminal states.
 */
export function resolvePipelineStageIndex(
  status: ReportStatus,
  lastCompletedStage?: number | null
): number {
  switch (status) {
    case 'intake':
      return -1;
    case 'paid':
      return 0;
    case 'data_pull':
      return 1;
    case 'photo_pending':
      return 2;
    case 'processing':
      return clampStageIndex(processingStageIndex(lastCompletedStage));
    case 'pending_approval':
      return 4;
    case 'approved':
    case 'delivering':
      return 5;
    case 'delivered':
      return 6;
    case 'failed':
    case 'rejected':
      return clampStageIndex(failureStageIndex(lastCompletedStage));
    default:
      return -1;
  }
}
