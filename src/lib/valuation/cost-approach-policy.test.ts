import { describe, expect, it } from 'vitest';
import {
  evaluateCostApproachEvidence,
  hasAnyCostApproachEvidence,
  type CostApproachEvidenceInput,
} from './cost-approach-policy';

function verifiedCost(
  overrides: Partial<CostApproachEvidenceInput> = {}
): CostApproachEvidenceInput {
  return {
    replacementCostNew: 500_000,
    concludedValue: 470_000,
    physicalDepreciationPct: 10,
    functionalObsolescencePct: 0,
    landValue: 20_000,
    replacementCostSourceAuthority: 'Marshall & Swift/Boeckh, 2025 local cost service',
    depreciationSourceAuthority: 'Resourceful documented age-life analysis reviewed by Test Reviewer',
    landValueSourceAuthority: 'County assessor land record and verified land-sale workfile',
    sourceReferences: {
      replacementCost: 'MSB-2025-Q1-local-index',
      depreciation: 'workfile/depreciation-analysis-1',
      landValue: 'assessor.example.gov/parcel/123',
    },
    methodology: 'RCN less physical and functional depreciation, plus land value.',
    costEffectiveDate: '2025-01-01',
    expectedEffectiveDate: '2025-01-01',
    verificationState: 'verified',
    verifiedBy: 'Test Reviewer, controlled fixture',
    verifiedAt: '2026-07-18T12:00:00.000Z',
    ...overrides,
  };
}

describe('evaluateCostApproachEvidence', () => {
  it('releases a complete sourced cost approach that reconciles to stored value', () => {
    const result = evaluateCostApproachEvidence(verifiedCost());

    expect(result.isReleaseReady).toBe(true);
    expect(result.recomputedValue).toBe(470_000);
    expect(result.verificationState).toBe('verified');
    expect(result.hardFailures).toEqual([]);
  });

  it('fails closed when land or functional-obsolescence evidence is unavailable', () => {
    const result = evaluateCostApproachEvidence(verifiedCost({
      concludedValue: 450_000,
      functionalObsolescencePct: null,
      landValue: null,
    }));

    expect(result.isReleaseReady).toBe(false);
    expect(result.hardFailures).toContain(
      'Cost approach requires a non-negative land-value input'
    );
    expect(result.hardFailures).toContain(
      'Cost approach requires an explicit functional-obsolescence percentage between 0% and 100%, including a stored zero when none is supported'
    );
  });

  it('fails when the stored conclusion does not reconcile to the inputs', () => {
    const result = evaluateCostApproachEvidence(verifiedCost({ concludedValue: 600_000 }));

    expect(result.isReleaseReady).toBe(false);
    expect(result.hardFailures.some((failure) => failure.includes('differs'))).toBe(true);
  });

  it('rejects invalid depreciation percentages', () => {
    const result = evaluateCostApproachEvidence(verifiedCost({
      physicalDepreciationPct: 110,
      functionalObsolescencePct: -1,
    }));

    expect(result.isReleaseReady).toBe(false);
    expect(result.hardFailures).toContain(
      'Cost approach requires physical depreciation between 0% and 100%'
    );
    expect(result.hardFailures).toContain(
      'Cost approach requires an explicit functional-obsolescence percentage between 0% and 100%, including a stored zero when none is supported'
    );
  });

  it('rejects numeric-only cost inputs without provenance', () => {
    const result = evaluateCostApproachEvidence({
      replacementCostNew: 500_000,
      concludedValue: 470_000,
      physicalDepreciationPct: 10,
      functionalObsolescencePct: 0,
      landValue: 20_000,
    });

    expect(result.isReleaseReady).toBe(false);
    expect(result.hardFailures).toContain(
      'Cost approach verification state must be verified before the method can support release'
    );
    expect(result.hardFailures).toContain(
      'Cost approach requires a named replacement-cost source authority'
    );
    expect(result.hardFailures).toContain(
      'Cost approach requires structured source references and data vintage'
    );
  });

  it('preserves assumption classification but blocks release', () => {
    const result = evaluateCostApproachEvidence(verifiedCost({
      verificationState: 'assumption',
      verifiedBy: null,
      verifiedAt: null,
    }));

    expect(result.isReleaseReady).toBe(false);
    expect(result.verificationState).toBe('assumption');
    expect(result.warnings).toContain(
      'Cost approach inputs are classified as assumptions and may be retained in the workfile but cannot support a released value conclusion'
    );
    expect(result.hardFailures).toContain(
      'Cost approach requires independently verified source provenance'
    );
  });

  it('rejects cost evidence from a different effective date', () => {
    const result = evaluateCostApproachEvidence(verifiedCost({
      costEffectiveDate: '2024-01-01',
    }));

    expect(result.isReleaseReady).toBe(false);
    expect(result.hardFailures).toContain(
      'Cost evidence effective date 2024-01-01 does not match the report valuation effective date 2025-01-01'
    );
  });

  it('rejects malformed source dates and verification timestamps', () => {
    const result = evaluateCostApproachEvidence(verifiedCost({
      costEffectiveDate: '2025-02-30',
      verifiedAt: 'not-a-timestamp',
    }));

    expect(result.isReleaseReady).toBe(false);
    expect(result.hardFailures).toContain(
      'Cost approach requires a valid YYYY-MM-DD evidence effective date'
    );
    expect(result.hardFailures).toContain(
      'Cost approach requires a valid verification timestamp'
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
        concludedValue: null,
        physicalDepreciationPct: null,
        functionalObsolescencePct: null,
        landValue: null,
        verificationState: 'assumption',
      })
    ).toBe(true);
  });
});
