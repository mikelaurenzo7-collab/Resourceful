// ─── PDF Valuation Evidence Release Policy ───────────────────────────────────
// Pure decision logic for determining whether a valuation has enough observable
// evidence to proceed to PDF assembly. This module intentionally contains no
// database, PDF-rendering, or model dependencies so it can be regression tested.

export const DEFAULT_RECONCILIATION_TOLERANCE = 0.35;

export interface PdfReleasePolicyInput {
  comparableSaleCount: number;
  concludedValue: number | null | undefined;
  incomeApproach?: {
    netOperatingIncome: number | null | undefined;
    concludedCapRate: number | null | undefined;
    concludedValue: number | null | undefined;
  } | null;
  costApproach?: {
    replacementCostNew: number | null | undefined;
    concludedValue: number | null | undefined;
    physicalDepreciationPct: number | null | undefined;
  } | null;
  reconciliationTolerance?: number;
}

export interface EvidenceBackedApproach {
  label: 'income approach' | 'cost approach';
  value: number;
}

export interface PdfReleasePolicyResult {
  hasComparableSales: boolean;
  hasConcludedValue: boolean;
  evidenceBackedAlternatives: EvidenceBackedApproach[];
  conclusionReconcilesToAlternative: boolean;
  warnings: string[];
  hardFailures: string[];
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function normalizeTolerance(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return DEFAULT_RECONCILIATION_TOLERANCE;
  return Math.min(Math.max(value, 0), 1);
}

export function evaluatePdfReleasePolicy(
  input: PdfReleasePolicyInput
): PdfReleasePolicyResult {
  const comparableSaleCount = Math.max(0, Math.floor(input.comparableSaleCount));
  const hasComparableSales = comparableSaleCount > 0;
  const hasConcludedValue = isPositiveFinite(input.concludedValue);
  const tolerance = normalizeTolerance(input.reconciliationTolerance);

  const income = input.incomeApproach;
  const hasIncomeApproach =
    isPositiveFinite(income?.netOperatingIncome) &&
    isPositiveFinite(income?.concludedCapRate) &&
    isPositiveFinite(income?.concludedValue);

  const cost = input.costApproach;
  const hasCostApproach =
    isPositiveFinite(cost?.replacementCostNew) &&
    isPositiveFinite(cost?.concludedValue) &&
    cost?.physicalDepreciationPct != null &&
    Number.isFinite(cost.physicalDepreciationPct) &&
    cost.physicalDepreciationPct >= 0 &&
    cost.physicalDepreciationPct <= 100;

  const evidenceBackedAlternatives: EvidenceBackedApproach[] = [
    hasIncomeApproach
      ? { label: 'income approach' as const, value: income.concludedValue }
      : null,
    hasCostApproach
      ? { label: 'cost approach' as const, value: cost.concludedValue }
      : null,
  ].filter((approach): approach is EvidenceBackedApproach => approach != null);

  const conclusionReconcilesToAlternative =
    hasConcludedValue &&
    evidenceBackedAlternatives.some(({ value }) => {
      const minimum = value * (1 - tolerance);
      const maximum = value * (1 + tolerance);
      return input.concludedValue! >= minimum && input.concludedValue! <= maximum;
    });

  const warnings: string[] = [];
  const hardFailures: string[] = [];

  if (!hasConcludedValue) {
    hardFailures.push('Concluded value is missing or zero');
  }

  if (!hasComparableSales) {
    if (evidenceBackedAlternatives.length === 0) {
      hardFailures.push('No evidence-backed valuation approach available');
    } else if (hasConcludedValue && !conclusionReconcilesToAlternative) {
      hardFailures.push('Concluded value is not reconciled to the available income or cost evidence');
    } else if (hasConcludedValue) {
      warnings.push(
        `No comparable sales found; PDF relies on ${evidenceBackedAlternatives
          .map(({ label }) => label)
          .join(' and ')}`
      );
    }
  } else if (comparableSaleCount < 3) {
    warnings.push(`Only ${comparableSaleCount} comparable sales (minimum 3 recommended)`);
  }

  return {
    hasComparableSales,
    hasConcludedValue,
    evidenceBackedAlternatives,
    conclusionReconcilesToAlternative,
    warnings,
    hardFailures,
  };
}
