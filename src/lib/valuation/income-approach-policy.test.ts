import { describe, expect, it } from 'vitest';
import {
  evaluateIncomeApproachEvidence,
  isVerifiableDate,
} from './income-approach-policy';

describe('evaluateIncomeApproachEvidence', () => {
  it('accepts a complete income approach and calculates the implied value', () => {
    const result = evaluateIncomeApproachEvidence({
      netOperatingIncome: 150_000,
      concludedCapRate: 0.08,
      concludedValue: 1_875_000,
      comparableRentalCount: 4,
      investorSurveyReference: 'Documented investor survey',
    });

    expect(result.hasCompleteInputs).toBe(true);
    expect(result.calculatedValue).toBe(1_875_000);
    expect(result.materiallyUnreconciled).toBe(false);
    expect(result.hasRentalEvidence).toBe(true);
    expect(result.hasCapRateSource).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('does not present a stored indication as complete when the cap rate is missing', () => {
    const result = evaluateIncomeApproachEvidence({
      netOperatingIncome: 150_000,
      concludedCapRate: null,
      concludedValue: 1_875_000,
    });

    expect(result.hasCompleteInputs).toBe(false);
    expect(result.storedValue).toBe(1_875_000);
    expect(result.calculatedValue).toBeNull();
    expect(result.warnings).toContain('Concluded capitalization rate is missing or invalid');
  });

  it('rejects zero, negative, and percentage-style cap-rate inputs above one', () => {
    const zeroResult = evaluateIncomeApproachEvidence({
      netOperatingIncome: 0,
      concludedCapRate: -0.08,
      concludedValue: 1_875_000,
    });
    const percentageStyleResult = evaluateIncomeApproachEvidence({
      netOperatingIncome: 150_000,
      concludedCapRate: 8,
      concludedValue: 1_875_000,
    });

    expect(zeroResult.hasCompleteInputs).toBe(false);
    expect(zeroResult.calculatedValue).toBeNull();
    expect(percentageStyleResult.hasCompleteInputs).toBe(false);
    expect(percentageStyleResult.calculatedValue).toBeNull();
  });

  it('flags a stored indication that differs materially from NOI divided by cap rate', () => {
    const result = evaluateIncomeApproachEvidence({
      netOperatingIncome: 150_000,
      concludedCapRate: 0.08,
      concludedValue: 2_100_000,
      comparableRentalCount: 3,
      investorSurveyReference: 'Market survey',
    });

    expect(result.hasCompleteInputs).toBe(true);
    expect(result.materiallyUnreconciled).toBe(true);
    expect(result.reconciliationDifference).toBe(225_000);
    expect(result.warnings).toContain(
      'Stored income indication does not reconcile to NOI divided by cap rate'
    );
  });

  it('allows small rounding differences within the configured tolerance', () => {
    const result = evaluateIncomeApproachEvidence(
      {
        netOperatingIncome: 150_000,
        concludedCapRate: 0.08,
        concludedValue: 1_880_000,
      },
      0.01
    );

    expect(result.materiallyUnreconciled).toBe(false);
  });

  it('separately identifies missing rental and capitalization-rate support', () => {
    const result = evaluateIncomeApproachEvidence({
      netOperatingIncome: 100_000,
      concludedCapRate: 0.08,
      concludedValue: 1_250_000,
      comparableRentalCount: 0,
      investorSurveyReference: null,
    });

    expect(result.hasCompleteInputs).toBe(true);
    expect(result.hasRentalEvidence).toBe(false);
    expect(result.hasCapRateSource).toBe(false);
    expect(result.warnings).toContain('No comparable rental evidence is attached');
    expect(result.warnings).toContain('No independent capitalization-rate source is identified');
  });
});

describe('isVerifiableDate', () => {
  it('accepts parseable dates and rejects missing or invalid values', () => {
    expect(isVerifiableDate('2026-06-01')).toBe(true);
    expect(isVerifiableDate('not-a-date')).toBe(false);
    expect(isVerifiableDate(null)).toBe(false);
  });
});
