import { describe, expect, it } from 'vitest';
import { evaluateIncomeEvidence } from './income-evidence';

describe('evaluateIncomeEvidence', () => {
  it('accepts a complete and arithmetically reconciled income approach', () => {
    const result = evaluateIncomeEvidence({
      netOperatingIncome: 185_152,
      concludedCapRate: 0.1,
      concludedValue: 1_850_000,
      comparableRentalCount: 4,
      investorSurveyReference: 'Documented market and investor survey support',
    });

    expect(result.isComplete).toBe(true);
    expect(result.calculatedValue).toBeCloseTo(1_851_520, 0);
    expect(result.reconciliationDifferencePct).toBeLessThan(0.01);
    expect(result.warnings).toEqual([]);
  });

  it('does not treat a stored value as complete when NOI or cap rate is missing', () => {
    const result = evaluateIncomeEvidence({
      netOperatingIncome: 185_152,
      concludedCapRate: null,
      concludedValue: 1_850_000,
      comparableRentalCount: 4,
    });

    expect(result.isComplete).toBe(false);
    expect(result.calculatedValue).toBeNull();
    expect(result.warnings).toContain('Concluded capitalization rate is missing or invalid');
  });

  it('flags a material mismatch between the stored indication and direct capitalization', () => {
    const result = evaluateIncomeEvidence({
      netOperatingIncome: 100_000,
      concludedCapRate: 0.1,
      concludedValue: 1_250_000,
      comparableRentalCount: 3,
      investorSurveyReference: 'Market survey',
    });

    expect(result.isComplete).toBe(true);
    expect(result.reconciliationDifference).toBe(250_000);
    expect(result.warnings).toContain(
      'Stored income indication does not reconcile to NOI divided by cap rate'
    );
  });

  it('separately identifies missing rental and capitalization-rate source support', () => {
    const result = evaluateIncomeEvidence({
      netOperatingIncome: 100_000,
      concludedCapRate: 0.08,
      concludedValue: 1_250_000,
      comparableRentalCount: 0,
      investorSurveyReference: null,
    });

    expect(result.isComplete).toBe(true);
    expect(result.hasRentalEvidence).toBe(false);
    expect(result.hasCapRateSource).toBe(false);
    expect(result.warnings).toContain('No comparable rental evidence is attached');
    expect(result.warnings).toContain('No independent capitalization-rate source is identified');
  });
});
