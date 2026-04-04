import { describe, it, expect } from 'vitest';
import {
  getPriceForReport,
  getPriceCents,
  formatPrice,
  PRICING,
  PRICING_EXPERT,
  PRICING_GUIDED,
  PRICING_FULL_REPRESENTATION,
  TAX_BILL_DISCOUNT,
} from './pricing';

// ─── formatPrice ────────────────────────────────────────────────────────────

describe('formatPrice', () => {
  it('converts cents to dollar string', () => {
    expect(formatPrice(4900)).toBe('$49');
    expect(formatPrice(14900)).toBe('$149');
    expect(formatPrice(100)).toBe('$1');
  });
});

// ─── TAX_BILL_DISCOUNT ─────────────────────────────────────────────────────

describe('TAX_BILL_DISCOUNT', () => {
  it('is 15%', () => {
    expect(TAX_BILL_DISCOUNT).toBe(0.15);
  });
});

// ─── getPriceForReport (auto tier) ──────────────────────────────────────────

describe('getPriceForReport — auto tier', () => {
  it('returns correct price for residential tax appeal', () => {
    expect(getPriceForReport('tax_appeal', 'residential')).toBe(4900);
  });

  it('returns correct price for commercial tax appeal', () => {
    expect(getPriceForReport('tax_appeal', 'commercial')).toBe(9900);
  });

  it('returns correct price for industrial tax appeal', () => {
    expect(getPriceForReport('tax_appeal', 'industrial')).toBe(9900);
  });

  it('returns correct price for land tax appeal', () => {
    expect(getPriceForReport('tax_appeal', 'land')).toBe(4900);
  });

  it('returns correct price for pre_purchase', () => {
    expect(getPriceForReport('pre_purchase', 'residential')).toBe(5900);
    expect(getPriceForReport('pre_purchase', 'commercial')).toBe(5900);
  });

  it('returns correct price for pre_listing', () => {
    expect(getPriceForReport('pre_listing', 'residential')).toBe(5900);
  });
});

// ─── getPriceForReport (expert tier) ────────────────────────────────────────

describe('getPriceForReport — expert tier', () => {
  it('returns expert price for residential tax appeal', () => {
    expect(getPriceForReport('tax_appeal', 'residential', 'expert_reviewed')).toBe(14900);
  });

  it('returns expert price for commercial tax appeal', () => {
    expect(getPriceForReport('tax_appeal', 'commercial', 'expert_reviewed')).toBe(24900);
  });

  it('returns expert price for pre_purchase', () => {
    expect(getPriceForReport('pre_purchase', 'residential', 'expert_reviewed')).toBe(17900);
  });
});

// ─── getPriceForReport (tax bill discount) ──────────────────────────────────

describe('getPriceForReport — tax bill discount', () => {
  it('applies 15% discount and rounds to nearest dollar', () => {
    // $49 * 0.85 = $41.65 → rounds to $42 → 4200 cents
    expect(getPriceForReport('tax_appeal', 'residential', 'auto', true)).toBe(4200);
  });

  it('applies discount to commercial', () => {
    // $99 * 0.85 = $84.15 → rounds to $84 → 8400 cents
    expect(getPriceForReport('tax_appeal', 'commercial', 'auto', true)).toBe(8400);
  });

  it('applies discount to expert tier', () => {
    // $149 * 0.85 = $126.65 → rounds to $127 → 12700 cents
    expect(getPriceForReport('tax_appeal', 'residential', 'expert_reviewed', true)).toBe(12700);
  });

  it('applies discount to pre_purchase', () => {
    // $59 * 0.85 = $50.15 → rounds to $50 → 5000 cents
    expect(getPriceForReport('pre_purchase', 'residential', 'auto', true)).toBe(5000);
  });
});

// ─── getPriceCents (backward compat) ────────────────────────────────────────

describe('getPriceCents', () => {
  it('delegates to getPriceForReport', () => {
    expect(getPriceCents('tax_appeal', 'residential')).toBe(
      getPriceForReport('tax_appeal', 'residential')
    );
    expect(getPriceCents('tax_appeal', 'commercial', 'expert_reviewed', true)).toBe(
      getPriceForReport('tax_appeal', 'commercial', 'expert_reviewed', true)
    );
  });
});

// ─── Pricing constant integrity ─────────────────────────────────────────────

describe('pricing constants', () => {
  it('auto prices are all positive integers', () => {
    for (const value of Object.values(PRICING)) {
      expect(value).toBeGreaterThan(0);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('expert prices are higher than auto for every key', () => {
    const keys = Object.keys(PRICING) as (keyof typeof PRICING)[];
    for (const key of keys) {
      expect(PRICING_EXPERT[key]).toBeGreaterThan(PRICING[key]);
    }
  });
});

// ─── Guided Filing Tier ────────────────────────────────────────────────────

describe('getPriceForReport — guided_filing tier', () => {
  it('returns guided price for residential tax appeal', () => {
    expect(getPriceForReport('tax_appeal', 'residential', 'guided_filing')).toBe(19900);
  });

  it('returns guided price for commercial tax appeal', () => {
    expect(getPriceForReport('tax_appeal', 'commercial', 'guided_filing')).toBe(34900);
  });

  it('downgrades to expert for pre_purchase', () => {
    expect(getPriceForReport('pre_purchase', 'residential', 'guided_filing')).toBe(17900);
  });

  it('downgrades to expert for pre_listing', () => {
    expect(getPriceForReport('pre_listing', 'residential', 'guided_filing')).toBe(17900);
  });
});

// ─── Full Representation Tier ──────────────────────────────────────────────

describe('getPriceForReport — full_representation tier', () => {
  it('returns full_rep price for residential tax appeal', () => {
    expect(getPriceForReport('tax_appeal', 'residential', 'full_representation')).toBe(39900);
  });

  it('returns full_rep price for commercial tax appeal', () => {
    expect(getPriceForReport('tax_appeal', 'commercial', 'full_representation')).toBe(59900);
  });

  it('returns full_rep price for industrial tax appeal', () => {
    expect(getPriceForReport('tax_appeal', 'industrial', 'full_representation')).toBe(59900);
  });

  it('returns full_rep price for land tax appeal', () => {
    expect(getPriceForReport('tax_appeal', 'land', 'full_representation')).toBe(39900);
  });

  it('downgrades to expert for pre_purchase', () => {
    expect(getPriceForReport('pre_purchase', 'residential', 'full_representation')).toBe(17900);
  });

  it('downgrades to expert for pre_listing', () => {
    expect(getPriceForReport('pre_listing', 'residential', 'full_representation')).toBe(17900);
  });

  it('applies tax bill discount to full_rep price', () => {
    // $399 * 0.85 = $339.15 → rounds to $339 → 33900 cents
    expect(getPriceForReport('tax_appeal', 'residential', 'full_representation', true)).toBe(33900);
  });
});

// ─── Pricing Constants — All Tiers ─────────────────────────────────────────

describe('pricing constants — all tiers integrity', () => {
  it('PRICING_GUIDED values are all positive integers', () => {
    for (const value of Object.values(PRICING_GUIDED)) {
      expect(value).toBeGreaterThan(0);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('PRICING_FULL_REPRESENTATION values are all positive integers', () => {
    for (const value of Object.values(PRICING_FULL_REPRESENTATION)) {
      expect(value).toBeGreaterThan(0);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('full_rep >= guided >= expert >= auto for tax appeal types', () => {
    const taxKeys = ['TAX_APPEAL_RESIDENTIAL', 'TAX_APPEAL_COMMERCIAL', 'TAX_APPEAL_INDUSTRIAL', 'TAX_APPEAL_LAND'] as const;
    for (const key of taxKeys) {
      expect(PRICING_FULL_REPRESENTATION[key]).toBeGreaterThanOrEqual(PRICING_GUIDED[key]);
      expect(PRICING_GUIDED[key]).toBeGreaterThanOrEqual(PRICING_EXPERT[key]);
      expect(PRICING_EXPERT[key]).toBeGreaterThanOrEqual(PRICING[key]);
    }
  });
});
