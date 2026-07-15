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
  warnings: string[];
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isValidCapRate(value: number | null | undefined): value is number {
  return isPositiveFinite(value) && value <= 1;
}

export function evaluateIncomeApproachEvidence(
  input: IncomeApproachEvidenceInput,
  reconciliationTolerance = 0.01
): IncomeApproachEvidenceAssessment {
  const hasNoi = isPositiveFinite(input.netOperatingIncome);
  const hasCapRate = isValidCapRate(input.concludedCapRate);
  const storedValue = isPositiveFinite(input.concludedValue)
    ? input.concludedValue
    : null;
  const hasRentalEvidence = (input.comparableRentalCount ?? 0) > 0;
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
    reconciliationDifferencePct > Math.max(0, reconciliationTolerance);

  const warnings: string[] = [];
  if (!hasNoi) warnings.push('Net operating income is missing or invalid');
  if (!hasCapRate) warnings.push('Concluded capitalization rate is missing or invalid');
  if (storedValue == null) warnings.push('Stored income approach indication is missing or invalid');
  if (!hasRentalEvidence) warnings.push('No comparable rental evidence is attached');
  if (!hasCapRateSource) warnings.push('No independent capitalization-rate source is identified');
  if (materiallyUnreconciled) {
    warnings.push('Stored income indication does not reconcile to NOI divided by cap rate');
  }

  return {
    hasCompleteInputs,
    hasRentalEvidence,
    hasCapRateSource,
    calculatedValue,
    storedValue,
    reconciliationDifference,
    reconciliationDifferencePct,
    materiallyUnreconciled,
    warnings,
  };
}

export function isVerifiableDate(value: string | null | undefined): value is string {
  if (!value?.trim()) return false;
  return Number.isFinite(Date.parse(value));
}
