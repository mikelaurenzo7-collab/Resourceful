import type { CostVerificationState } from '@/types/database';
import { isCanonicalDateOnly } from './valuation-date-policy';

export interface CostApproachEvidenceInput {
  replacementCostNew: number | null | undefined;
  concludedValue: number | null | undefined;
  physicalDepreciationPct: number | null | undefined;
  functionalObsolescencePct: number | null | undefined;
  landValue: number | null | undefined;
  replacementCostSourceAuthority?: string | null | undefined;
  depreciationSourceAuthority?: string | null | undefined;
  landValueSourceAuthority?: string | null | undefined;
  sourceReferences?: Record<string, unknown> | null | undefined;
  methodology?: string | null | undefined;
  costEffectiveDate?: string | null | undefined;
  expectedEffectiveDate?: string | null | undefined;
  verificationState?: CostVerificationState | null | undefined;
  verifiedBy?: string | null | undefined;
  verifiedAt?: string | null | undefined;
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
  replacementCostSourceAuthority: string | null;
  depreciationSourceAuthority: string | null;
  landValueSourceAuthority: string | null;
  sourceReferences: Record<string, unknown> | null;
  methodology: string | null;
  costEffectiveDate: string | null;
  expectedEffectiveDate: string | null;
  verificationState: CostVerificationState | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
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

function text(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function nonEmptyRecord(
  value: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  return value && Object.keys(value).length > 0 ? value : null;
}

function validTimestamp(value: string | null | undefined): string | null {
  const normalized = text(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
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
    input.replacementCostSourceAuthority,
    input.depreciationSourceAuthority,
    input.landValueSourceAuthority,
    input.sourceReferences,
    input.methodology,
    input.costEffectiveDate,
    input.verificationState,
    input.verifiedBy,
    input.verifiedAt,
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
  const replacementCostSourceAuthority = text(input.replacementCostSourceAuthority);
  const depreciationSourceAuthority = text(input.depreciationSourceAuthority);
  const landValueSourceAuthority = text(input.landValueSourceAuthority);
  const sourceReferences = nonEmptyRecord(input.sourceReferences);
  const methodology = text(input.methodology);
  const costEffectiveDate = isCanonicalDateOnly(input.costEffectiveDate)
    ? input.costEffectiveDate
    : null;
  const expectedEffectiveDate = isCanonicalDateOnly(input.expectedEffectiveDate)
    ? input.expectedEffectiveDate
    : null;
  const verificationState = input.verificationState ?? null;
  const verifiedBy = text(input.verifiedBy);
  const verifiedAt = validTimestamp(input.verifiedAt);

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
    hardFailures.push('Cost approach requires a non-negative land-value input');
  }

  if (verificationState === 'assumption') {
    warnings.push(
      'Cost approach inputs are classified as assumptions and may be retained in the workfile but cannot support a released value conclusion'
    );
    hardFailures.push('Cost approach requires independently verified source provenance');
  } else if (verificationState !== 'verified') {
    hardFailures.push(
      'Cost approach verification state must be verified before the method can support release'
    );
  }

  if (replacementCostSourceAuthority == null) {
    hardFailures.push('Cost approach requires a named replacement-cost source authority');
  }
  if (depreciationSourceAuthority == null) {
    hardFailures.push('Cost approach requires a named depreciation/obsolescence source authority');
  }
  if (landValueSourceAuthority == null) {
    hardFailures.push('Cost approach requires a named land-value source authority');
  }
  if (sourceReferences == null) {
    hardFailures.push('Cost approach requires structured source references and data vintage');
  }
  if (methodology == null) {
    hardFailures.push('Cost approach requires a reproducible methodology statement');
  }
  if (costEffectiveDate == null) {
    hardFailures.push('Cost approach requires a valid YYYY-MM-DD evidence effective date');
  }
  if (expectedEffectiveDate == null) {
    hardFailures.push('Cost approach requires the report valuation effective date for reconciliation');
  } else if (costEffectiveDate != null && costEffectiveDate !== expectedEffectiveDate) {
    hardFailures.push(
      `Cost evidence effective date ${costEffectiveDate} does not match the report valuation effective date ${expectedEffectiveDate}`
    );
  }
  if (verifiedBy == null) {
    hardFailures.push('Cost approach requires an identified qualified reviewer');
  }
  if (verifiedAt == null) {
    hardFailures.push('Cost approach requires a valid verification timestamp');
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
    replacementCostSourceAuthority,
    depreciationSourceAuthority,
    landValueSourceAuthority,
    sourceReferences,
    methodology,
    costEffectiveDate,
    expectedEffectiveDate,
    verificationState,
    verifiedBy,
    verifiedAt,
    warnings,
    hardFailures,
  };
}
