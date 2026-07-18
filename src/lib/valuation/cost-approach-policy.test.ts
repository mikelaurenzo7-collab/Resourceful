import { describe, expect, it } from 'vitest';
import {
  evaluateCostApproachEvidence,
  hasAnyCostApproachEvidence,
} from './cost-approach-policy';

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

  it('fails closed when land or functional-obsolescence evidence is unavailable', () => {
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
    expect(result.hardFailures).toContain(
      'Cost approach requires an explicit functional-obsolescence percentage between 0% and 100%, including a stored zero when none is supported'
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
      'Cost approach requires an explicit functional-obsolescence percentage between 0% and 100%, including a stored zero when none is supported'
    );
  });

  it('distinguishes an absent cost method from partial cost evidence', () => {
    expect(
      hasAnyCostApproachEvidence({
        replacementCostNew: null,
        concludedValue: null,
        physicalDepreciationPct: null,
        functionalObsolescencePct: null,
        landValue: null,
      })
    ).toBe(false);
    expect(
      hasAnyCostApproachEvidence({
        replacementCostNew: null,
        concludedValue: 470_000,
        physicalDepreciationPct: null,
        functionalObsolescencePct: null,
        landValue: null,
      })
    ).toBe(true);
  });
});
