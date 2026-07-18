import { describe, expect, it } from 'vitest';
import { evaluateTaxAppealJurisdiction } from './jurisdiction-eligibility';
import type { CountyRule } from '@/types/database';

function verifiedRule(overrides: Partial<CountyRule> = {}): CountyRule {
  return {
    county_fips: '17031',
    county_name: 'Cook',
    state_name: 'Illinois',
    state_abbreviation: 'IL',
    is_active: true,
    last_verified_date: '2026-07-01',
    appeal_board_name: 'Cook County Board of Review',
    appeal_deadline_rule: 'File during the published township window.',
    next_appeal_deadline: null,
    filing_steps: [
      { step_number: 1, title: 'Prepare evidence', description: 'Assemble the filing package.' },
    ],
    required_documents: ['Complaint form', 'Comparable evidence'],
    ...overrides,
  } as CountyRule;
}

const NOW = new Date('2026-07-18T12:00:00Z');

describe('evaluateTaxAppealJurisdiction', () => {
  it('allows a current, active, complete, matching jurisdiction rule', () => {
    expect(
      evaluateTaxAppealJurisdiction({
        countyFips: '17031',
        state: 'IL',
        rule: verifiedRule(),
        now: NOW,
      })
    ).toEqual({
      allowed: true,
      code: 'JURISDICTION_VERIFIED',
      filingAuthority: 'Cook County Board of Review',
      filingDeadline: 'File during the published township window.',
      ruleLastVerifiedDate: '2026-07-01',
    });
  });

  it('accepts a verified explicit deadline in place of a general deadline rule', () => {
    const result = evaluateTaxAppealJurisdiction({
      countyFips: '17031',
      state: 'IL',
      rule: verifiedRule({
        next_appeal_deadline: '2026-09-15',
        appeal_deadline_rule: '',
      }),
      now: NOW,
    });

    expect(result.allowed).toBe(true);
    if (result.allowed) expect(result.filingDeadline).toBe('2026-09-15');
  });

  it('blocks missing and inactive jurisdiction records', () => {
    expect(
      evaluateTaxAppealJurisdiction({
        countyFips: '99999',
        state: 'IL',
        rule: null,
        now: NOW,
      })
    ).toMatchObject({ allowed: false, code: 'JURISDICTION_NOT_SUPPORTED' });

    expect(
      evaluateTaxAppealJurisdiction({
        countyFips: '17031',
        state: 'IL',
        rule: verifiedRule({ is_active: false }),
        now: NOW,
      })
    ).toMatchObject({ allowed: false, code: 'JURISDICTION_INACTIVE' });
  });

  it('blocks FIPS and state mismatches', () => {
    expect(
      evaluateTaxAppealJurisdiction({
        countyFips: '17043',
        state: 'IL',
        rule: verifiedRule(),
        now: NOW,
      })
    ).toMatchObject({ allowed: false, code: 'JURISDICTION_MISMATCH' });

    expect(
      evaluateTaxAppealJurisdiction({
        countyFips: '17031',
        state: 'WI',
        rule: verifiedRule(),
        now: NOW,
      })
    ).toMatchObject({ allowed: false, code: 'JURISDICTION_MISMATCH' });
  });

  it('blocks missing, future, and stale verification dates', () => {
    expect(
      evaluateTaxAppealJurisdiction({
        countyFips: '17031',
        state: 'IL',
        rule: verifiedRule({ last_verified_date: null }),
        now: NOW,
      })
    ).toMatchObject({ allowed: false, code: 'JURISDICTION_UNVERIFIED' });

    expect(
      evaluateTaxAppealJurisdiction({
        countyFips: '17031',
        state: 'IL',
        rule: verifiedRule({ last_verified_date: '2026-08-01' }),
        now: NOW,
      })
    ).toMatchObject({ allowed: false, code: 'JURISDICTION_UNVERIFIED' });

    expect(
      evaluateTaxAppealJurisdiction({
        countyFips: '17031',
        state: 'IL',
        rule: verifiedRule({ last_verified_date: '2025-12-01' }),
        now: NOW,
      })
    ).toMatchObject({ allowed: false, code: 'JURISDICTION_RULES_STALE' });
  });

  it('requires authority, deadline, filing steps, and required documents', () => {
    for (const rule of [
      verifiedRule({ appeal_board_name: '' }),
      verifiedRule({ appeal_deadline_rule: '', next_appeal_deadline: null }),
      verifiedRule({ filing_steps: [] }),
      verifiedRule({ required_documents: [] }),
    ]) {
      expect(
        evaluateTaxAppealJurisdiction({
          countyFips: '17031',
          state: 'IL',
          rule,
          now: NOW,
        })
      ).toMatchObject({ allowed: false, code: 'JURISDICTION_RULES_INCOMPLETE' });
    }
  });
});
