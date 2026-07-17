import { describe, expect, it } from 'vitest';

import { validateCheckoutService } from './service-eligibility';

describe('validateCheckoutService', () => {
  it('allows analysis and expert review across supported service types', () => {
    expect(validateCheckoutService('tax_appeal', 'auto')).toEqual({ allowed: true });
    expect(validateCheckoutService('pre_purchase', 'expert_reviewed')).toEqual({ allowed: true });
    expect(validateCheckoutService('pre_listing', 'auto')).toEqual({ allowed: true });
  });

  it('allows guided filing only for tax appeals', () => {
    expect(validateCheckoutService('tax_appeal', 'guided_filing')).toEqual({ allowed: true });

    const result = validateCheckoutService('pre_purchase', 'guided_filing');
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe('SERVICE_TIER_NOT_AVAILABLE');
      expect(result.recommendedTier).toBe('expert_reviewed');
    }
  });

  it('requires a separate eligibility review for full representation', () => {
    const result = validateCheckoutService('tax_appeal', 'full_representation');
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe('REPRESENTATION_REQUIRES_REVIEW');
      expect(result.recommendedTier).toBe('guided_filing');
    }
  });
});
