/**
 * End-to-end intake + pipeline-routing tests for 25W050 Setauket Avenue, Naperville IL.
 *
 * Pure-logic tests (no network, no DB) that verify:
 *  - The intake payload passes schema validation
 *  - The correct pipeline stages will run for this property type
 *  - DuPage County FIPS is correctly formatted
 *  - Pricing logic is consistent with the policy rules
 *
 * Run with: pnpm test
 * Full live test: node scripts/run-setauket-e2e.mjs (requires dev server + supabase)
 */

import { describe, it, expect } from 'vitest';
import { reportCreateSchema } from '@/lib/validations/report';
import { PRICING_EXPERT, TAX_BILL_DISCOUNT, getPriceForReport } from '@/config/pricing';

// ── Test subject ──────────────────────────────────────────────────────────────

const SETAUKET_PAYLOAD = {
  client_email:     'mikelaurenzo7@gmail.com',
  client_name:      'Mike (E2E Test)',
  property_address: '25W050 Setauket Avenue',
  city:             'Naperville',
  state:            'IL',
  county:           'DuPage County',
  county_fips:      '17043',
  property_type:    'residential' as const,
  service_type:     'tax_appeal' as const,
  review_tier:      'expert_reviewed' as const,
  photos_skipped:   true,
  property_issues:  [] as string[],
  additional_notes: 'E2E test — 25W050 Setauket Ave, Naperville IL (DuPage)',
  desired_outcome:  'Verify assessed value accuracy in DuPage County',
  has_tax_bill:     false,
};

// Replicated from orchestrator.ts (must stay in sync)
type PropertyType = 'residential' | 'commercial' | 'industrial' | 'land' | 'agricultural';
const stage3SkipWhen = (pt: PropertyType, _st: string) =>
  pt !== 'commercial' && pt !== 'industrial' && pt !== 'residential' && pt !== 'agricultural';
const stage6SkipWhen = (_pt: PropertyType, st: string) => st !== 'tax_appeal';

// ── Intake schema ─────────────────────────────────────────────────────────────

describe('25W050 Setauket Avenue — intake validation', () => {
  it('accepts the standard payload without errors', () => {
    const result = reportCreateSchema.safeParse(SETAUKET_PAYLOAD);
    expect(result.success).toBe(true);
  });

  it('normalises state to uppercase IL', () => {
    const result = reportCreateSchema.safeParse({ ...SETAUKET_PAYLOAD, state: 'il' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.state).toBe('IL');
  });

  it('requires a valid 5-digit FIPS code', () => {
    const bad = reportCreateSchema.safeParse({ ...SETAUKET_PAYLOAD, county_fips: '17' });
    expect(bad.success).toBe(false);
  });

  it('DuPage County FIPS 17043 is valid', () => {
    const result = reportCreateSchema.safeParse(SETAUKET_PAYLOAD);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.county_fips).toBe('17043');
  });

  it('accepts the DuPage-style grid-based address (25W050 format)', () => {
    const result = reportCreateSchema.safeParse(SETAUKET_PAYLOAD);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.property_address).toBe('25W050 Setauket Avenue');
  });

  it('rejects has_tax_bill=true without tax_bill_assessed_value', () => {
    const bad = reportCreateSchema.safeParse({ ...SETAUKET_PAYLOAD, has_tax_bill: true });
    expect(bad.success).toBe(false);
  });

  it('accepts has_tax_bill=true when assessed value is provided', () => {
    const ok = reportCreateSchema.safeParse({
      ...SETAUKET_PAYLOAD,
      has_tax_bill:             true,
      tax_bill_assessed_value:  425000,
    });
    expect(ok.success).toBe(true);
  });
});

// ── Pipeline stage routing ────────────────────────────────────────────────────

describe('25W050 Setauket Avenue — pipeline stage routing (residential / tax_appeal)', () => {
  const { property_type: pt, service_type: st } = SETAUKET_PAYLOAD;

  it('stage 3 (income analysis) RUNS for residential', () => {
    expect(stage3SkipWhen(pt, st)).toBe(false);
  });

  it('stage 6 (filing guide) RUNS for tax_appeal', () => {
    expect(stage6SkipWhen(pt, st)).toBe(false);
  });

  it('stage 6 would be SKIPPED for pre_purchase service type', () => {
    expect(stage6SkipWhen(pt, 'pre_purchase')).toBe(true);
  });
});

// ── Pricing rules ────────────────────────────────────────────────────────────

describe('25W050 Setauket Avenue — pricing rules', () => {
  it('expert_reviewed residential tax_appeal price is defined and positive', () => {
    const price = PRICING_EXPERT.TAX_APPEAL_RESIDENTIAL;
    expect(typeof price).toBe('number');
    expect(price).toBeGreaterThan(0);
  });

  it('tax bill discount is between 0 and 1 (ratio)', () => {
    expect(TAX_BILL_DISCOUNT).toBeGreaterThan(0);
    expect(TAX_BILL_DISCOUNT).toBeLessThan(1);
  });

  it('tax-bill discount reduces the price for this property', () => {
    const base       = getPriceForReport('tax_appeal', 'residential', 'expert_reviewed', false);
    const discounted = getPriceForReport('tax_appeal', 'residential', 'expert_reviewed', true);
    expect(discounted).toBeLessThan(base);
  });
});
