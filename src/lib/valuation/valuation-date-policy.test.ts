import { describe, expect, it } from 'vitest';
import {
  dateOnly,
  deriveCurrentAssignmentEffectiveDate,
  deriveTaxAppealEffectiveDate,
  evaluateValuationEffectiveDate,
} from './valuation-date-policy';

describe('valuation effective date policy', () => {
  it('derives January 1 of the assessment year from an explicit same-year convention', () => {
    expect(
      deriveTaxAppealEffectiveDate({
        assessmentYear: 2026,
        valuationDateConvention: 'January 1 of the assessment year',
      })
    ).toEqual({
      date: '2026-01-01',
      source: 'jurisdiction_convention',
    });
  });

  it('derives January 1 of the preceding year only when the convention says so', () => {
    expect(
      deriveTaxAppealEffectiveDate({
        assessmentYear: 2026,
        valuationDateConvention: 'January 1 of the preceding year',
      })
    ).toEqual({
      date: '2025-01-01',
      source: 'jurisdiction_convention',
    });
  });

  it('fails closed for ambiguous, non-January, or invalid jurisdiction inputs', () => {
    expect(
      deriveTaxAppealEffectiveDate({
        assessmentYear: 2026,
        valuationDateConvention: 'Annual statutory valuation date',
      })
    ).toEqual({ date: null, source: null });
    expect(
      deriveTaxAppealEffectiveDate({
        assessmentYear: 2026,
        valuationDateConvention: 'July 1 of the assessment year',
      })
    ).toEqual({ date: null, source: null });
    expect(
      deriveTaxAppealEffectiveDate({
        assessmentYear: null,
        valuationDateConvention: 'January 1 of the assessment year',
      })
    ).toEqual({ date: null, source: null });
  });

  it('uses the stable intake date for an ordinary current-value assignment', () => {
    expect(
      deriveCurrentAssignmentEffectiveDate('2026-07-18T19:35:56.000Z')
    ).toEqual({
      date: '2026-07-18',
      source: 'intake_current_date',
    });
    expect(dateOnly('not-a-date')).toBeNull();
  });

  it('rejects a retrospective assignment that inherits the intake date', () => {
    const result = evaluateValuationEffectiveDate({
      effectiveDate: '2026-07-18',
      source: 'intake_current_date',
      isRetrospectiveAssignment: true,
      reportCreatedAt: '2026-07-18T19:35:56.000Z',
    });

    expect(result.hardFailures).toContain(
      'Retrospective assignment cannot use the intake date as its valuation effective date'
    );
    expect(result.hardFailures).toContain(
      'Retrospective valuation effective date must precede the report intake date'
    );
  });

  it('accepts a sourced retrospective date that precedes intake', () => {
    const result = evaluateValuationEffectiveDate({
      effectiveDate: '2025-07-29',
      source: 'user_supplied',
      isRetrospectiveAssignment: true,
      reportCreatedAt: '2026-07-18T19:35:56.000Z',
    });

    expect(result.hardFailures).toEqual([]);
    expect(result.date).toBe('2025-07-29');
  });
});
