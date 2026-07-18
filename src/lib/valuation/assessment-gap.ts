export interface AssessmentGapInput {
  currentAssessedValue: number | null | undefined;
  concludedMarketValue: number | null | undefined;
  assessmentRatio: number | null | undefined;
}

export interface AssessmentGapResult {
  currentAssessedValue: number;
  concludedMarketValue: number;
  assessmentRatio: number;
  indicatedAssessedValue: number;
  assessmentGap: number;
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Compare like with like: assessed value versus the report's indicated assessed
 * value. A market-value conclusion is first converted through the jurisdiction's
 * assessment ratio. The result is an assessment gap, not a tax-dollar saving.
 */
export function calculateAssessmentGap(
  input: AssessmentGapInput
): AssessmentGapResult | null {
  if (
    !isPositiveFinite(input.currentAssessedValue) ||
    !isPositiveFinite(input.concludedMarketValue) ||
    !isPositiveFinite(input.assessmentRatio) ||
    input.assessmentRatio > 1
  ) {
    return null;
  }

  const indicatedAssessedValue = Math.round(
    input.concludedMarketValue * input.assessmentRatio
  );
  const currentAssessedValue = Math.round(input.currentAssessedValue);

  return {
    currentAssessedValue,
    concludedMarketValue: Math.round(input.concludedMarketValue),
    assessmentRatio: input.assessmentRatio,
    indicatedAssessedValue,
    assessmentGap: Math.max(0, currentAssessedValue - indicatedAssessedValue),
  };
}
