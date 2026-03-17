// ─── Pricing Configuration ───────────────────────────────────────────────────
// All pricing in cents. Update here to change pricing everywhere.

export const PRICING = {
  TAX_APPEAL_RESIDENTIAL: 3900, // $39
  TAX_APPEAL_COMMERCIAL: 7900, // $79
  TAX_APPEAL_INDUSTRIAL: 7900, // $79
  TAX_APPEAL_LAND: 4900, // $49
  PRE_PURCHASE: 2900, // $29
  PRE_LISTING: 2900, // $29
} as const;

export type ServiceType = 'tax_appeal' | 'pre_purchase' | 'pre_listing';
export type PropertyType = 'residential' | 'commercial' | 'industrial' | 'land';

export function getPriceForReport(
  serviceType: ServiceType,
  propertyType: PropertyType
): number {
  if (serviceType === 'pre_purchase') return PRICING.PRE_PURCHASE;
  if (serviceType === 'pre_listing') return PRICING.PRE_LISTING;
  if (propertyType === 'residential') return PRICING.TAX_APPEAL_RESIDENTIAL;
  if (propertyType === 'land') return PRICING.TAX_APPEAL_LAND;
  return PRICING.TAX_APPEAL_COMMERCIAL;
}

// Backward-compatible aliases used by existing code
export function getPriceCents(
  serviceType: ServiceType,
  propertyType: PropertyType
): number {
  return getPriceForReport(serviceType, propertyType);
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}
