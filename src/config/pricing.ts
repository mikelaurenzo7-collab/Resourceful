export const PRICING = {
  tax_appeal: {
    residential: 3900, // cents
    commercial: 7900,
    industrial: 7900,
    land: 4900,
  },
  pre_purchase: {
    residential: 2900,
    commercial: 2900,
    industrial: 2900,
    land: 2900,
  },
  pre_listing: {
    residential: 2900,
    commercial: 2900,
    industrial: 2900,
    land: 2900,
  },
} as const;

export function getPriceCents(
  serviceType: keyof typeof PRICING,
  propertyType: keyof typeof PRICING.tax_appeal
): number {
  return PRICING[serviceType][propertyType];
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}
