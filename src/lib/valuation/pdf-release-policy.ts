// ─── PDF Valuation Evidence Release Policy ───────────────────────────────────
// Pure decision logic for determining whether a valuation has enough observable
// evidence to proceed to PDF assembly. This module intentionally contains no
// database, PDF-rendering, or model dependencies so it can be regression tested.

import {
  evaluateCostApproachEvidence,
  type CostApproachEvidenceAssessment,
} from './cost-approach-policy';
import {
  evaluateIncomeApproachEvidence,
  type IncomeApproachEvidenceAssessment,
} from './income-approach-policy';

export const DEFAULT_RECONCILIATION_TOLERANCE = 0.35;

export interface PdfReleasePolicyInput {
  comparableSaleCount: number;
  concludedValue: number | null | undefined;
  incomeApproach?: {
    supportedForProperty: boolean;
    netOperatingIncome: number | null | undefined;
    concludedCapRate: number | null | undefined;
    concludedValue: number | null | undefined;
    comparableRentalCount?: number;
    investorSurveyReference?: string | null;
  } | null;
  costApproach?: {
    replacementCostNew: number | null | undefined;
    concludedValue: number | null | undefined;
    physicalDepreciationPct: number | null | undefined;
    functionalObsolescencePct: number | null | undefined;
    landValue: number | null | undefined;
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
  incomeAssessment: IncomeApproachEvidenceAssessment | null;
  costAssessment: CostApproachEvidenceAssessment | null;
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
  const concludedValue = input.concludedValue;
  const hasComparableSales = comparableSaleCount > 0;
  const hasConcludedValue = isPositiveFinite(concludedValue);
  const tolerance = normalizeTolerance(input.reconciliationTolerance);

  const income = input.incomeApproach;
  const incomeAssessment = income?.supportedForProperty
    ? evaluateIncomeApproachEvidence({
        netOperatingIncome: income.netOperatingIncome,
        concludedCapRate: income.concludedCapRate,
        concludedValue: income.concludedValue,
        comparableRentalCount: income.comparableRentalCount,
        investorSurveyReference: income.investorSurveyReference,
      })
    : null;

  const costAssessment = input.costApproach
    ? evaluateCostApproachEvidence(input.costApproach)
    : null;

  const evidenceBackedAlternatives: EvidenceBackedApproach[] = [];
  if (incomeAssessment?.isReleaseReady && incomeAssessment.storedValue != null) {
    evidenceBackedAlternatives.push({
      label: 'income approach',
      value: incomeAssessment.storedValue,
    });
  }
  if (costAssessment?.isReleaseReady && costAssessment.concludedValue != null) {
    evidenceBackedAlternatives.push({
      label: 'cost approach',
      value: costAssessment.concludedValue,
    });
  }

  const conclusionReconcilesToAlternative =
    hasConcludedValue &&
    evidenceBackedAlternatives.some(({ value }) => {
      const minimum = value * (1 - tolerance);
      const maximum = value * (1 + tolerance);
      return concludedValue >= minimum && concludedValue <= maximum;
    });

  const warnings: string[] = [];
  const hardFailures: string[] = [];

  if (!hasConcludedValue) {
    hardFailures.push('Concluded value is missing or zero');
  }

  if (income && !income.supportedForProperty) {
    warnings.push('Income approach data is attached to a property not classified as income-producing and will be omitted');
  } else if (incomeAssessment && !incomeAssessment.isReleaseReady) {
    warnings.push(...incomeAssessment.warnings.map((warning) => `Income approach: ${warning}`));
  }

  if (costAssessment && !costAssessment.isReleaseReady) {
    warnings.push(
      ...costAssessment.hardFailures.map((failure) => `Cost approach: ${failure}`),
      ...costAssessment.warnings.map((warning) => `Cost approach: ${warning}`)
    );
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
    incomeAssessment,
    costAssessment,
    evidenceBackedAlternatives,
    conclusionReconcilesToAlternative,
    warnings,
    hardFailures,
  };
}
