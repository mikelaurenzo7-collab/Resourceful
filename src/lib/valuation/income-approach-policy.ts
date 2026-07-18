export const DEFAULT_INCOME_RECONCILIATION_TOLERANCE = 0.01;

export interface IncomeApproachEvidenceInput {
  netOperatingIncome: number | null | undefined;
  concludedCapRate: number | null | undefined;
  concludedValue: number | null | undefined;
  comparableRentalCount?: number;
  investorSurveyReference?: string | null;
}

export interface IncomeApproachEvidenceAssessment {
  hasCompleteInputs: boolean;
  hasRentalEvidence: boolean;
  hasCapRateSource: boolean;
  calculatedValue: number | null;
  storedValue: number | null;
  reconciliationDifference: number | null;
  reconciliationDifferencePct: number | null;
  materiallyUnreconciled: boolean;
  isReleaseReady: boolean;
  warnings: string[];
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isValidDecimalCapRate(value: number | null | undefined): value is number {
  return isPositiveFinite(value) && value <= 1;
}

function normalizeTolerance(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) {
    return DEFAULT_INCOME_RECONCILIATION_TOLERANCE;
  }
  return Math.min(Math.max(value, 0), 1);
}

export function evaluateIncomeApproachEvidence(
  input: IncomeApproachEvidenceInput,
  reconciliationTolerance = DEFAULT_INCOME_RECONCILIATION_TOLERANCE
): IncomeApproachEvidenceAssessment {
  const hasNoi = isPositiveFinite(input.netOperatingIncome);
  const hasCapRate = isValidDecimalCapRate(input.concludedCapRate);
  const storedValue = isPositiveFinite(input.concludedValue)
    ? input.concludedValue
    : null;
  const hasRentalEvidence = Math.max(0, Math.floor(input.comparableRentalCount ?? 0)) > 0;
  const hasCapRateSource = Boolean(input.investorSurveyReference?.trim());
  const hasCompleteInputs = hasNoi && hasCapRate && storedValue != null;

  const calculatedValue = hasNoi && hasCapRate
    ? input.netOperatingIncome / input.concludedCapRate
    : null;
  const reconciliationDifference = calculatedValue != null && storedValue != null
    ? storedValue - calculatedValue
    : null;
  const reconciliationDifferencePct =
    reconciliationDifference != null && calculatedValue != null && calculatedValue > 0
      ? Math.abs(reconciliationDifference) / calculatedValue
      : null;
  const materiallyUnreconciled =
    reconciliationDifferencePct != null &&
    reconciliationDifferencePct > normalizeTolerance(reconciliationTolerance);

  const warnings: string[] = [];
  if (!hasNoi) warnings.push('Net operating income is missing or invalid');
  if (!hasCapRate) warnings.push('Concluded capitalization rate must be a positive decimal no greater than 1.0');
  if (storedValue == null) warnings.push('Stored income approach indication is missing or invalid');
  if (!hasRentalEvidence) warnings.push('No comparable rental evidence is attached');
  if (!hasCapRateSource) warnings.push('No independent capitalization-rate source is identified');
  if (materiallyUnreconciled) {
    warnings.push('Stored income indication does not reconcile to NOI divided by cap rate');
  }

  const isReleaseReady =
    hasCompleteInputs &&
    hasRentalEvidence &&
    hasCapRateSource &&
    !materiallyUnreconciled;

  return {
    hasCompleteInputs,
    hasRentalEvidence,
    hasCapRateSource,
    calculatedValue,
    storedValue,
    reconciliationDifference,
    reconciliationDifferencePct,
    materiallyUnreconciled,
    isReleaseReady,
    warnings,
  };
}
