import { describe, it, expect } from 'vitest';
import {
  getPriceForReport,
  getPriceCents,
  formatPrice,
  PRICING,
  PRICING_EXPERT,
  PRICING_GUIDED,
  TAX_BILL_DISCOUNT,
} from './pricing';

describe('formatPrice', () => {
  it('converts cents to dollar string', () => {
    expect(formatPrice(4900)).toBe('$49');
    expect(formatPrice(14900)).toBe('$149');
    expect(formatPrice(100)).toBe('$1');
  });
});

describe('TAX_BILL_DISCOUNT', () => {
  it('is 15%', () => {
    expect(TAX_BILL_DISCOUNT).toBe(0.15);
  });
});

describe('getPriceForReport — Case Analysis', () => {
  it('returns correct tax-appeal prices', () => {
    expect(getPriceForReport('tax_appeal', 'residential')).toBe(4900);
    expect(getPriceForReport('tax_appeal', 'commercial')).toBe(9900);
    expect(getPriceForReport('tax_appeal', 'industrial')).toBe(9900);
    expect(getPriceForReport('tax_appeal', 'land')).toBe(4900);
    expect(getPriceForReport('tax_appeal', 'agricultural')).toBe(4900);
  });

  it('returns correct non-appeal prices', () => {
    expect(getPriceForReport('pre_purchase', 'residential')).toBe(5900);
    expect(getPriceForReport('pre_purchase', 'commercial')).toBe(5900);
    expect(getPriceForReport('pre_listing', 'residential')).toBe(5900);
  });
});

describe('getPriceForReport — Expert Review', () => {
  it('returns expert prices', () => {
    expect(getPriceForReport('tax_appeal', 'residential', 'expert_reviewed')).toBe(14900);
    expect(getPriceForReport('tax_appeal', 'commercial', 'expert_reviewed')).toBe(24900);
    expect(getPriceForReport('pre_purchase', 'residential', 'expert_reviewed')).toBe(17900);
  });
});

describe('getPriceForReport — tax bill discount', () => {
  it('applies 15% and rounds to the nearest dollar', () => {
    expect(getPriceForReport('tax_appeal', 'residential', 'auto', true)).toBe(4200);
    expect(getPriceForReport('tax_appeal', 'commercial', 'auto', true)).toBe(8400);
    expect(getPriceForReport('tax_appeal', 'residential', 'expert_reviewed', true)).toBe(12700);
    expect(getPriceForReport('pre_purchase', 'residential', 'auto', true)).toBe(5000);
  });
});

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

describe('pricing constant integrity', () => {
  it('Case Analysis prices are positive integers', () => {
    for (const value of Object.values(PRICING)) {
      expect(value).toBeGreaterThan(0);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('Expert Review prices exceed Case Analysis prices', () => {
    const keys = Object.keys(PRICING) as (keyof typeof PRICING)[];
    for (const key of keys) {
      expect(PRICING_EXPERT[key]).toBeGreaterThan(PRICING[key]);
    }
  });
});

describe('getPriceForReport — Guided Filing', () => {
  it('returns the residential instant-checkout price', () => {
    expect(getPriceForReport('tax_appeal', 'residential', 'guided_filing')).toBe(19900);
  });

  it('retains non-residential internal proposal anchors', () => {
    expect(getPriceForReport('tax_appeal', 'commercial', 'guided_filing')).toBe(34900);
    expect(getPriceForReport('tax_appeal', 'industrial', 'guided_filing')).toBe(34900);
  });

  it('uses Expert Review display pricing for non-appeal services', () => {
    expect(getPriceForReport('pre_purchase', 'residential', 'guided_filing')).toBe(17900);
    expect(getPriceForReport('pre_listing', 'residential', 'guided_filing')).toBe(17900);
  });

  it('keeps guided proposal anchors at or above Expert Review', () => {
    const taxKeys = [
      'TAX_APPEAL_RESIDENTIAL',
      'TAX_APPEAL_COMMERCIAL',
      'TAX_APPEAL_INDUSTRIAL',
      'TAX_APPEAL_LAND',
    ] as const;

    for (const key of taxKeys) {
      expect(PRICING_GUIDED[key]).toBeGreaterThanOrEqual(PRICING_EXPERT[key]);
    }
  });
});

describe('getPriceForReport — Full Representation', () => {
  it('refuses to produce an instant-checkout price', () => {
    expect(() =>
      getPriceForReport('tax_appeal', 'residential', 'full_representation')
    ).toThrow(/not available through instant pricing/i);

    expect(() =>
      getPriceCents('tax_appeal', 'commercial', 'full_representation')
    ).toThrow(/written-engagement review/i);
  });
});
