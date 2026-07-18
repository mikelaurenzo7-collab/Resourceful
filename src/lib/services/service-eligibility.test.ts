import { describe, expect, it } from 'vitest';

import { validateCheckoutService } from './service-eligibility';

describe('validateCheckoutService', () => {
  it('allows bounded analysis and expert review across supported service types', () => {
    expect(validateCheckoutService('tax_appeal', 'auto', 'commercial')).toEqual({ allowed: true });
    expect(validateCheckoutService('pre_purchase', 'expert_reviewed', 'residential')).toEqual({ allowed: true });
    expect(validateCheckoutService('pre_listing', 'auto', 'industrial')).toEqual({ allowed: true });
  });

  it('allows guided filing only for residential tax appeals at instant checkout', () => {
    expect(
      validateCheckoutService('tax_appeal', 'guided_filing', 'residential')
    ).toEqual({ allowed: true });

    const nonAppeal = validateCheckoutService('pre_purchase', 'guided_filing', 'residential');
    expect(nonAppeal.allowed).toBe(false);
    if (!nonAppeal.allowed) {
      expect(nonAppeal.code).toBe('SERVICE_TIER_NOT_AVAILABLE');
      expect(nonAppeal.recommendedTier).toBe('expert_reviewed');
    }

    for (const propertyType of ['commercial', 'industrial', 'land', 'agricultural'] as const) {
      const result = validateCheckoutService('tax_appeal', 'guided_filing', propertyType);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('PROPERTY_SCOPE_REVIEW_REQUIRED');
        expect(result.recommendedTier).toBe('expert_reviewed');
      }
    }
  });

  it('requires a separate eligibility review for full representation', () => {
    const residential = validateCheckoutService(
      'tax_appeal',
      'full_representation',
      'residential'
    );
    expect(residential.allowed).toBe(false);
    if (!residential.allowed) {
      expect(residential.code).toBe('REPRESENTATION_REQUIRES_REVIEW');
      expect(residential.recommendedTier).toBe('guided_filing');
    }

    const commercial = validateCheckoutService(
      'tax_appeal',
      'full_representation',
      'commercial'
    );
    expect(commercial.allowed).toBe(false);
    if (!commercial.allowed) {
      expect(commercial.code).toBe('REPRESENTATION_REQUIRES_REVIEW');
      expect(commercial.recommendedTier).toBe('expert_reviewed');
    }
  });
});
