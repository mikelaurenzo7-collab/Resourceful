export interface IncomeEvidenceInput {
  netOperatingIncome: number | null | undefined;
  concludedCapRate: number | null | undefined;
  concludedValue: number | null | undefined;
  comparableRentalCount?: number;
  investorSurveyReference?: string | null;
}

export interface IncomeEvidenceResult {
  isComplete: boolean;
  hasRentalEvidence: boolean;
  hasCapRateSource: boolean;
  calculatedValue: number | null;
  reconciliationDifference: number | null;
  reconciliationDifferencePct: number | null;
  warnings: string[];
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function evaluateIncomeEvidence(
  input: IncomeEvidenceInput,
  reconciliationTolerance = 0.01
): IncomeEvidenceResult {
  const hasNoi = isPositiveFinite(input.netOperatingIncome);
  const hasCapRate =
    isPositiveFinite(input.concludedCapRate) && input.concludedCapRate <= 1;
  const hasConcludedValue = isPositiveFinite(input.concludedValue);
  const hasRentalEvidence = (input.comparableRentalCount ?? 0) > 0;
  const hasCapRateSource = Boolean(input.investorSurveyReference?.trim());

  const isComplete = hasNoi && hasCapRate && hasConcludedValue;
  const calculatedValue = hasNoi && hasCapRate
    ? input.netOperatingIncome / input.concludedCapRate
    : null;
  const reconciliationDifference = calculatedValue != null && hasConcludedValue
    ? input.concludedValue - calculatedValue
    : null;
  const reconciliationDifferencePct =
    reconciliationDifference != null && calculatedValue != null && calculatedValue > 0
      ? Math.abs(reconciliationDifference) / calculatedValue
      : null;

  const warnings: string[] = [];

  if (!hasNoi) warnings.push('Net operating income is missing or invalid');
  if (!hasCapRate) warnings.push('Concluded capitalization rate is missing or invalid');
  if (!hasConcludedValue) warnings.push('Stored income approach indication is missing or invalid');
  if (!hasRentalEvidence) warnings.push('No comparable rental evidence is attached');
  if (!hasCapRateSource) warnings.push('No independent capitalization-rate source is identified');
  if (
    reconciliationDifferencePct != null &&
    reconciliationDifferencePct > reconciliationTolerance
  ) {
    warnings.push('Stored income indication does not reconcile to NOI divided by cap rate');
  }

  return {
    isComplete,
    hasRentalEvidence,
    hasCapRateSource,
    calculatedValue,
    reconciliationDifference,
    reconciliationDifferencePct,
    warnings,
  };
}
