import { describe, expect, it } from 'vitest';

import { calculateAssessmentGap } from './assessment-gap';

describe('calculateAssessmentGap', () => {
  it('converts market value to indicated assessed value before comparing', () => {
    expect(
      calculateAssessmentGap({
        currentAssessedValue: 300_000,
        concludedMarketValue: 1_000_000,
        assessmentRatio: 0.25,
      })
    ).toEqual({
      currentAssessedValue: 300_000,
      concludedMarketValue: 1_000_000,
      assessmentRatio: 0.25,
      indicatedAssessedValue: 250_000,
      assessmentGap: 50_000,
    });
  });

  it('never represents underassessment as a negative gap', () => {
    expect(
      calculateAssessmentGap({
        currentAssessedValue: 200_000,
        concludedMarketValue: 1_000_000,
        assessmentRatio: 0.25,
      })?.assessmentGap
    ).toBe(0);
  });

  it.each([
    { currentAssessedValue: null, concludedMarketValue: 1_000_000, assessmentRatio: 0.25 },
    { currentAssessedValue: 300_000, concludedMarketValue: null, assessmentRatio: 0.25 },
    { currentAssessedValue: 300_000, concludedMarketValue: 1_000_000, assessmentRatio: null },
    { currentAssessedValue: 300_000, concludedMarketValue: 1_000_000, assessmentRatio: 8 },
    { currentAssessedValue: 0, concludedMarketValue: 1_000_000, assessmentRatio: 0.25 },
  ])('returns null for incomplete or invalid inputs: %o', (input) => {
    expect(calculateAssessmentGap(input)).toBeNull();
  });
});
