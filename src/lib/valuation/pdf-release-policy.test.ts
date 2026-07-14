import { describe, expect, it } from 'vitest';
import { evaluatePdfReleasePolicy } from './pdf-release-policy';

describe('evaluatePdfReleasePolicy', () => {
  it('accepts a normal report with at least three comparable sales', () => {
    const result = evaluatePdfReleasePolicy({
      comparableSaleCount: 3,
      concludedValue: 425_000,
    });

    expect(result.hardFailures).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.hasComparableSales).toBe(true);
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

  it('accepts a zero-comp report with a complete, reconciled income approach', () => {
    const result = evaluatePdfReleasePolicy({
      comparableSaleCount: 0,
      concludedValue: 1_900_000,
      incomeApproach: {
        netOperatingIncome: 150_000,
        concludedCapRate: 0.08,
        concludedValue: 1_875_000,
      },
    });

    expect(result.hardFailures).toEqual([]);
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
      incomeApproach: {
        netOperatingIncome: 150_000,
        concludedCapRate: null,
        concludedValue: 1_875_000,
      },
    });

    expect(result.hardFailures).toContain('No evidence-backed valuation approach available');
  });

  it('accepts a zero-comp report with a complete, reconciled cost approach', () => {
    const result = evaluatePdfReleasePolicy({
      comparableSaleCount: 0,
      concludedValue: 760_000,
      costApproach: {
        replacementCostNew: 900_000,
        concludedValue: 750_000,
        physicalDepreciationPct: 20,
      },
    });

    expect(result.hardFailures).toEqual([]);
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
      costApproach: {
        replacementCostNew: 900_000,
        concludedValue: 750_000,
        physicalDepreciationPct: null,
      },
    });

    expect(result.hardFailures).toContain('No evidence-backed valuation approach available');
  });

  it('rejects a conclusion materially outside the supported alternative approach', () => {
    const result = evaluatePdfReleasePolicy({
      comparableSaleCount: 0,
      concludedValue: 3_000_000,
      incomeApproach: {
        netOperatingIncome: 150_000,
        concludedCapRate: 0.08,
        concludedValue: 1_875_000,
      },
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
      incomeApproach: {
        netOperatingIncome: 90_000,
        concludedCapRate: 0.075,
        concludedValue: 1_200_000,
      },
      costApproach: {
        replacementCostNew: 1_500_000,
        concludedValue: 1_350_000,
        physicalDepreciationPct: 10,
      },
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
      incomeApproach: {
        netOperatingIncome: 150_000,
        concludedCapRate: 0.08,
        concludedValue: 1_875_000,
      },
    });

    expect(result.hardFailures).toEqual(['Concluded value is missing or zero']);
    expect(result.warnings).toEqual([]);
  });

  it('honors a stricter custom reconciliation tolerance', () => {
    const result = evaluatePdfReleasePolicy({
      comparableSaleCount: 0,
      concludedValue: 1_150_000,
      reconciliationTolerance: 0.05,
      incomeApproach: {
        netOperatingIncome: 100_000,
        concludedCapRate: 0.1,
        concludedValue: 1_000_000,
      },
    });

    expect(result.hardFailures).toContain(
      'Concluded value is not reconciled to the available income or cost evidence'
    );
  });
});
