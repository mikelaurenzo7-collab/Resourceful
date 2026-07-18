import { describe, expect, it } from 'vitest';

import type { FilingGuide } from '@/lib/templates/report-template';
import type { CountyRule } from '@/types/database';
import { evaluateTaxAppealRelease } from './tax-appeal-release-policy';

const NOW = new Date('2026-07-18T12:00:00.000Z');

function createRule(overrides: Partial<CountyRule> = {}): CountyRule {
  return {
    county_fips: '17031',
    county_name: 'Cook',
    state_name: 'Illinois',
    state_abbreviation: 'IL',
    appeal_board_name: 'Cook County Board of Review',
    appeal_board_address: '118 N Clark St, Chicago, IL',
    portal_url: 'https://example.gov/appeal',
    filing_email: null,
    accepts_online_filing: true,
    accepts_email_filing: false,
    requires_mail_filing: false,
    appeal_deadline_rule: 'File within the published township filing window',
    next_appeal_deadline: '2026-08-01',
    evidence_requirements: [{ name: 'Comparable evidence' }],
    required_documents: ['Assessment notice', 'Comparable evidence'],
    filing_steps: [
      { step_number: 1, title: 'Prepare evidence', description: 'Assemble the filing package.' },
    ],
    is_active: true,
    last_verified_date: '2026-07-01',
    ...overrides,
  } as CountyRule;
}

function createGuide(overrides: Partial<FilingGuide> = {}): FilingGuide {
  return {
    appeal_board_name: 'Cook County Board of Review',
    filing_deadline: 'August 1, 2026',
    steps: ['Prepare the appeal evidence.', 'Submit through the verified portal.'],
    required_documents: ['Assessment notice', 'Comparable evidence'],
    tips: [],
    online_filing_url: 'https://example.gov/appeal',
    ...overrides,
  };
}

const JURISDICTION_FAILURE_CASES: Array<[string, CountyRule | null]> = [
  ['JURISDICTION_NOT_SUPPORTED', null],
  ['JURISDICTION_INACTIVE', createRule({ is_active: false })],
  ['JURISDICTION_MISMATCH', createRule({ county_fips: '17043' })],
  ['JURISDICTION_UNVERIFIED', createRule({ last_verified_date: null })],
  ['JURISDICTION_RULES_STALE', createRule({ last_verified_date: '2025-01-01' })],
  [
    'JURISDICTION_RULES_INCOMPLETE',
    createRule({ accepts_online_filing: false, portal_url: null, appeal_board_address: null }),
  ],
];

describe('evaluateTaxAppealRelease', () => {
  it('does not require a filing-jurisdiction release check for non-appeal assignments', () => {
    const result = evaluateTaxAppealRelease({
      serviceType: 'pre_purchase',
      reportCountyFips: null,
      reportState: null,
      countyRule: null,
      filingGuide: null,
      now: NOW,
    });

    expect(result).toMatchObject({
      allowed: true,
      code: 'JURISDICTION_RELEASE_NOT_REQUIRED',
    });
  });

  it('blocks tax-appeal release without a resolved county FIPS', () => {
    const result = evaluateTaxAppealRelease({
      serviceType: 'tax_appeal',
      reportCountyFips: null,
      reportState: 'IL',
      countyRule: createRule(),
      filingGuide: createGuide(),
      now: NOW,
    });

    expect(result).toMatchObject({
      allowed: false,
      code: 'REPORT_COUNTY_FIPS_MISSING',
    });
  });

  it.each(JURISDICTION_FAILURE_CASES)(
    'propagates the verified county-rule failure %s',
    (code, rule) => {
      const result = evaluateTaxAppealRelease({
        serviceType: 'tax_appeal',
        reportCountyFips: '17031',
        reportState: 'IL',
        countyRule: rule,
        filingGuide: createGuide(),
        now: NOW,
      });

      expect(result.allowed).toBe(false);
      expect(result.code).toBe(code);
    }
  );

  it('blocks a missing or structurally incomplete filing guide', () => {
    const missing = evaluateTaxAppealRelease({
      serviceType: 'tax_appeal',
      reportCountyFips: '17031',
      reportState: 'IL',
      countyRule: createRule(),
      filingGuide: null,
      now: NOW,
    });
    const incomplete = evaluateTaxAppealRelease({
      serviceType: 'tax_appeal',
      reportCountyFips: '17031',
      reportState: 'IL',
      countyRule: createRule(),
      filingGuide: createGuide({ required_documents: [] }),
      now: NOW,
    });

    expect(missing.code).toBe('FILING_GUIDE_MISSING');
    expect(incomplete.code).toBe('FILING_GUIDE_INCOMPLETE');
  });

  it('blocks authority and deadline contradictions', () => {
    const authorityMismatch = evaluateTaxAppealRelease({
      serviceType: 'tax_appeal',
      reportCountyFips: '17031',
      reportState: 'IL',
      countyRule: createRule(),
      filingGuide: createGuide({ appeal_board_name: 'Cook County Assessor' }),
      now: NOW,
    });
    const deadlineMismatch = evaluateTaxAppealRelease({
      serviceType: 'tax_appeal',
      reportCountyFips: '17031',
      reportState: 'IL',
      countyRule: createRule(),
      filingGuide: createGuide({ filing_deadline: 'September 15, 2026' }),
      now: NOW,
    });

    expect(authorityMismatch.code).toBe('FILING_AUTHORITY_MISMATCH');
    expect(deadlineMismatch.code).toBe('FILING_DEADLINE_MISMATCH');
  });

  it('accepts a complete guide that matches the current verified rule', () => {
    const result = evaluateTaxAppealRelease({
      serviceType: 'tax_appeal',
      reportCountyFips: '17031',
      reportState: 'IL',
      countyRule: createRule(),
      filingGuide: createGuide(),
      now: NOW,
    });

    expect(result).toMatchObject({
      allowed: true,
      code: 'JURISDICTION_RELEASE_READY',
      jurisdictionEvaluation: {
        allowed: true,
        filingAuthority: 'Cook County Board of Review',
        filingDeadline: '2026-08-01',
      },
    });
  });
});
