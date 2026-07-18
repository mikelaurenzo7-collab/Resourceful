const MULTIFAMILY_PHRASES = [
  'multifamily',
  'multi family',
  'apartment',
  'apartments',
  'duplex',
  'triplex',
  'fourplex',
  'two flat',
  'three flat',
  'four flat',
] as const;

const NONRESIDENTIAL_INCOME_PHRASES = [
  'commercial',
  'industrial',
  'office',
  'retail',
  'warehouse',
  'flex',
  'mixed use',
] as const;

export interface PropertyTypeDescriptor {
  propertyType?: string | null;
  propertySubtype?: string | null;
  propertyClassDescription?: string | null;
}

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[_\-/]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsPhrase(value: string, phrase: string): boolean {
  if (!value) return false;
  return ` ${value} `.includes(` ${phrase} `);
}

function containsAny(value: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => containsPhrase(value, phrase));
}

export function isMultifamilyProperty(descriptor: PropertyTypeDescriptor): boolean {
  return [
    descriptor.propertyType,
    descriptor.propertySubtype,
    descriptor.propertyClassDescription,
  ]
    .map(normalize)
    .some((value) => containsAny(value, MULTIFAMILY_PHRASES));
}

/**
 * Conservatively decide whether the Income Capitalization Approach is relevant.
 * Generic residential descriptions do not become income property merely because
 * they mention an amenity such as a home office or retail-style finish.
 */
export function supportsIncomeApproach(descriptor: PropertyTypeDescriptor): boolean {
  const propertyType = normalize(descriptor.propertyType);
  const subtype = normalize(descriptor.propertySubtype);
  const classDescription = normalize(descriptor.propertyClassDescription);

  if (propertyType === 'commercial' || propertyType === 'industrial') {
    return true;
  }

  if (isMultifamilyProperty(descriptor)) {
    return true;
  }

  // Once the canonical type is residential, only an explicit multifamily
  // descriptor may activate the income approach. This prevents false positives
  // such as "single-family residence with home office."
  if (propertyType === 'residential') {
    return false;
  }

  return (
    containsAny(subtype, NONRESIDENTIAL_INCOME_PHRASES) ||
    containsAny(classDescription, NONRESIDENTIAL_INCOME_PHRASES)
  );
}
