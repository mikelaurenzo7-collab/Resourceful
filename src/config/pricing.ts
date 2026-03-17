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

export type ServiceType = 'tax_appeal' | 'pre_purchase' | 'pre_listing';
export type PropertyType = 'residential' | 'commercial' | 'industrial' | 'land';

export function getPriceForReport(
  serviceType: ServiceType,
  propertyType: PropertyType,
  reviewTier: ReviewTier = 'auto'
): number {
  const table = reviewTier === 'expert_reviewed' ? PRICING_EXPERT : PRICING;
  if (serviceType === 'pre_purchase') return table.PRE_PURCHASE;
  if (serviceType === 'pre_listing') return table.PRE_LISTING;
  if (propertyType === 'residential') return table.TAX_APPEAL_RESIDENTIAL;
  if (propertyType === 'land') return table.TAX_APPEAL_LAND;
  return table.TAX_APPEAL_COMMERCIAL;
}

// Backward-compatible aliases used by existing code
export function getPriceCents(
  serviceType: ServiceType,
  propertyType: PropertyType,
  reviewTier: ReviewTier = 'auto'
): number {
  return getPriceForReport(serviceType, propertyType, reviewTier);
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}
