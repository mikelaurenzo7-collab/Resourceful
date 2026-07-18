import { describe, expect, it } from 'vitest';

import {
  DEFAULT_INCOME_RECONCILIATION_TOLERANCE,
  evaluateIncomeApproachEvidence,
} from './income-approach-policy';

describe('evaluateIncomeApproachEvidence', () => {
  it('accepts complete sourced rental evidence that reconciles to NOI divided by cap rate', () => {
    const result = evaluateIncomeApproachEvidence({
      netOperatingIncome: 150_000,
      concludedCapRate: 0.08,
      concludedValue: 1_875_000,
      comparableRentalCount: 3,
      investorSurveyReference: 'PwC Real Estate Investor Survey, Q2 2026',
    });

    expect(result).toMatchObject({
      hasCompleteInputs: true,
      hasRentalEvidence: true,
      hasCapRateSource: true,
      calculatedValue: 1_875_000,
      storedValue: 1_875_000,
      reconciliationDifference: 0,
      reconciliationDifferencePct: 0,
      materiallyUnreconciled: false,
      isReleaseReady: true,
      warnings: [],
    });
  });

  it('permits immaterial rounding within the default one-percent tolerance', () => {
    const result = evaluateIncomeApproachEvidence({
      netOperatingIncome: 100_000,
      concludedCapRate: 0.075,
      concludedValue: 1_340_000,
      comparableRentalCount: 1,
      investorSurveyReference: 'Market participant survey',
    });

    expect(DEFAULT_INCOME_RECONCILIATION_TOLERANCE).toBe(0.01);
    expect(result.reconciliationDifferencePct).toBeCloseTo(0.005, 3);
    expect(result.materiallyUnreconciled).toBe(false);
    expect(result.isReleaseReady).toBe(true);
  });

  it('rejects a cap rate entered as a whole percentage', () => {
    const result = evaluateIncomeApproachEvidence({
      netOperatingIncome: 150_000,
      concludedCapRate: 8,
      concludedValue: 1_875_000,
      comparableRentalCount: 3,
      investorSurveyReference: 'Investor survey',
    });

    expect(result.hasCompleteInputs).toBe(false);
    expect(result.calculatedValue).toBeNull();
    expect(result.isReleaseReady).toBe(false);
    expect(result.warnings).toContain(
      'Concluded capitalization rate must be a positive decimal no greater than 1.0'
    );
  });

  it.each([
    ['NOI', { netOperatingIncome: null }],
    ['cap rate', { concludedCapRate: null }],
    ['stored value', { concludedValue: null }],
  ])('rejects a missing %s input', (_label, override) => {
    const result = evaluateIncomeApproachEvidence({
      netOperatingIncome: 150_000,
      concludedCapRate: 0.08,
      concludedValue: 1_875_000,
      comparableRentalCount: 3,
      investorSurveyReference: 'Investor survey',
      ...override,
    });

    expect(result.hasCompleteInputs).toBe(false);
    expect(result.isReleaseReady).toBe(false);
  });

  it('requires both rental evidence and an independent cap-rate source', () => {
    const noRentals = evaluateIncomeApproachEvidence({
      netOperatingIncome: 150_000,
      concludedCapRate: 0.08,
      concludedValue: 1_875_000,
      comparableRentalCount: 0,
      investorSurveyReference: 'Investor survey',
    });
    const noCapSource = evaluateIncomeApproachEvidence({
      netOperatingIncome: 150_000,
      concludedCapRate: 0.08,
      concludedValue: 1_875_000,
      comparableRentalCount: 2,
      investorSurveyReference: '   ',
    });

    expect(noRentals.isReleaseReady).toBe(false);
    expect(noRentals.warnings).toContain('No comparable rental evidence is attached');
    expect(noCapSource.isReleaseReady).toBe(false);
    expect(noCapSource.warnings).toContain('No independent capitalization-rate source is identified');
  });

  it('rejects a materially unreconciled stored indication', () => {
    const result = evaluateIncomeApproachEvidence({
      netOperatingIncome: 150_000,
      concludedCapRate: 0.08,
      concludedValue: 2_100_000,
      comparableRentalCount: 3,
      investorSurveyReference: 'Investor survey',
    });

    expect(result.calculatedValue).toBe(1_875_000);
    expect(result.reconciliationDifference).toBe(225_000);
    expect(result.reconciliationDifferencePct).toBe(0.12);
    expect(result.materiallyUnreconciled).toBe(true);
    expect(result.isReleaseReady).toBe(false);
  });

  it('supports a stricter caller-supplied reconciliation tolerance', () => {
    const result = evaluateIncomeApproachEvidence(
      {
        netOperatingIncome: 100_000,
        concludedCapRate: 0.1,
        concludedValue: 1_005_000,
        comparableRentalCount: 1,
        investorSurveyReference: 'Investor survey',
      },
      0.001
    );

    expect(result.reconciliationDifferencePct).toBe(0.005);
    expect(result.materiallyUnreconciled).toBe(true);
    expect(result.isReleaseReady).toBe(false);
  });
});
