// ─── Shared Valuation Math ───────────────────────────────────────────────────
// Single source of truth for calculations used across pipeline stages,
// API routes, and the calibration system. Never duplicate these.

// ─── Constants ──────────────────────────────────────────────────────────────

/** Conservative IAAO-standard human error rate for mass appraisals (COD 5-15%) */
export const CONSERVATIVE_ERROR_RATE = 0.08;

/** Conservative fallback effective tax rate when actual data unavailable */
export const FALLBACK_TAX_RATE = 0.02;

// ─── Report Status Enum ─────────────────────────────────────────────────────

export const REPORT_STATUS = {
  INTAKE: 'intake',
  PAID: 'paid',
  PROCESSING: 'processing',
  FAILED: 'failed',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  DELIVERED: 'delivered',
  REJECTED: 'rejected',
} as const;

export type ReportStatus = (typeof REPORT_STATUS)[keyof typeof REPORT_STATUS];

/** Statuses that are valid for delivery */
export const DELIVERABLE_STATUSES: readonly string[] = [
  REPORT_STATUS.PROCESSING,
  REPORT_STATUS.PENDING_APPROVAL,
  REPORT_STATUS.APPROVED,
] as const;

/** Statuses that indicate the report is viewable by clients */
export const VIEWABLE_STATUSES: readonly string[] = [
  REPORT_STATUS.DELIVERED,
  REPORT_STATUS.APPROVED,
  REPORT_STATUS.PENDING_APPROVAL,
] as const;

// ─── Defect Adjustment Constants ────────────────────────────────────────────
// Unified across stage4 (photo analysis) and stage5 (narratives).
// severity → value_impact → adjustment percentage.
// Ranges reflect market evidence: appraisers typically apply 5-25% condition
// adjustments in comparable sales grids.

export const DEFECT_ADJUSTMENT: Record<string, Record<string, number>> = {
  minor:       { low: -0.5, medium: -1.0, high: -1.5 },
  moderate:    { low: -1.0, medium: -2.0, high: -3.0 },
  significant: { low: -2.5, medium: -4.0, high: -6.0 },
};

/** Maximum total condition adjustment (%) — severe deferred maintenance cases */
export const MAX_CONDITION_ADJUSTMENT_PCT = -30;

// ─── Condition Mode ─────────────────────────────────────────────────────────

const CONDITION_ORDER = ['poor', 'fair', 'average', 'good', 'excellent'] as const;

/**
 * Compute the mode (most frequent value) from an array of condition ratings.
 * In case of tie, returns the worse condition (conservative/owner-advocate).
 */
export function computeConditionMode(values: string[]): string {
  if (values.length === 0) return 'average';

  const freq: Record<string, number> = {};
  for (const v of values) {
    freq[v] = (freq[v] ?? 0) + 1;
  }

  let maxCount = 0;
  let mode = values[0];
  for (const [val, count] of Object.entries(freq)) {
    const valIdx = CONDITION_ORDER.indexOf(val as typeof CONDITION_ORDER[number]);
    const modeIdx = CONDITION_ORDER.indexOf(mode as typeof CONDITION_ORDER[number]);
    if (count > maxCount || (count === maxCount && valIdx < modeIdx)) {
      maxCount = count;
      mode = val;
    }
  }

  return mode;
}

// ─── Median Calculation ─────────────────────────────────────────────────────

/**
 * Compute the statistical median of a sorted numeric array.
 */
export function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// ─── Concluded Value ────────────────────────────────────────────────────────

export interface ConcludedValueInput {
  comps: { adjusted_price_per_sqft: number | null; sale_price: number | null }[];
  buildingSqft: number | null;
}

/**
 * Calculate the concluded market value from comparable sales.
 * Uses median adjusted price per sqft × subject building sqft,
 * rounded to the nearest $1,000.
 *
 * This is the SINGLE source of truth for this calculation.
 * Used by: stage5, stage6, stage7, stage8, viewer route, calibration import.
 */
export function calculateConcludedValue(input: ConcludedValueInput): number {
  const { comps, buildingSqft } = input;
  if (comps.length === 0 || !buildingSqft || buildingSqft <= 0) return 0;

  const adjustedPrices = comps
    .map((c) => c.adjusted_price_per_sqft)
    .filter((p): p is number => p != null && p > 0)
    .sort((a, b) => a - b);

  if (adjustedPrices.length > 0) {
    const medianPrice = median(adjustedPrices);
    return Math.round((medianPrice * buildingSqft) / 1000) * 1000;
  }

  // Fallback: use raw sale prices directly
  const salePrices = comps
    .map((c) => c.sale_price)
    .filter((p): p is number => p != null && p > 0)
    .sort((a, b) => a - b);

  if (salePrices.length > 0) {
    return Math.round(median(salePrices) / 1000) * 1000;
  }

  return 0;
}

/**
 * Blend sales comparison value with income approach value for
 * commercial/industrial properties. 70% sales, 30% income.
 */
export function blendWithIncomeApproach(
  salesValue: number,
  incomeValue: number | null | undefined
): number {
  if (!incomeValue || incomeValue <= 0 || salesValue <= 0) return salesValue;
  return Math.round((salesValue * 0.7 + incomeValue * 0.3) / 1000) * 1000;
}

// ─── Address Helpers ────────────────────────────────────────────────────────

/**
 * Build a full property address string from components.
 */
export function buildPropertyAddress(
  address: string | null,
  city: string | null,
  state: string | null
): string {
  return [address, city, state].filter(Boolean).join(', ');
}

// ─── Optimistic Estimate ────────────────────────────────────────────────────

/**
 * Calculate the pre-pipeline optimistic overassessment estimate.
 * Uses IAAO-standard human error rate — mathematically defensible
 * regardless of county data quality.
 */
export function calculateOptimisticEstimate(assessedValue: number, taxAmount: number) {
  const overassessment = Math.round(assessedValue * CONSERVATIVE_ERROR_RATE);

  const effectiveTaxRate =
    taxAmount > 0 && assessedValue > 0
      ? taxAmount / assessedValue
      : FALLBACK_TAX_RATE;

  const estimatedAnnualSavings = Math.max(
    Math.round(overassessment * effectiveTaxRate),
    50 // minimum $50 to always show something
  );

  return { overassessment, estimatedAnnualSavings };
}
