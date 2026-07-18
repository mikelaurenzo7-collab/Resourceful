import { describe, expect, it } from 'vitest';
import {
  evaluatePdfReleasePolicy,
  type PdfReleasePolicyInput,
} from './pdf-release-policy';

type IncomeApproachInput = NonNullable<PdfReleasePolicyInput['incomeApproach']>;
type CostApproachInput = NonNullable<PdfReleasePolicyInput['costApproach']>;

function completeIncome(
  overrides: Partial<IncomeApproachInput> = {}
): IncomeApproachInput {
  return {
    supportedForProperty: true,
    netOperatingIncome: 150_000,
    concludedCapRate: 0.08,
    concludedValue: 1_875_000,
    comparableRentalCount: 3,
    investorSurveyReference: 'PwC Real Estate Investor Survey, Q2 2026',
    ...overrides,
  };
}

function completeCost(
  overrides: Partial<CostApproachInput> = {}
): CostApproachInput {
  return {
    replacementCostNew: 900_000,
    concludedValue: 750_000,
    physicalDepreciationPct: 20,
    functionalObsolescencePct: 0,
    landValue: 30_000,
    ...overrides,
  };
}

describe('evaluatePdfReleasePolicy', () => {
  it('accepts a normal report with at least three comparable sales', () => {
    const result = evaluatePdfReleasePolicy({
      comparableSaleCount: 3,
      concludedValue: 425_000,
    });

    expect(result.hardFailures).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.hasComparableSales).toBe(true);
    expect(result.incomeAssessment).toBeNull();
    expect(result.costAssessment).toBeNull();
  });

  it('warns but does not fail when only one or two comparable sales are available', () => {
    const result = evaluatePdfReleasePolicy({
      comparableSaleCount: 2,
      concludedValue: 425_000,
    });

    expect(result.hardFailures).toEqual([]);
    expect(result.warnings).toEqual([
      'Only 2 comparable sales (minimum 3 recommended)',
    ]);
  });

  it('fails a zero-comp report without a complete alternative approach', () => {
    const result = evaluatePdfReleasePolicy({
      comparableSaleCount: 0,
      concludedValue: 425_000,
    });

    expect(result.hardFailures).toContain('No evidence-backed valuation approach available');
    expect(result.evidenceBackedAlternatives).toEqual([]);
  });

  it('accepts a zero-comp report with complete, sourced, reconciled income evidence', () => {
    const result = evaluatePdfReleasePolicy({
      comparableSaleCount: 0,
      concludedValue: 1_900_000,
      incomeApproach: completeIncome(),
    });

    expect(result.hardFailures).toEqual([]);
    expect(result.incomeAssessment?.isReleaseReady).toBe(true);
    expect(result.evidenceBackedAlternatives).toEqual([
      { label: 'income approach', value: 1_875_000 },
    ]);
    expect(result.conclusionReconcilesToAlternative).toBe(true);
    expect(result.warnings).toEqual([
      'No comparable sales found; PDF relies on income approach',
    ]);
  });

  it('rejects an incomplete income approach with no cap rate', () => {
    const result = evaluatePdfReleasePolicy({
      comparableSaleCount: 0,
      concludedValue: 1_900_000,
      incomeApproach: completeIncome({ concludedCapRate: null }),
    });

    expect(result.hardFailures).toContain('No evidence-backed valuation approach available');
    expect(result.evidenceBackedAlternatives).toEqual([]);
    expect(result.warnings).toContain(
      'Income approach: Concluded capitalization rate must be a positive decimal no greater than 1.0'
    );
  });

  it('rejects a cap rate entered as 8 instead of 0.08', () => {
    const result = evaluatePdfReleasePolicy({
      comparableSaleCount: 0,
      concludedValue: 1_900_000,
      incomeApproach: completeIncome({ concludedCapRate: 8 }),
    });

    expect(result.incomeAssessment?.isReleaseReady).toBe(false);
    expect(result.evidenceBackedAlternatives).toEqual([]);
    expect(result.hardFailures).toContain('No evidence-backed valuation approach available');
  });

  it('rejects income evidence without rental comparables or a cap-rate source', () => {
    const noRentals = evaluatePdfReleasePolicy({
      comparableSaleCount: 0,
      concludedValue: 1_900_000,
      incomeApproach: completeIncome({ comparableRentalCount: 0 }),
    });
    const noCapSource = evaluatePdfReleasePolicy({
      comparableSaleCount: 0,
      concludedValue: 1_900_000,
      incomeApproach: completeIncome({ investorSurveyReference: null }),
    });

    expect(noRentals.hardFailures).toContain('No evidence-backed valuation approach available');
    expect(noRentals.warnings).toContain('Income approach: No comparable rental evidence is attached');
    expect(noCapSource.hardFailures).toContain('No evidence-backed valuation approach available');
    expect(noCapSource.warnings).toContain('Income approach: No independent capitalization-rate source is identified');
  });

  it('rejects a materially unreconciled stored income indication', () => {
    const result = evaluatePdfReleasePolicy({
      comparableSaleCount: 0,
      concludedValue: 2_100_000,
      incomeApproach: completeIncome({ concludedValue: 2_100_000 }),
    });

    expect(result.incomeAssessment?.materiallyUnreconciled).toBe(true);
    expect(result.evidenceBackedAlternatives).toEqual([]);
    expect(result.hardFailures).toContain('No evidence-backed valuation approach available');
    expect(result.warnings).toContain(
      'Income approach: Stored income indication does not reconcile to NOI divided by cap rate'
    );
  });

  it('omits income data attached to a non-income property', () => {
    const result = evaluatePdfReleasePolicy({
      comparableSaleCount: 3,
      concludedValue: 425_000,
      incomeApproach: completeIncome({ supportedForProperty: false }),
    });

    expect(result.hardFailures).toEqual([]);
    expect(result.incomeAssessment).toBeNull();
    expect(result.evidenceBackedAlternatives).toEqual([]);
    expect(result.warnings).toContain(
      'Income approach data is attached to a property not classified as income-producing and will be omitted'
    );
  });

  it('accepts a zero-comp report with a complete, reconciled cost approach', () => {
    const result = evaluatePdfReleasePolicy({
      comparableSaleCount: 0,
      concludedValue: 760_000,
      costApproach: completeCost(),
    });

    expect(result.hardFailures).toEqual([]);
    expect(result.costAssessment?.isReleaseReady).toBe(true);
    expect(result.evidenceBackedAlternatives).toEqual([
      { label: 'cost approach', value: 750_000 },
    ]);
    expect(result.warnings).toEqual([
      'No comparable sales found; PDF relies on cost approach',
    ]);
  });

  it('rejects a cost approach without a supported depreciation input', () => {
    const result = evaluatePdfReleasePolicy({
      comparableSaleCount: 0,
      concludedValue: 760_000,
      costApproach: completeCost({ physicalDepreciationPct: null }),
    });

    expect(result.costAssessment?.isReleaseReady).toBe(false);
    expect(result.hardFailures).toContain('No evidence-backed valuation approach available');
    expect(result.warnings).toContain(
      'Cost approach: Cost approach requires physical depreciation between 0% and 100%'
    );
  });

  it('rejects a cost approach without verified land value', () => {
    const result = evaluatePdfReleasePolicy({
      comparableSaleCount: 0,
      concludedValue: 760_000,
      costApproach: completeCost({ landValue: null }),
    });

    expect(result.costAssessment?.isReleaseReady).toBe(false);
    expect(result.hardFailures).toContain('No evidence-backed valuation approach available');
    expect(result.warnings).toContain(
      'Cost approach: Cost approach requires a verified non-negative land-value input'
    );
  });

  it('rejects a conclusion materially outside the supported alternative approach', () => {
    const result = evaluatePdfReleasePolicy({
      comparableSaleCount: 0,
      concludedValue: 3_000_000,
      incomeApproach: completeIncome(),
    });

    expect(result.conclusionReconcilesToAlternative).toBe(false);
    expect(result.hardFailures).toContain(
      'Concluded value is not reconciled to the available income or cost evidence'
    );
  });

  it('accepts a conclusion that reconciles to either of two complete approaches', () => {
    const result = evaluatePdfReleasePolicy({
      comparableSaleCount: 0,
      concludedValue: 1_250_000,
      incomeApproach: completeIncome({
        netOperatingIncome: 90_000,
        concludedCapRate: 0.075,
        concludedValue: 1_200_000,
      }),
      costApproach: completeCost({
        replacementCostNew: 1_500_000,
        concludedValue: 1_350_000,
        physicalDepreciationPct: 10,
        landValue: 0,
      }),
    });

    expect(result.hardFailures).toEqual([]);
    expect(result.evidenceBackedAlternatives).toHaveLength(2);
    expect(result.conclusionReconcilesToAlternative).toBe(true);
    expect(result.warnings[0]).toContain('income approach and cost approach');
  });

  it('fails when the concluded value is missing even if an alternative approach exists', () => {
    const result = evaluatePdfReleasePolicy({
      comparableSaleCount: 0,
      concludedValue: null,
      incomeApproach: completeIncome(),
    });

    expect(result.hardFailures).toEqual(['Concluded value is missing or zero']);
    expect(result.warnings).toEqual([]);
  });

  it('honors a stricter custom final-value reconciliation tolerance', () => {
    const result = evaluatePdfReleasePolicy({
      comparableSaleCount: 0,
      concludedValue: 1_150_000,
      reconciliationTolerance: 0.05,
      incomeApproach: completeIncome({
        netOperatingIncome: 100_000,
        concludedCapRate: 0.1,
        concludedValue: 1_000_000,
      }),
    });

    expect(result.hardFailures).toContain(
      'Concluded value is not reconciled to the available income or cost evidence'
    );
  });
});
