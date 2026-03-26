// ─── Pricing Configuration ───────────────────────────────────────────────────
// All pricing in cents. Update here to change pricing everywhere.

import type { ReviewTier } from '@/types/database';

// ─── Price Table ─────────────────────────────────────────────────────────────
// Single source of truth. Each tier maps to the same 6 price keys.

interface PriceTable {
  TAX_APPEAL_RESIDENTIAL: number;
  TAX_APPEAL_COMMERCIAL: number;
  TAX_APPEAL_INDUSTRIAL: number;
  TAX_APPEAL_LAND: number;
  PRE_PURCHASE: number;
  PRE_LISTING: number;
}

const PRICING_BY_TIER: Record<ReviewTier, PriceTable> = {
  auto: {
    TAX_APPEAL_RESIDENTIAL: 4900,   // $49
    TAX_APPEAL_COMMERCIAL: 9900,    // $99
    TAX_APPEAL_INDUSTRIAL: 9900,    // $99
    TAX_APPEAL_LAND: 4900,          // $49
    PRE_PURCHASE: 5900,             // $59
    PRE_LISTING: 5900,              // $59
  },
  expert_reviewed: {
    TAX_APPEAL_RESIDENTIAL: 14900,  // $149
    TAX_APPEAL_COMMERCIAL: 24900,   // $249
    TAX_APPEAL_INDUSTRIAL: 24900,   // $249
    TAX_APPEAL_LAND: 14900,         // $149
    PRE_PURCHASE: 17900,            // $179
    PRE_LISTING: 17900,             // $179
  },
  guided_filing: {
    TAX_APPEAL_RESIDENTIAL: 19900,  // $199
    TAX_APPEAL_COMMERCIAL: 34900,   // $349
    TAX_APPEAL_INDUSTRIAL: 34900,   // $349
    TAX_APPEAL_LAND: 19900,         // $199
    PRE_PURCHASE: 17900,            // $179 (same as expert — no filing guidance for non-appeal)
    PRE_LISTING: 17900,             // $179
  },
  full_representation: {
    TAX_APPEAL_RESIDENTIAL: 39900,  // $399
    TAX_APPEAL_COMMERCIAL: 59900,   // $599
    TAX_APPEAL_INDUSTRIAL: 59900,   // $599
    TAX_APPEAL_LAND: 39900,         // $399
    PRE_PURCHASE: 17900,            // $179 (same as expert — no filing for non-appeal)
    PRE_LISTING: 17900,             // $179
  },
};

// ─── Backward-Compatible Exports ────────────────────────────────────────────

export const PRICING = PRICING_BY_TIER.auto;
export const PRICING_EXPERT = PRICING_BY_TIER.expert_reviewed;
export const PRICING_GUIDED = PRICING_BY_TIER.guided_filing;
export const PRICING_FULL_REPRESENTATION = PRICING_BY_TIER.full_representation;

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
  const table = PRICING_BY_TIER[reviewTier] ?? PRICING_BY_TIER.auto;

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

// ─── Founder Access ──────────────────────────────────────────────────────────
// Comma-separated list of emails with free access to all services.
// Set via FOUNDER_EMAILS env var. Never hardcoded.
const FOUNDER_EMAILS_RAW = process.env.FOUNDER_EMAILS ?? '';
const FOUNDER_EMAIL_SET = new Set(
  FOUNDER_EMAILS_RAW.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
);

export function isFounderEmail(email: string): boolean {
  return FOUNDER_EMAIL_SET.has(email.trim().toLowerCase());
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
