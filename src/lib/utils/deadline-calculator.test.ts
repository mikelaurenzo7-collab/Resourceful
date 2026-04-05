import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculateDeadline, calculateAnnualSavings } from './deadline-calculator';
import type { CountyRule } from '@/types/database';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Build a minimal CountyRule with only the fields used by calculateDeadline.
function makeRule(overrides: Partial<CountyRule> = {}): CountyRule {
  return {
    county_fips: '17031',
    county_name: 'Cook County',
    state_name: 'Illinois',
    state_abbreviation: 'IL',
    assessment_ratio_residential: 0.1,
    assessment_ratio_commercial: 0.25,
    assessment_ratio_industrial: 0.25,
    assessment_methodology: 'market value',
    assessment_methodology_notes: null,
    appeal_board_name: 'Cook County Board of Review',
    appeal_board_address: null,
    appeal_board_phone: null,
    portal_url: null,
    filing_email: null,
    accepts_online_filing: true,
    accepts_email_filing: false,
    requires_mail_filing: false,
    state_appeal_board_name: null,
    state_appeal_board_url: null,
    appeal_deadline_rule: 'Contact the assessor',
    tax_year_appeal_window: null,
    typical_resolution_weeks_min: null,
    typical_resolution_weeks_max: null,
    hearing_typically_required: false,
    hearing_format: null,
    appeal_form_name: null,
    form_download_url: null,
    evidence_requirements: null,
    filing_fee_cents: 0,
    filing_fee_notes: null,
    assessor_api_url: null,
    assessor_api_documentation_url: null,
    assessor_api_notes: null,
    pro_se_tips: null,
    assessment_cycle: null,
    assessment_notices_mailed: null,
    appeal_window_days: null,
    appeal_window_start_month: null,
    appeal_window_end_month: null,
    appeal_window_end_day: null,
    next_appeal_deadline: null,
    current_tax_year: null,
    filing_steps: null,
    required_documents: null,
    informal_review_available: false,
    informal_review_notes: null,
    ...overrides,
  } as CountyRule;
}

// ─── calculateDeadline — null input ──────────────────────────────────────────

describe('calculateDeadline — null input', () => {
  it('returns unknown when countyRule is null', () => {
    const result = calculateDeadline(null);
    expect(result.deadline).toBeNull();
    expect(result.daysRemaining).toBeNull();
    expect(result.source).toBe('unknown');
    expect(result.urgencyLevel).toBe('unknown');
    expect(result.displayText).toContain('Contact your county assessor');
  });
});

// ─── calculateDeadline — strategy 1: exact date ───────────────────────────────

describe('calculateDeadline — strategy 1: exact next_appeal_deadline', () => {
  beforeEach(() => {
    // Fix "today" to 2026-01-01
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns exact source and correct days remaining for a future deadline', () => {
    const rule = makeRule({ next_appeal_deadline: '2026-03-31' });
    const result = calculateDeadline(rule);

    expect(result.source).toBe('exact');
    expect(result.deadline).toBe('2026-03-31');
    expect(result.daysRemaining).toBeGreaterThan(0);
  });

  it('assigns urgency level "plenty" for a deadline > 60 days away', () => {
    const rule = makeRule({ next_appeal_deadline: '2026-06-01' });
    const result = calculateDeadline(rule);
    expect(result.urgencyLevel).toBe('plenty');
  });

  it('assigns urgency level "normal" for a deadline 31-60 days away', () => {
    // 2026-01-01 + 45 days = 2026-02-15
    const rule = makeRule({ next_appeal_deadline: '2026-02-15' });
    const result = calculateDeadline(rule);
    expect(result.urgencyLevel).toBe('normal');
  });

  it('assigns urgency level "urgent" for a deadline 8-30 days away', () => {
    // 2026-01-01 + 20 days = 2026-01-21
    const rule = makeRule({ next_appeal_deadline: '2026-01-21' });
    const result = calculateDeadline(rule);
    expect(result.urgencyLevel).toBe('urgent');
  });

  it('assigns urgency level "critical" for a deadline ≤ 7 days away', () => {
    const rule = makeRule({ next_appeal_deadline: '2026-01-05' });
    const result = calculateDeadline(rule);
    expect(result.urgencyLevel).toBe('critical');
  });

  it('assigns urgency level "expired" for a past deadline', () => {
    const rule = makeRule({ next_appeal_deadline: '2025-12-01' });
    const result = calculateDeadline(rule);
    expect(result.urgencyLevel).toBe('expired');
    expect(result.daysRemaining).toBeLessThan(0);
    expect(result.displayText).toContain('EXPIRED');
  });

  it('formats display text with TODAY message when deadline is today', () => {
    const rule = makeRule({ next_appeal_deadline: '2026-01-01' });
    const result = calculateDeadline(rule);
    expect(result.displayText).toContain('TODAY');
  });

  it('formats display text with TOMORROW message when deadline is tomorrow', () => {
    const rule = makeRule({ next_appeal_deadline: '2026-01-02' });
    const result = calculateDeadline(rule);
    expect(result.displayText).toContain('TOMORROW');
  });
});

// ─── calculateDeadline — strategy 2: calculated from window ──────────────────

describe('calculateDeadline — strategy 2: appeal_window_end_month/day', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses appeal window end month/day to calculate deadline', () => {
    // March 31 is in the future relative to Jan 1
    const rule = makeRule({ appeal_window_end_month: 3, appeal_window_end_day: 31 });
    const result = calculateDeadline(rule);
    expect(result.source).toBe('calculated');
    expect(result.deadline).toBe('2026-03-31');
  });

  it('rolls over to next year when appeal window has already passed this year', () => {
    // Advance time to Dec 2 so Dec 1 is now in the past
    vi.setSystemTime(new Date('2026-12-02T00:00:00.000Z'));
    const rule = makeRule({ appeal_window_end_month: 12, appeal_window_end_day: 1 });
    const result = calculateDeadline(rule);
    expect(result.source).toBe('calculated');
    expect(result.deadline).toBe('2027-12-01');
  });

  it('uses current_tax_year when provided', () => {
    const rule = makeRule({
      appeal_window_end_month: 6,
      appeal_window_end_day: 15,
      current_tax_year: 2026,
    });
    const result = calculateDeadline(rule);
    expect(result.source).toBe('calculated');
    expect(result.deadline).toBe('2026-06-15');
  });
});

// ─── calculateDeadline — strategy 3: rule text ────────────────────────────────

describe('calculateDeadline — strategy 3: appeal_deadline_rule text', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('extracts a future date from "Month Day" rule text', () => {
    const rule = makeRule({ appeal_deadline_rule: 'Appeals must be filed by March 31 annually.' });
    const result = calculateDeadline(rule);
    expect(result.source).toBe('calculated');
    expect(result.deadline).toBe('2026-03-31');
  });

  it('handles ordinal suffixes in rule text (e.g. "May 15th")', () => {
    const rule = makeRule({ appeal_deadline_rule: 'Deadline is May 15th each year.' });
    const result = calculateDeadline(rule);
    expect(result.source).toBe('calculated');
    expect(result.deadline).toBe('2026-05-15');
  });

  it('returns rule_text source when no date can be extracted', () => {
    const rule = makeRule({
      appeal_deadline_rule: 'Contact the county assessor for your specific deadline.',
    });
    const result = calculateDeadline(rule);
    expect(result.source).toBe('rule_text');
    expect(result.deadline).toBeNull();
    expect(result.displayText).toBe('Contact the county assessor for your specific deadline.');
  });

  it('returns unknown when no strategies match', () => {
    const rule = makeRule({
      appeal_deadline_rule: '',
    });
    const result = calculateDeadline(rule);
    expect(result.source).toBe('unknown');
    expect(result.displayText).toContain('Contact your county assessor');
  });
});

// ─── calculateAnnualSavings ──────────────────────────────────────────────────

describe('calculateAnnualSavings', () => {
  it('calculates savings correctly with a standard scenario', () => {
    // Overassessed by $50k, 10% assessment ratio, 2% tax rate
    // Overassessment = 50000, taxable = 5000, savings = 5000 * 0.02 = 100
    const result = calculateAnnualSavings(500_000, 450_000, 0.10, 0.02);
    expect(result.savingsPerYear).toBe(100);
    expect(result.cycleLengthYears).toBe(1);
    expect(result.savingsOverCycle).toBe(result.savingsPerYear);
  });

  it('returns zero savings when concluded value exceeds assessed value', () => {
    const result = calculateAnnualSavings(400_000, 500_000, 0.10, 0.02);
    expect(result.savingsPerYear).toBe(0);
  });

  it('returns zero savings when assessed equals concluded', () => {
    const result = calculateAnnualSavings(400_000, 400_000, 0.10, 0.02);
    expect(result.savingsPerYear).toBe(0);
  });

  it('uses default tax rate of 2% when not provided', () => {
    // Overassessment = 100000, ratio = 1.0 (100%), rate = 0.02 → 100000 * 0.02 = 2000
    const result = calculateAnnualSavings(300_000, 200_000, 1.0);
    expect(result.savingsPerYear).toBe(2_000);
  });

  it('scales correctly with a high assessment ratio', () => {
    // $100k overassessment, 25% ratio, 2% rate → 100000 * 0.25 * 0.02 = 500
    const result = calculateAnnualSavings(500_000, 400_000, 0.25, 0.02);
    expect(result.savingsPerYear).toBe(500);
  });

  it('rounds savings to the nearest dollar', () => {
    // Produce a non-integer result: $10k overassessment, 33.3% ratio, 2% rate
    const result = calculateAnnualSavings(110_000, 100_000, 0.333, 0.02);
    expect(Number.isInteger(result.savingsPerYear)).toBe(true);
  });
});
