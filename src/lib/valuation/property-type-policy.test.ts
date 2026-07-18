import { describe, expect, it } from 'vitest';

import {
  isMultifamilyProperty,
  supportsIncomeApproach,
  type PropertyTypeDescriptor,
} from './property-type-policy';

const INCOME_SUPPORT_CASES: Array<[PropertyTypeDescriptor, boolean]> = [
  [{ propertyType: 'commercial' }, true],
  [{ propertyType: 'industrial' }, true],
  [{ propertyType: 'residential', propertySubtype: 'multifamily' }, true],
  [{ propertyType: 'residential', propertySubtype: 'duplex' }, true],
  [{ propertyType: 'residential', propertyClassDescription: 'Six-unit apartment building' }, true],
  [{ propertyType: 'residential', propertySubtype: 'single_family' }, false],
  [{ propertyType: 'residential', propertyClassDescription: 'Single-family residence with home office' }, false],
  [{ propertyType: null, propertyClassDescription: 'Suburban office building' }, true],
  [{ propertyType: null, propertySubtype: 'mixed-use retail and apartments' }, true],
  [{ propertyType: 'agricultural' }, false],
  [{ propertyType: null, propertySubtype: null, propertyClassDescription: null }, false],
];

describe('supportsIncomeApproach', () => {
  it.each(INCOME_SUPPORT_CASES)('classifies %o as income-support=%s', (descriptor, expected) => {
    expect(supportsIncomeApproach(descriptor)).toBe(expected);
  });

  it('does not use loose substring matching', () => {
    expect(
      supportsIncomeApproach({
        propertyType: 'residential',
        propertyClassDescription: 'Single-family home with flexible office nook and retail-style finishes',
      })
    ).toBe(false);
  });
});

describe('isMultifamilyProperty', () => {
  it('recognizes explicit multifamily descriptors', () => {
    expect(isMultifamilyProperty({ propertyType: 'residential', propertySubtype: 'triplex' })).toBe(true);
    expect(isMultifamilyProperty({ propertyClassDescription: 'Chicago three-flat' })).toBe(true);
    expect(isMultifamilyProperty({ propertySubtype: 'multi_family' })).toBe(true);
  });

  it('does not classify generic residential property as multifamily', () => {
    expect(isMultifamilyProperty({ propertyType: 'residential', propertySubtype: 'single_family' })).toBe(false);
    expect(isMultifamilyProperty({ propertyClassDescription: 'Apartment-style kitchen in a detached house' })).toBe(false);
  });
});
