// ─── Pricing Configuration ───────────────────────────────────────────────────
// All instant-checkout pricing is in cents. Update here to change pricing
// everywhere. Representation is intentionally excluded because it requires a
// scoped written engagement and cannot be reduced to a universal checkout fee.

import type { ReviewTier } from '@/types/database';
import { logger } from '@/lib/logger';

// ─── Base Prices (Case Analysis) ─────────────────────────────────────────────

export const PRICING = {
  TAX_APPEAL_RESIDENTIAL: 4900,
  TAX_APPEAL_COMMERCIAL: 9900,
  TAX_APPEAL_INDUSTRIAL: 9900,
  TAX_APPEAL_LAND: 4900,
  PRE_PURCHASE: 5900,
  PRE_LISTING: 5900,
} as const;

// ─── Expert Review Pricing ───────────────────────────────────────────────────

export const PRICING_EXPERT = {
  TAX_APPEAL_RESIDENTIAL: 14900,
  TAX_APPEAL_COMMERCIAL: 24900,
  TAX_APPEAL_INDUSTRIAL: 24900,
  TAX_APPEAL_LAND: 14900,
  PRE_PURCHASE: 17900,
  PRE_LISTING: 17900,
} as const;

// ─── Guided Filing Pricing ───────────────────────────────────────────────────
// Instant checkout is available only for residential tax appeals. Non-
// residential guided support requires property-scope and professional-
// availability review before a fee is quoted. The non-residential values remain
// internal pricing anchors for scoped proposals; service eligibility prevents
// them from being sold through consumer or partner instant checkout.

export const PRICING_GUIDED = {
  TAX_APPEAL_RESIDENTIAL: 19900,
  TAX_APPEAL_COMMERCIAL: 34900,
  TAX_APPEAL_INDUSTRIAL: 34900,
  TAX_APPEAL_LAND: 19900,
  PRE_PURCHASE: 17900,
  PRE_LISTING: 17900,
} as const;

// ─── Tax Bill Discount ───────────────────────────────────────────────────────
// A readable tax bill lowers data-retrieval work. Eligibility and the final
// amount remain server-authoritative.
export const TAX_BILL_DISCOUNT = 0.15;

export type ServiceType = 'tax_appeal' | 'pre_purchase' | 'pre_listing';
export type PropertyType = 'residential' | 'commercial' | 'industrial' | 'land' | 'agricultural';

export function getPriceForReport(
  serviceType: ServiceType,
  propertyType: PropertyType,
  reviewTier: ReviewTier = 'auto',
  hasTaxBill: boolean = false
): number {
  if (reviewTier === 'full_representation') {
    throw new Error(
      'Full representation is not available through instant pricing. Complete an eligibility and written-engagement review first.'
    );
  }

  // Guided filing is never a valid non-appeal package. This defensive fallback
  // protects display-only callers; order creation separately rejects the combo.
  const needsDowngrade =
    reviewTier === 'guided_filing' && serviceType !== 'tax_appeal';

  if (needsDowngrade) {
    logger.warn(
      { reviewTier, serviceType },
      '[pricing] Guided filing is not available for this service — using Expert Review display price'
    );
  }

  const effectiveTier = needsDowngrade ? 'expert_reviewed' : reviewTier;
  const table = effectiveTier === 'guided_filing'
    ? PRICING_GUIDED
    : effectiveTier === 'expert_reviewed'
      ? PRICING_EXPERT
      : PRICING;

  let base: number;
  if (serviceType === 'pre_purchase') base = table.PRE_PURCHASE;
  else if (serviceType === 'pre_listing') base = table.PRE_LISTING;
  else if (propertyType === 'residential') base = table.TAX_APPEAL_RESIDENTIAL;
  else if (propertyType === 'land' || propertyType === 'agricultural') base = table.TAX_APPEAL_LAND;
  else base = table.TAX_APPEAL_COMMERCIAL;

  if (hasTaxBill) {
    base = Math.round((base * (1 - TAX_BILL_DISCOUNT)) / 100) * 100;
  }

  return base;
}

export function getPriceCents(
  serviceType: ServiceType,
  propertyType: PropertyType,
  reviewTier: ReviewTier = 'auto',
  hasTaxBill: boolean = false
): number {
  return getPriceForReport(serviceType, propertyType, reviewTier, hasTaxBill);
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}
