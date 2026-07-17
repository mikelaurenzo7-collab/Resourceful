import type { ReviewTier, ServiceType } from '@/types/database';

export type ServiceEligibilityCode =
  | 'SERVICE_TIER_NOT_AVAILABLE'
  | 'REPRESENTATION_REQUIRES_REVIEW';

export type ServiceEligibilityResult =
  | { allowed: true }
  | {
      allowed: false;
      code: ServiceEligibilityCode;
      message: string;
      recommendedTier: ReviewTier;
    };

/**
 * Protect checkout from selling a service before its legal and operational
 * prerequisites are verified. Post-purchase downgrades are not acceptable:
 * the customer must knowingly choose the service they are actually buying.
 */
export function validateCheckoutService(
  serviceType: ServiceType,
  reviewTier: ReviewTier
): ServiceEligibilityResult {
  if (reviewTier === 'full_representation') {
    return {
      allowed: false,
      code: 'REPRESENTATION_REQUIRES_REVIEW',
      message:
        'Full representation requires a jurisdiction, authority, professional-availability, and engagement review before purchase. Choose Guided Filing now or contact support for an eligibility review.',
      recommendedTier: 'guided_filing',
    };
  }

  if (reviewTier === 'guided_filing' && serviceType !== 'tax_appeal') {
    return {
      allowed: false,
      code: 'SERVICE_TIER_NOT_AVAILABLE',
      message:
        'Guided Filing is available only for property tax appeal matters. Choose Expert Review for this property analysis.',
      recommendedTier: 'expert_reviewed',
    };
  }

  return { allowed: true };
}
