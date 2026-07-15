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
    });

    expect(result.hasCompleteInputs).toBe(true);
    expect(result.calculatedValue).toBe(1_875_000);
    expect(result.materiallyUnreconciled).toBe(false);
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
  });

  it('rejects zero and negative core inputs', () => {
    const result = evaluateIncomeApproachEvidence({
      netOperatingIncome: 0,
      concludedCapRate: -0.08,
      concludedValue: 1_875_000,
    });

    expect(result.hasCompleteInputs).toBe(false);
    expect(result.calculatedValue).toBeNull();
  });

  it('flags a stored indication that differs materially from NOI divided by cap rate', () => {
    const result = evaluateIncomeApproachEvidence({
      netOperatingIncome: 150_000,
      concludedCapRate: 0.08,
      concludedValue: 2_100_000,
    });

    expect(result.hasCompleteInputs).toBe(true);
    expect(result.materiallyUnreconciled).toBe(true);
    expect(result.reconciliationDifference).toBe(225_000);
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
});

describe('isVerifiableDate', () => {
  it('accepts parseable dates and rejects missing or invalid values', () => {
    expect(isVerifiableDate('2026-06-01')).toBe(true);
    expect(isVerifiableDate('not-a-date')).toBe(false);
    expect(isVerifiableDate(null)).toBe(false);
  });
});
