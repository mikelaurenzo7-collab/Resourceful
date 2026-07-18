import type { PropertyType, ReviewTier, ServiceType } from '@/types/database';

export type ServiceEligibilityCode =
  | 'SERVICE_TIER_NOT_AVAILABLE'
  | 'PROPERTY_SCOPE_REVIEW_REQUIRED'
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
 * Protect checkout from selling a service before its legal, professional, and
 * operating prerequisites are verified. Post-purchase downgrades are not
 * acceptable: the customer must knowingly choose the service actually bought.
 */
export function validateCheckoutService(
  serviceType: ServiceType,
  reviewTier: ReviewTier,
  propertyType?: PropertyType
): ServiceEligibilityResult {
  const residentialAppeal = serviceType === 'tax_appeal' && propertyType === 'residential';

  if (reviewTier === 'full_representation') {
    return {
      allowed: false,
      code: 'REPRESENTATION_REQUIRES_REVIEW',
      message: residentialAppeal
        ? 'Full representation requires a jurisdiction, authority, professional-availability, conflicts, authorization, fee, and written-engagement review. Choose Guided Filing now or request an eligibility review.'
        : 'Full representation requires a property-scope, jurisdiction, authority, professional-availability, conflicts, authorization, fee, and written-engagement review. Choose Expert Review now or request an eligibility review.',
      recommendedTier: residentialAppeal ? 'guided_filing' : 'expert_reviewed',
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

  if (
    reviewTier === 'guided_filing' &&
    serviceType === 'tax_appeal' &&
    propertyType !== 'residential'
  ) {
    return {
      allowed: false,
      code: 'PROPERTY_SCOPE_REVIEW_REQUIRED',
      message:
        'Guided Filing for commercial, industrial, land, and agricultural appeals requires a property-scope and professional-availability review before purchase. Choose Expert Review now or request scoped filing support.',
      recommendedTier: 'expert_reviewed',
    };
  }

  return { allowed: true };
}
