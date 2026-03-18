import { describe, it, expect } from 'vitest';
import {
  getPriceForReport,
  getPriceCents,
  formatPrice,
  PRICING,
  PRICING_GUIDED,
  PRICING_EXPERT,
  MONEY_BACK_GUARANTEE,
} from './pricing';

// ─── formatPrice ────────────────────────────────────────────────────────────

describe('formatPrice', () => {
  it('converts cents to dollar string', () => {
    expect(formatPrice(5900)).toBe('$59');
    expect(formatPrice(17700)).toBe('$177');
    expect(formatPrice(100)).toBe('$1');
  });
});

// ─── MONEY_BACK_GUARANTEE ───────────────────────────────────────────────────

describe('MONEY_BACK_GUARANTEE', () => {
  it('is enabled', () => {
    expect(MONEY_BACK_GUARANTEE).toBe(true);
  });
});

// ─── getPriceForReport (auto tier) ──────────────────────────────────────────

describe('getPriceForReport — auto tier', () => {
  it('returns correct price for residential tax appeal', () => {
    expect(getPriceForReport('tax_appeal', 'residential')).toBe(5900);
  });

  it('returns correct price for commercial tax appeal', () => {
    expect(getPriceForReport('tax_appeal', 'commercial')).toBe(10900);
  });

  it('returns correct price for industrial tax appeal', () => {
    expect(getPriceForReport('tax_appeal', 'industrial')).toBe(10900);
  });

  it('returns correct price for land tax appeal', () => {
    expect(getPriceForReport('tax_appeal', 'land')).toBe(5900);
  });

  it('returns correct price for pre_purchase', () => {
    expect(getPriceForReport('pre_purchase', 'residential')).toBe(6900);
    expect(getPriceForReport('pre_purchase', 'commercial')).toBe(6900);
  });

  it('returns correct price for pre_listing', () => {
    expect(getPriceForReport('pre_listing', 'residential')).toBe(6900);
  });
});

// ─── getPriceForReport (guided tier — 2x base) ─────────────────────────────

describe('getPriceForReport — guided tier', () => {
  it('returns guided price for residential tax appeal', () => {
    expect(getPriceForReport('tax_appeal', 'residential', 'guided_filing')).toBe(11800);
  });

  it('returns guided price for commercial tax appeal', () => {
    expect(getPriceForReport('tax_appeal', 'commercial', 'guided_filing')).toBe(21800);
  });

  it('returns guided price for pre_purchase', () => {
    expect(getPriceForReport('pre_purchase', 'residential', 'guided_filing')).toBe(13800);
  });
});

// ─── getPriceForReport (expert tier — 3x base) ─────────────────────────────

describe('getPriceForReport — expert tier', () => {
  it('returns expert price for residential tax appeal', () => {
    expect(getPriceForReport('tax_appeal', 'residential', 'expert_reviewed')).toBe(17700);
  });

  it('returns expert price for commercial tax appeal', () => {
    expect(getPriceForReport('tax_appeal', 'commercial', 'expert_reviewed')).toBe(32700);
  });

  it('returns expert price for pre_purchase', () => {
    expect(getPriceForReport('pre_purchase', 'residential', 'expert_reviewed')).toBe(20700);
  });
});

// ─── getPriceCents (backward compat) ────────────────────────────────────────

describe('getPriceCents', () => {
  it('delegates to getPriceForReport', () => {
    expect(getPriceCents('tax_appeal', 'residential')).toBe(
      getPriceForReport('tax_appeal', 'residential')
    );
    expect(getPriceCents('tax_appeal', 'commercial', 'expert_reviewed')).toBe(
      getPriceForReport('tax_appeal', 'commercial', 'expert_reviewed')
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

  it('guided prices are 2x auto for every key', () => {
    const keys = Object.keys(PRICING) as (keyof typeof PRICING)[];
    for (const key of keys) {
      expect(PRICING_GUIDED[key]).toBe(PRICING[key] * 2);
    }
  });

  it('expert prices are 3x auto for every key', () => {
    const keys = Object.keys(PRICING) as (keyof typeof PRICING)[];
    for (const key of keys) {
      expect(PRICING_EXPERT[key]).toBe(PRICING[key] * 3);
    }
  });

  it('guided prices are higher than auto for every key', () => {
    const keys = Object.keys(PRICING) as (keyof typeof PRICING)[];
    for (const key of keys) {
      expect(PRICING_GUIDED[key]).toBeGreaterThan(PRICING[key]);
    }
  });

  it('expert prices are higher than guided for every key', () => {
    const keys = Object.keys(PRICING) as (keyof typeof PRICING)[];
    for (const key of keys) {
      expect(PRICING_EXPERT[key]).toBeGreaterThan(PRICING_GUIDED[key]);
    }
  });
});
