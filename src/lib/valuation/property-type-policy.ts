const INCOME_PROPERTY_TERMS = [
  'commercial',
  'industrial',
  'office',
  'retail',
  'warehouse',
  'flex',
  'multifamily',
  'multi-family',
  'apartment',
  'duplex',
  'triplex',
  'fourplex',
  'mixed use',
  'mixed-use',
] as const;

export interface PropertyTypeDescriptor {
  propertyType?: string | null;
  propertySubtype?: string | null;
  propertyClassDescription?: string | null;
}

export function supportsIncomeApproach(descriptor: PropertyTypeDescriptor): boolean {
  const normalized = [
    descriptor.propertyType,
    descriptor.propertySubtype,
    descriptor.propertyClassDescription,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .toLowerCase();

  return INCOME_PROPERTY_TERMS.some((term) => normalized.includes(term));
}

export function isMultifamilyProperty(descriptor: PropertyTypeDescriptor): boolean {
  const normalized = [
    descriptor.propertyType,
    descriptor.propertySubtype,
    descriptor.propertyClassDescription,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .toLowerCase();

  return ['multifamily', 'multi-family', 'apartment', 'duplex', 'triplex', 'fourplex']
    .some((term) => normalized.includes(term));
}
