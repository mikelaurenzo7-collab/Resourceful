// ─── Evidence-Grounded Valuation Policy ──────────────────────────────────────
// Reexports the complete valuation configuration while overriding the legacy
// photo-classification deduction tables. AI photo analysis remains available for
// exhibits, condition narratives, defect counts, hearing preparation, and human
// review; it may not automatically change comparable values, depreciation, or the
// concluded value without separately supported market or cost evidence.

export * from './valuation';

export const CONDITION_DEFECT_ADJUSTMENTS = {
  high: 0,
  medium: 0,
  low: 0,
} as const;

export const CONDITION_BASE_OFFSET: Record<string, number> = {
  excellent: 0,
  good: 0,
  average: 0,
  fair: 0,
  poor: 0,
};

export const CONDITION_ADJ_MAX_PCT = 0;
export const CONDITION_COMPLETENESS_MULTIPLIER = 1;
