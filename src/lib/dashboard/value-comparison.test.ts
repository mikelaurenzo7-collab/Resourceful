import { describe, expect, it } from 'vitest';
import {
  buildValueComparison,
  getAssessorImpliedMarketValue,
  getReportedAssessmentReduction,
} from './value-comparison';

describe('getAssessorImpliedMarketValue', () => {
  it('converts a fractional assessed value to implied market value', () => {
    expect(getAssessorImpliedMarketValue(100_000, 0.1)).toBe(1_000_000);
    expect(getAssessorImpliedMarketValue(225_000, 0.25)).toBe(900_000);
  });

  it('keeps a full-value assessment unchanged', () => {
    expect(getAssessorImpliedMarketValue(425_000, 1)).toBe(425_000);
    expect(getAssessorImpliedMarketValue(425_000, null)).toBe(425_000);
  });

  it('rejects missing and invalid assessed values', () => {
    expect(getAssessorImpliedMarketValue(null, 0.1)).toBeNull();
    expect(getAssessorImpliedMarketValue(0, 0.1)).toBeNull();
    expect(getAssessorImpliedMarketValue(Number.NaN, 0.1)).toBeNull();
  });

  it('does not divide by invalid assessment ratios', () => {
    expect(getAssessorImpliedMarketValue(425_000, 0)).toBe(425_000);
    expect(getAssessorImpliedMarketValue(425_000, -0.1)).toBe(425_000);
    expect(getAssessorImpliedMarketValue(425_000, 1.2)).toBe(425_000);
  });
});

describe('getReportedAssessmentReduction', () => {
  it('converts the legacy cents field to an assessment reduction after a reported win', () => {
    expect(getReportedAssessmentReduction(12_500_000, 'won')).toBe(125_000);
  });

  it('does not present unreported or non-winning reductions', () => {
    expect(getReportedAssessmentReduction(12_500_000, null)).toBeNull();
    expect(getReportedAssessmentReduction(12_500_000, 'pending')).toBeNull();
    expect(getReportedAssessmentReduction(12_500_000, 'lost')).toBeNull();
  });

  it('rejects zero, negative, or invalid amounts', () => {
    expect(getReportedAssessmentReduction(0, 'won')).toBeNull();
    expect(getReportedAssessmentReduction(-100, 'won')).toBeNull();
    expect(getReportedAssessmentReduction(Number.NaN, 'won')).toBeNull();
  });
});

describe('buildValueComparison', () => {
  it('compares market value to market value in fractional-assessment jurisdictions', () => {
    const result = buildValueComparison({
      rawAssessedValue: 100_000,
      assessmentRatio: 0.1,
      concludedMarketValue: 800_000,
    });

    expect(result.assessorImpliedMarketValue).toBe(1_000_000);
    expect(result.concludedMarketValue).toBe(800_000);
    expect(result.marketValueGap).toBe(200_000);
    expect(result.marketValueGapPct).toBe(25);
  });

  it('does not manufacture a gap when the assessor-implied value is below the conclusion', () => {
    const result = buildValueComparison({
      rawAssessedValue: 700_000,
      assessmentRatio: 1,
      concludedMarketValue: 800_000,
    });

    expect(result.marketValueGap).toBeNull();
    expect(result.marketValueGapPct).toBeNull();
  });

  it('keeps reported assessment reduction separate from the market-value gap', () => {
    const result = buildValueComparison({
      rawAssessedValue: 100_000,
      assessmentRatio: 0.1,
      concludedMarketValue: 800_000,
      reportedAssessmentReductionCents: 2_000_000,
      appealOutcome: 'won',
    });

    expect(result.marketValueGap).toBe(200_000);
    expect(result.reportedAssessmentReduction).toBe(20_000);
  });
});
