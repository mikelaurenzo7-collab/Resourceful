// ─── Pricing Configuration ───────────────────────────────────────────────────
// All pricing in cents. Update here to change pricing everywhere.

import type { ReviewTier } from '@/types/database';

// ─── Base Prices (Auto-Report tier) ─────────────────────────────────────────

export const PRICING = {
  TAX_APPEAL_RESIDENTIAL: 4900, // $49
  TAX_APPEAL_COMMERCIAL: 9900, // $99
  TAX_APPEAL_INDUSTRIAL: 9900, // $99
  TAX_APPEAL_LAND: 4900, // $49
  PRE_PURCHASE: 5900, // $59
  PRE_LISTING: 5900, // $59
} as const;

// ─── Expert-Reviewed Tier Pricing ───────────────────────────────────────────
// Professional appraiser reviews the report before delivery.

export const PRICING_EXPERT = {
  TAX_APPEAL_RESIDENTIAL: 14900, // $149
  TAX_APPEAL_COMMERCIAL: 24900, // $249
  TAX_APPEAL_INDUSTRIAL: 24900, // $249
  TAX_APPEAL_LAND: 14900, // $149
  PRE_PURCHASE: 17900, // $179
  PRE_LISTING: 17900, // $179
} as const;

// ─── Guided Filing Tier Pricing ─────────────────────────────────────────────
// Report + live guided filing session. We walk the homeowner through the form,
// evidence prep, and hearing prep on a call/screen-share.
// Only available for tax_appeal service type.

export const PRICING_GUIDED = {
  TAX_APPEAL_RESIDENTIAL: 19900, // $199
  TAX_APPEAL_COMMERCIAL: 34900, // $349
  TAX_APPEAL_INDUSTRIAL: 34900, // $349
  TAX_APPEAL_LAND: 19900, // $199
  PRE_PURCHASE: 17900, // $179 (same as expert — no filing guidance for non-appeal)
  PRE_LISTING: 17900, // $179
} as const;

// ─── Full Representation (POA) Tier Pricing ─────────────────────────────────
// Report + we file on their behalf + attend the hearing as authorized rep.
// Only available in counties where authorized_rep_allowed = true.
// Only available for tax_appeal service type.

export const PRICING_FULL_REPRESENTATION = {
  TAX_APPEAL_RESIDENTIAL: 39900, // $399
  TAX_APPEAL_COMMERCIAL: 59900, // $599
  TAX_APPEAL_INDUSTRIAL: 59900, // $599
  TAX_APPEAL_LAND: 39900, // $399
  PRE_PURCHASE: 17900, // $179 (same as expert — no filing for non-appeal)
  PRE_LISTING: 17900, // $179
} as const;

// ─── Tax Bill Discount ──────────────────────────────────────────────────────
// Users who upload their tax bill get 15% off — they provide data we'd
// otherwise have to look up, reducing our API costs.
export const TAX_BILL_DISCOUNT = 0.15;

export type ServiceType = 'tax_appeal' | 'pre_purchase' | 'pre_listing';
export type PropertyType = 'residential' | 'commercial' | 'industrial' | 'land' | 'agricultural';

export function getPriceForReport(
  serviceType: ServiceType,
  propertyType: PropertyType,
  reviewTier: ReviewTier = 'auto',
  hasTaxBill: boolean = false
): number {
  // Guided filing and full representation are only available for tax appeals.
  // Fall back to expert_reviewed if an invalid tier/service combo is requested.
  const needsDowngrade =
    (reviewTier === 'guided_filing' || reviewTier === 'full_representation') &&
    serviceType !== 'tax_appeal';

  if (needsDowngrade) {
    console.warn(`[pricing] Review tier '${reviewTier}' is not available for '${serviceType}'. Downgrading to 'expert_reviewed'.`);
  }

  const effectiveTier = needsDowngrade ? 'expert_reviewed' : reviewTier;

  const table = effectiveTier === 'full_representation'
    ? PRICING_FULL_REPRESENTATION
    : effectiveTier === 'guided_filing'
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
    // Round to nearest dollar (100 cents) for clean display
    base = Math.round((base * (1 - TAX_BILL_DISCOUNT)) / 100) * 100;
  }
  return base;
}

// Backward-compatible aliases used by existing code
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
