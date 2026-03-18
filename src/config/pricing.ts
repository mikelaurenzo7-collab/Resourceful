// ─── Pricing Configuration ───────────────────────────────────────────────────
// All pricing in cents. Update here to change pricing everywhere.

import type { ReviewTier } from '@/types/database';

// ─── Base Prices (Auto-Report tier) ─────────────────────────────────────────

export const PRICING = {
  TAX_APPEAL_RESIDENTIAL: 5900, // $59
  TAX_APPEAL_COMMERCIAL: 10900, // $109
  TAX_APPEAL_INDUSTRIAL: 10900, // $109
  TAX_APPEAL_LAND: 5900, // $59
  PRE_PURCHASE: 6900, // $69
  PRE_LISTING: 6900, // $69
} as const;

// ─── Guided Filing Tier Pricing (2x base) ───────────────────────────────────
// Report + live guided filing session. We walk the homeowner through the form,
// evidence prep, and hearing prep on a call/screen-share.
// Only available for tax_appeal service type.

export const PRICING_GUIDED = {
  TAX_APPEAL_RESIDENTIAL: 11800, // $118
  TAX_APPEAL_COMMERCIAL: 21800, // $218
  TAX_APPEAL_INDUSTRIAL: 21800, // $218
  TAX_APPEAL_LAND: 11800, // $118
  PRE_PURCHASE: 13800, // $138
  PRE_LISTING: 13800, // $138
} as const;

// ─── Expert-Reviewed Tier Pricing (3x base) ─────────────────────────────────
// Professional appraiser reviews the report before delivery.
// We file on their behalf + attend the hearing as authorized rep where allowed.

export const PRICING_EXPERT = {
  TAX_APPEAL_RESIDENTIAL: 17700, // $177
  TAX_APPEAL_COMMERCIAL: 32700, // $327
  TAX_APPEAL_INDUSTRIAL: 32700, // $327
  TAX_APPEAL_LAND: 17700, // $177
  PRE_PURCHASE: 20700, // $207
  PRE_LISTING: 20700, // $207
} as const;

// ─── Money-Back Guarantee ───────────────────────────────────────────────────
// If our analysis finds no savings opportunity, full refund — no questions asked.
// This replaces the old tax bill discount as the primary trust signal.
export const MONEY_BACK_GUARANTEE = true;

export type ServiceType = 'tax_appeal' | 'pre_purchase' | 'pre_listing';
export type PropertyType = 'residential' | 'commercial' | 'industrial' | 'land';

export function getPriceForReport(
  serviceType: ServiceType,
  propertyType: PropertyType,
  reviewTier: ReviewTier = 'auto',
): number {
  const table = reviewTier === 'expert_reviewed'
    ? PRICING_EXPERT
    : reviewTier === 'guided_filing'
      ? PRICING_GUIDED
      : PRICING;

  if (serviceType === 'pre_purchase') return table.PRE_PURCHASE;
  if (serviceType === 'pre_listing') return table.PRE_LISTING;
  if (propertyType === 'residential') return table.TAX_APPEAL_RESIDENTIAL;
  if (propertyType === 'land') return table.TAX_APPEAL_LAND;
  if (propertyType === 'industrial') return table.TAX_APPEAL_INDUSTRIAL;
  return table.TAX_APPEAL_COMMERCIAL;
}

// Backward-compatible alias
export function getPriceCents(
  serviceType: ServiceType,
  propertyType: PropertyType,
  reviewTier: ReviewTier = 'auto',
): number {
  return getPriceForReport(serviceType, propertyType, reviewTier);
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}
