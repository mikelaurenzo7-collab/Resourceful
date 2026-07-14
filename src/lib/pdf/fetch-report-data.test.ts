import { describe, expect, it } from 'vitest';
import type { CountyRule, Report } from '@/types/database';
import {
  parseStructuredFilingGuide,
  recoverLegacyFilingGuide,
} from './fetch-report-data';

const report = {
  id: 'report-1',
  county: 'Cook County',
  county_fips: '17031',
} as unknown as Report;

const countyRule = {
  appeal_board_name: 'Cook County Board of Review',
  next_appeal_deadline: '2026-08-15',
  appeal_deadline_rule: null,
  tax_year_appeal_window: null,
  portal_url: 'https://example.gov/appeal',
  filing_fee_cents: 2500,
  hearing_format: 'virtual',
  required_documents: ['Appeal form', 'Evidence package'],
  evidence_requirements: ['Comparable sales'],
  pro_se_tips: 'Keep proof of filing.',
  filing_steps: [
    { step_number: 1, title: 'Open portal', description: 'Start the appeal.' },
  ],
} as unknown as CountyRule;

describe('parseStructuredFilingGuide', () => {
  it('uses verified jurisdiction facts and rejects a model-supplied unsafe URL', () => {
    const content = JSON.stringify({
      appeal_board_name: 'Invented Board',
      filing_deadline: 'Tomorrow',
      steps: ['Verify eligibility', 'Submit the evidence package'],
      required_documents: ['Model document'],
      tips: ['Model tip'],
      online_filing_url: 'javascript:alert(1)',
      fee_amount: '$999.00',
      hearing_format: 'written_only',
    });

    const guide = parseStructuredFilingGuide(content, report, countyRule);

    expect(guide).not.toBeNull();
    expect(guide?.appeal_board_name).toBe('Cook County Board of Review');
    expect(guide?.online_filing_url).toBe('https://example.gov/appeal');
    expect(guide?.fee_amount).toBe('$25.00');
    expect(guide?.hearing_format).toBe('virtual');
  });

  it('accepts a valid HTTPS filing URL when no jurisdiction rule is available', () => {
    const content = JSON.stringify({
      appeal_board_name: 'County Review Board',
      filing_deadline: 'Verify by August 1',
      steps: ['Confirm deadline', 'File the appeal'],
      required_documents: [],
      tips: [],
      online_filing_url: 'https://portal.example.gov/submit',
      fee_amount: null,
      hearing_format: null,
    });

    const guide = parseStructuredFilingGuide(content, report, null);

    expect(guide?.online_filing_url).toBe('https://portal.example.gov/submit');
    expect(guide?.appeal_board_name).toBe('County Review Board');
  });

  it('drops an unsafe filing URL when no trusted jurisdiction URL exists', () => {
    const content = JSON.stringify({
      appeal_board_name: 'County Review Board',
      filing_deadline: 'Verify deadline',
      steps: ['Confirm deadline'],
      required_documents: [],
      tips: [],
      online_filing_url: 'data:text/html,unsafe',
      fee_amount: null,
      hearing_format: null,
    });

    const guide = parseStructuredFilingGuide(content, report, null);

    expect(guide?.online_filing_url).toBeNull();
  });

  it('returns null for invalid JSON or a guide without executable steps', () => {
    expect(parseStructuredFilingGuide('not-json', report, countyRule)).toBeNull();
    expect(
      parseStructuredFilingGuide(JSON.stringify({ steps: [] }), report, countyRule)
    ).toBeNull();
  });
});

describe('recoverLegacyFilingGuide', () => {
  it('prioritizes verified county steps and jurisdiction requirements', () => {
    const legacy = `# Filing Guide
1. Model-generated first step
2. Model-generated second step
- Bring a copy to the hearing`;

    const guide = recoverLegacyFilingGuide(legacy, report, countyRule);

    expect(guide.steps).toEqual(['Open portal: Start the appeal.']);
    expect(guide.required_documents).toEqual(['Appeal form', 'Evidence package']);
    expect(guide.tips).toContain('Keep proof of filing.');
    expect(guide.online_filing_url).toBe('https://example.gov/appeal');
    expect(guide.fee_amount).toBe('$25.00');
    expect(guide.hearing_format).toBe('virtual');
  });

  it('extracts numbered Markdown steps when county steps are unavailable', () => {
    const legacy = `# Filing Guide
1. Verify the deadline
2) Assemble the evidence
Step 3: Submit and retain proof
- Keep a complete copy`;

    const guide = recoverLegacyFilingGuide(legacy, report, null);

    expect(guide.steps).toEqual([
      'Verify the deadline',
      'Assemble the evidence',
      'Submit and retain proof',
    ]);
    expect(guide.tips).toContain('Keep a complete copy');
    expect(guide.online_filing_url).toBeNull();
  });

  it('uses safe nationwide verification fallbacks when jurisdiction data is absent', () => {
    const guide = recoverLegacyFilingGuide(
      '# Filing Guide\nNo executable numbered steps were supplied.',
      report,
      null
    );

    expect(guide.appeal_board_name.toLowerCase()).toContain('verify official name');
    expect(guide.filing_deadline.toLowerCase()).toContain('verify');
    expect(guide.steps.length).toBeGreaterThanOrEqual(5);
    expect(guide.required_documents[0].toLowerCase()).toContain('confirm');
    expect(guide.tips.some((tip) => tip.includes('not legal advice'))).toBe(true);
  });

  it('rejects unsafe jurisdiction URLs in recovered legacy guides', () => {
    const unsafeRule = {
      ...countyRule,
      portal_url: 'javascript:alert(1)',
    } as unknown as CountyRule;

    const guide = recoverLegacyFilingGuide('1. Confirm the deadline', report, unsafeRule);

    expect(guide.online_filing_url).toBeNull();
  });
});
