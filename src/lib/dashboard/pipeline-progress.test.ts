import { describe, expect, it } from 'vitest';
import { resolvePipelineStageIndex } from './pipeline-progress';

describe('resolvePipelineStageIndex', () => {
  it('maps stable customer statuses to their visible milestones', () => {
    expect(resolvePipelineStageIndex('intake')).toBe(-1);
    expect(resolvePipelineStageIndex('paid')).toBe(0);
    expect(resolvePipelineStageIndex('data_pull')).toBe(1);
    expect(resolvePipelineStageIndex('photo_pending')).toBe(2);
    expect(resolvePipelineStageIndex('pending_approval')).toBe(4);
    expect(resolvePipelineStageIndex('approved')).toBe(5);
    expect(resolvePipelineStageIndex('delivering')).toBe(5);
    expect(resolvePipelineStageIndex('delivered')).toBe(6);
  });

  it('does not show a completed PDF as delivered while the report is under quality review', () => {
    expect(resolvePipelineStageIndex('pending_approval', 7)).toBe(4);
  });

  it('uses internal completion only to refine the processing state', () => {
    expect(resolvePipelineStageIndex('processing', null)).toBe(1);
    expect(resolvePipelineStageIndex('processing', 1)).toBe(1);
    expect(resolvePipelineStageIndex('processing', 3)).toBe(1);
    expect(resolvePipelineStageIndex('processing', 4)).toBe(3);
    expect(resolvePipelineStageIndex('processing', 5)).toBe(3);
    expect(resolvePipelineStageIndex('processing', 6)).toBe(4);
    expect(resolvePipelineStageIndex('processing', 7)).toBe(4);
  });

  it('places a technical failure at the nearest customer-visible work stage', () => {
    expect(resolvePipelineStageIndex('failed', null)).toBe(0);
    expect(resolvePipelineStageIndex('failed', 2)).toBe(1);
    expect(resolvePipelineStageIndex('failed', 4)).toBe(3);
    expect(resolvePipelineStageIndex('failed', 6)).toBe(4);
  });

  it('uses the same recovery-stage policy for rejected reports', () => {
    expect(resolvePipelineStageIndex('rejected', 5)).toBe(3);
    expect(resolvePipelineStageIndex('rejected', 7)).toBe(4);
  });
});
