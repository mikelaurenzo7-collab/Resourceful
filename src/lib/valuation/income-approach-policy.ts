export interface IncomeApproachEvidenceInput {
  netOperatingIncome: number | null | undefined;
  concludedCapRate: number | null | undefined;
  concludedValue: number | null | undefined;
}

export interface IncomeApproachEvidenceAssessment {
  hasCompleteInputs: boolean;
  calculatedValue: number | null;
  storedValue: number | null;
  reconciliationDifference: number | null;
  reconciliationDifferencePct: number | null;
  materiallyUnreconciled: boolean;
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function evaluateIncomeApproachEvidence(
  input: IncomeApproachEvidenceInput,
  reconciliationTolerance = 0.01
): IncomeApproachEvidenceAssessment {
  const storedValue = isPositiveFinite(input.concludedValue)
    ? input.concludedValue
    : null;

  if (
    !isPositiveFinite(input.netOperatingIncome) ||
    !isPositiveFinite(input.concludedCapRate) ||
    storedValue == null
  ) {
    return {
      hasCompleteInputs: false,
      calculatedValue: null,
      storedValue,
      reconciliationDifference: null,
      reconciliationDifferencePct: null,
      materiallyUnreconciled: false,
    };
  }

  const calculatedValue = input.netOperatingIncome / input.concludedCapRate;
  const reconciliationDifference = storedValue - calculatedValue;
  const reconciliationDifferencePct =
    Math.abs(reconciliationDifference) / calculatedValue;

  return {
    hasCompleteInputs: true,
    calculatedValue,
    storedValue,
    reconciliationDifference,
    reconciliationDifferencePct,
    materiallyUnreconciled:
      reconciliationDifferencePct > Math.max(0, reconciliationTolerance),
  };
}

export function isVerifiableDate(value: string | null | undefined): value is string {
  if (!value?.trim()) return false;
  return Number.isFinite(Date.parse(value));
}
