import { describe, expect, it } from 'vitest';
import { evaluateCostApproachEvidence } from './cost-approach-policy';

describe('evaluateCostApproachEvidence', () => {
  it('releases a complete cost approach that reconciles to stored value', () => {
    const result = evaluateCostApproachEvidence({
      replacementCostNew: 500_000,
      concludedValue: 470_000,
      physicalDepreciationPct: 10,
      functionalObsolescencePct: 0,
      landValue: 20_000,
    });

    expect(result.isReleaseReady).toBe(true);
    expect(result.recomputedValue).toBe(470_000);
    expect(result.hardFailures).toEqual([]);
  });

  it('fails closed when the land input is unavailable', () => {
    const result = evaluateCostApproachEvidence({
      replacementCostNew: 500_000,
      concludedValue: 450_000,
      physicalDepreciationPct: 10,
      functionalObsolescencePct: null,
      landValue: null,
    });

    expect(result.isReleaseReady).toBe(false);
    expect(result.hardFailures).toContain(
      'Cost approach requires a verified non-negative land-value input'
    );
  });

  it('fails when the stored conclusion does not reconcile to the inputs', () => {
    const result = evaluateCostApproachEvidence({
      replacementCostNew: 500_000,
      concludedValue: 600_000,
      physicalDepreciationPct: 10,
      functionalObsolescencePct: 0,
      landValue: 20_000,
    });

    expect(result.isReleaseReady).toBe(false);
    expect(result.hardFailures.some((failure) => failure.includes('differs'))).toBe(true);
  });

  it('rejects invalid depreciation percentages', () => {
    const result = evaluateCostApproachEvidence({
      replacementCostNew: 500_000,
      concludedValue: 470_000,
      physicalDepreciationPct: 110,
      functionalObsolescencePct: -1,
      landValue: 20_000,
    });

    expect(result.isReleaseReady).toBe(false);
    expect(result.hardFailures).toContain(
      'Cost approach requires physical depreciation between 0% and 100%'
    );
    expect(result.hardFailures).toContain(
      'Functional obsolescence must be between 0% and 100% when supplied'
    );
  });
});
