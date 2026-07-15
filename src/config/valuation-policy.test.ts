import { describe, expect, it } from 'vitest';
import {
  CONDITION_ADJ_MAX_PCT,
  CONDITION_BASE_OFFSET,
  CONDITION_COMPLETENESS_MULTIPLIER,
  CONDITION_DEFECT_ADJUSTMENTS,
  VALUATION_FALLBACK,
  getRcnPerSqft,
} from './valuation-policy';

describe('evidence-grounded photo valuation policy', () => {
  it('prevents AI defect severity labels from creating automatic deductions', () => {
    expect(CONDITION_DEFECT_ADJUSTMENTS).toEqual({
      high: 0,
      medium: 0,
      low: 0,
    });
  });

  it('prevents photo condition labels from creating automatic offsets', () => {
    expect(CONDITION_BASE_OFFSET).toEqual({
      excellent: 0,
      good: 0,
      average: 0,
      fair: 0,
      poor: 0,
    });
  });

  it('disables the legacy maximum photo adjustment while preserving evidence completeness', () => {
    expect(CONDITION_ADJ_MAX_PCT).toBe(0);
    expect(CONDITION_COMPLETENESS_MULTIPLIER).toBe(1);
  });

  it('continues to expose non-photo valuation configuration through the policy wrapper', () => {
    expect(VALUATION_FALLBACK.minConcludedValue).toBeGreaterThan(0);
    expect(getRcnPerSqft('residential')).toBeGreaterThan(0);
  });
});
