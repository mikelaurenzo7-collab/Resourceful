// ─── Pricing Configuration ───────────────────────────────────────────────────
// All pricing in cents. Update here to change pricing everywhere.

import type { ReviewTier } from '@/types/database';

// ─── Base Prices (Auto-Report tier) ─────────────────────────────────────────

export const PRICING = {
  // Tax Appeal
  TAX_APPEAL_RESIDENTIAL: 4900,  // $49
  TAX_APPEAL_COMMERCIAL:  9900,  // $99
  TAX_APPEAL_INDUSTRIAL:  9900,  // $99
  TAX_APPEAL_LAND:        4900,  // $49
  // Pre-Purchase
  PRE_PURCHASE_RESIDENTIAL: 5900, // $59
  PRE_PURCHASE_COMMERCIAL:  9900, // $99
  PRE_PURCHASE_INDUSTRIAL:  9900, // $99
  PRE_PURCHASE_LAND:        4900, // $49
  // Pre-Listing
  PRE_LISTING_RESIDENTIAL: 5900,  // $59
  PRE_LISTING_COMMERCIAL:  9900,  // $99
  PRE_LISTING_INDUSTRIAL:  9900,  // $99
  PRE_LISTING_LAND:        4900,  // $49
  // Legacy aliases (keep for backward compat)
  PRE_PURCHASE: 5900,
  PRE_LISTING:  5900,
} as const;

// ─── Expert-Reviewed Tier Pricing ───────────────────────────────────────────
// Professional appraiser reviews the report before delivery.

export const PRICING_EXPERT = {
  // Tax Appeal
  TAX_APPEAL_RESIDENTIAL: 14900, // $149
  TAX_APPEAL_COMMERCIAL:  24900, // $249
  TAX_APPEAL_INDUSTRIAL:  24900, // $249
  TAX_APPEAL_LAND:        14900, // $149
  // Pre-Purchase
  PRE_PURCHASE_RESIDENTIAL: 17900, // $179
  PRE_PURCHASE_COMMERCIAL:  29900, // $299
  PRE_PURCHASE_INDUSTRIAL:  29900, // $299
  PRE_PURCHASE_LAND:        14900, // $149
  // Pre-Listing
  PRE_LISTING_RESIDENTIAL: 17900, // $179
  PRE_LISTING_COMMERCIAL:  29900, // $299
  PRE_LISTING_INDUSTRIAL:  29900, // $299
  PRE_LISTING_LAND:        14900, // $149
  // Legacy aliases
  PRE_PURCHASE: 17900,
  PRE_LISTING:  17900,
} as const;

// ─── Guided Filing / Guided Session Tier Pricing ────────────────────────────
// tax_appeal: Report + live guided filing session (call/screen-share).
// pre_purchase / pre_listing: Report + live consultation session.

export const PRICING_GUIDED = {
  // Tax Appeal
  TAX_APPEAL_RESIDENTIAL: 19900, // $199
  TAX_APPEAL_COMMERCIAL:  34900, // $349
  TAX_APPEAL_INDUSTRIAL:  34900, // $349
  TAX_APPEAL_LAND:        19900, // $199
  // Pre-Purchase — guided buyer consultation
  PRE_PURCHASE_RESIDENTIAL: 19900, // $199
  PRE_PURCHASE_COMMERCIAL:  34900, // $349
  PRE_PURCHASE_INDUSTRIAL:  34900, // $349
  PRE_PURCHASE_LAND:        17900, // $179
  // Pre-Listing — guided listing strategy session
  PRE_LISTING_RESIDENTIAL: 19900, // $199
  PRE_LISTING_COMMERCIAL:  34900, // $349
  PRE_LISTING_INDUSTRIAL:  34900, // $349
  PRE_LISTING_LAND:        17900, // $179
  // Legacy aliases (residential pricing)
  PRE_PURCHASE: 19900,
  PRE_LISTING:  19900,
} as const;

// ─── Full Representation (POA) Tier Pricing ──────────────────────────────────
// tax_appeal: Report + we file on their behalf + attend the hearing.
//   Only available where county_rules.authorized_rep_allowed = true.
// pre_purchase / pre_listing: Full-service concierge — we handle all
//   negotiations / agent coordination on the client's behalf.

export const PRICING_FULL_REPRESENTATION = {
  // Tax Appeal
  TAX_APPEAL_RESIDENTIAL: 39900, // $399
  TAX_APPEAL_COMMERCIAL:  59900, // $599
  TAX_APPEAL_INDUSTRIAL:  59900, // $599
  TAX_APPEAL_LAND:        39900, // $399
  // Pre-Purchase — full-service buyer's rep
  PRE_PURCHASE_RESIDENTIAL: 39900, // $399
  PRE_PURCHASE_COMMERCIAL:  59900, // $599
  PRE_PURCHASE_INDUSTRIAL:  59900, // $599
  PRE_PURCHASE_LAND:        29900, // $299
  // Pre-Listing — full-service listing concierge
  PRE_LISTING_RESIDENTIAL: 39900, // $399
  PRE_LISTING_COMMERCIAL:  59900, // $599
  PRE_LISTING_INDUSTRIAL:  59900, // $599
  PRE_LISTING_LAND:        29900, // $299
  // Legacy aliases (residential pricing)
  PRE_PURCHASE: 39900,
  PRE_LISTING:  39900,
} as const;

// ─── Tax Bill Discount ───────────────────────────────────────────────────────
// Users who upload their tax bill get 15% off — they provide data we'd
// otherwise have to look up, reducing our API costs.
export const TAX_BILL_DISCOUNT = 0.15;

export type ServiceType = 'tax_appeal' | 'pre_purchase' | 'pre_listing';
export type PropertyType = 'residential' | 'commercial' | 'industrial' | 'land';

export function getPriceForReport(
  serviceType: ServiceType,
  propertyType: PropertyType,
  reviewTier: ReviewTier = 'auto',
  hasTaxBill: boolean = false
): number {
  const table = reviewTier === 'full_representation'
    ? PRICING_FULL_REPRESENTATION
    : reviewTier === 'guided_filing'
      ? PRICING_GUIDED
      : reviewTier === 'expert_reviewed'
        ? PRICING_EXPERT
        : PRICING;

  let base: number;
  if (serviceType === 'pre_purchase') {
    if (propertyType === 'residential') base = table.PRE_PURCHASE_RESIDENTIAL;
    else if (propertyType === 'industrial') base = table.PRE_PURCHASE_INDUSTRIAL;
    else if (propertyType === 'land') base = table.PRE_PURCHASE_LAND;
    else base = table.PRE_PURCHASE_COMMERCIAL;
  } else if (serviceType === 'pre_listing') {
    if (propertyType === 'residential') base = table.PRE_LISTING_RESIDENTIAL;
    else if (propertyType === 'industrial') base = table.PRE_LISTING_INDUSTRIAL;
    else if (propertyType === 'land') base = table.PRE_LISTING_LAND;
    else base = table.PRE_LISTING_COMMERCIAL;
  } else {
    // tax_appeal
    if (propertyType === 'residential') base = table.TAX_APPEAL_RESIDENTIAL;
    else if (propertyType === 'industrial') base = table.TAX_APPEAL_INDUSTRIAL;
    else if (propertyType === 'land') base = table.TAX_APPEAL_LAND;
    else base = table.TAX_APPEAL_COMMERCIAL;
  }

  if (hasTaxBill) {
    // Round to nearest dollar (100 cents) for clean display
    base = Math.round((base * (1 - TAX_BILL_DISCOUNT)) / 100) * 100;
  }
  return base;
}

// Backward-compatible alias
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
