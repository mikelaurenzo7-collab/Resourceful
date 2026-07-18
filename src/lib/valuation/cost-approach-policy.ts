export interface CostApproachEvidenceInput {
  replacementCostNew: number | null | undefined;
  concludedValue: number | null | undefined;
  physicalDepreciationPct: number | null | undefined;
  functionalObsolescencePct: number | null | undefined;
  landValue: number | null | undefined;
}

export interface CostApproachEvidenceAssessment {
  isReleaseReady: boolean;
  replacementCostNew: number | null;
  concludedValue: number | null;
  physicalDepreciationPct: number | null;
  functionalObsolescencePct: number;
  totalDepreciationPct: number | null;
  landValue: number | null;
  recomputedValue: number | null;
  reconciliationDifference: number | null;
  warnings: string[];
  hardFailures: string[];
}

const RECONCILIATION_TOLERANCE_PCT = 0.01;
const RECONCILIATION_TOLERANCE_DOLLARS = 1_000;

function positive(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function nonNegative(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function percent(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null;
}

export function hasAnyCostApproachEvidence(
  input: CostApproachEvidenceInput
): boolean {
  return [
    input.replacementCostNew,
    input.concludedValue,
    input.physicalDepreciationPct,
    input.functionalObsolescencePct,
    input.landValue,
  ].some((value) => value != null);
}

export function evaluateCostApproachEvidence(
  input: CostApproachEvidenceInput
): CostApproachEvidenceAssessment {
  const warnings: string[] = [];
  const hardFailures: string[] = [];
  const replacementCostNew = positive(input.replacementCostNew);
  const concludedValue = positive(input.concludedValue);
  const physicalDepreciationPct = percent(input.physicalDepreciationPct);
  const functionalObsolescenceValue = percent(input.functionalObsolescencePct);
  const functionalObsolescencePct = functionalObsolescenceValue ?? 0;
  const landValue = nonNegative(input.landValue);

  if (replacementCostNew == null) {
    hardFailures.push('Cost approach requires a positive replacement-cost-new input');
  }
  if (concludedValue == null) {
    hardFailures.push('Cost approach requires a positive stored value indication');
  }
  if (physicalDepreciationPct == null) {
    hardFailures.push('Cost approach requires physical depreciation between 0% and 100%');
  }
  if (functionalObsolescenceValue == null) {
    hardFailures.push(
      'Cost approach requires an explicit functional-obsolescence percentage between 0% and 100%, including a stored zero when none is supported'
    );
  }
  if (landValue == null) {
    hardFailures.push('Cost approach requires a verified non-negative land-value input');
  }

  const totalDepreciationPct =
    physicalDepreciationPct == null || functionalObsolescenceValue == null
      ? null
      : Math.min(physicalDepreciationPct + functionalObsolescenceValue, 100);
  const recomputedValue =
    replacementCostNew != null && totalDepreciationPct != null && landValue != null
      ? Math.max(0, replacementCostNew * (1 - totalDepreciationPct / 100)) + landValue
      : null;
  const reconciliationDifference =
    concludedValue != null && recomputedValue != null
      ? concludedValue - recomputedValue
      : null;

  if (concludedValue != null && recomputedValue != null) {
    const tolerance = Math.max(
      RECONCILIATION_TOLERANCE_DOLLARS,
      recomputedValue * RECONCILIATION_TOLERANCE_PCT
    );
    if (Math.abs(concludedValue - recomputedValue) > tolerance) {
      hardFailures.push(
        `Stored cost indication differs from the reproducible computation by $${Math.round(Math.abs(concludedValue - recomputedValue)).toLocaleString('en-US')}`
      );
    }
  }

  return {
    isReleaseReady: hardFailures.length === 0,
    replacementCostNew,
    concludedValue,
    physicalDepreciationPct,
    functionalObsolescencePct,
    totalDepreciationPct,
    landValue,
    recomputedValue,
    reconciliationDifference,
    warnings,
    hardFailures,
  };
}
