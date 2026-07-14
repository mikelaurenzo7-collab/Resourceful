// ─── Dashboard Value Comparison Policy ───────────────────────────────────────
// Keeps assessed-value, market-value, and reported appeal reductions distinct.
// A raw assessed value is not directly comparable with market value in
// jurisdictions that use fractional assessment ratios.

export interface ValueComparisonInput {
  rawAssessedValue: number | null | undefined;
  assessmentRatio: number | null | undefined;
  concludedMarketValue: number | null | undefined;
  reportedAssessmentReductionCents?: number | null | undefined;
  appealOutcome?: string | null | undefined;
}

export interface ValueComparisonResult {
  assessorImpliedMarketValue: number | null;
  concludedMarketValue: number | null;
  marketValueGap: number | null;
  marketValueGapPct: number | null;
  reportedAssessmentReduction: number | null;
}

function positiveFinite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;
}

/**
 * Convert the jurisdiction's raw assessed value to its implied market value.
 * Ratios between 0 and 1 represent fractional assessment. A missing, invalid,
 * or full-value ratio leaves the raw value unchanged.
 */
export function getAssessorImpliedMarketValue(
  rawAssessedValue: number | null | undefined,
  assessmentRatio: number | null | undefined
): number | null {
  const assessed = positiveFinite(rawAssessedValue);
  if (assessed == null) return null;

  const ratio = positiveFinite(assessmentRatio);
  if (ratio != null && ratio < 1) {
    return Math.round(assessed / ratio);
  }

  return assessed;
}

/**
 * The legacy actual_savings_cents field stores the reduction in assessed value,
 * not annual tax-dollar savings. Expose it only after a reported winning appeal.
 */
export function getReportedAssessmentReduction(
  actualSavingsCents: number | null | undefined,
  appealOutcome: string | null | undefined
): number | null {
  if (appealOutcome !== 'won') return null;
  if (typeof actualSavingsCents !== 'number' || !Number.isFinite(actualSavingsCents) || actualSavingsCents <= 0) {
    return null;
  }
  return Math.round(actualSavingsCents) / 100;
}

export function buildValueComparison(input: ValueComparisonInput): ValueComparisonResult {
  const assessorImpliedMarketValue = getAssessorImpliedMarketValue(
    input.rawAssessedValue,
    input.assessmentRatio
  );
  const concludedMarketValue = positiveFinite(input.concludedMarketValue);

  const marketValueGap =
    assessorImpliedMarketValue != null &&
    concludedMarketValue != null &&
    assessorImpliedMarketValue > concludedMarketValue
      ? assessorImpliedMarketValue - concludedMarketValue
      : null;

  const marketValueGapPct =
    marketValueGap != null && concludedMarketValue != null
      ? Math.round((marketValueGap / concludedMarketValue) * 1000) / 10
      : null;

  return {
    assessorImpliedMarketValue,
    concludedMarketValue,
    marketValueGap,
    marketValueGapPct,
    reportedAssessmentReduction: getReportedAssessmentReduction(
      input.reportedAssessmentReductionCents,
      input.appealOutcome
    ),
  };
}
