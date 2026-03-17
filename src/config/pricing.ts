// ─── Pricing Configuration ───────────────────────────────────────────────────
// All pricing in cents. Update here to change pricing everywhere.

import type { ReviewTier } from '@/types/database';

// ─── Base Prices (Auto-Report tier) ─────────────────────────────────────────

export const PRICING = {
  TAX_APPEAL_RESIDENTIAL: 5900, // $59
  TAX_APPEAL_COMMERCIAL: 11900, // $119
  TAX_APPEAL_INDUSTRIAL: 11900, // $119
  TAX_APPEAL_LAND: 5900, // $59
  PRE_PURCHASE: 6900, // $69
  PRE_LISTING: 6900, // $69
} as const;

// ─── Expert-Reviewed Tier Pricing ───────────────────────────────────────────
// Professional appraiser reviews the report before delivery.

export const PRICING_EXPERT = {
  TAX_APPEAL_RESIDENTIAL: 17900, // $179
  TAX_APPEAL_COMMERCIAL: 29900, // $299
  TAX_APPEAL_INDUSTRIAL: 29900, // $299
  TAX_APPEAL_LAND: 17900, // $179
  PRE_PURCHASE: 19900, // $199
  PRE_LISTING: 19900, // $199
} as const;

// ─── Tax Bill Discount ──────────────────────────────────────────────────────
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
  const table = reviewTier === 'expert_reviewed' ? PRICING_EXPERT : PRICING;
  let base: number;
  if (serviceType === 'pre_purchase') base = table.PRE_PURCHASE;
  else if (serviceType === 'pre_listing') base = table.PRE_LISTING;
  else if (propertyType === 'residential') base = table.TAX_APPEAL_RESIDENTIAL;
  else if (propertyType === 'land') base = table.TAX_APPEAL_LAND;
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
