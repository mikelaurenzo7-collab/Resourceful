import { describe, expect, it } from 'vitest';

import { isMultifamilyProperty, supportsIncomeApproach } from './property-type-policy';

describe('supportsIncomeApproach', () => {
  it.each([
    [{ propertyType: 'commercial' }, true],
    [{ propertyType: 'industrial' }, true],
    [{ propertyType: 'residential', propertySubtype: 'multifamily' }, true],
    [{ propertyType: 'residential', propertySubtype: 'duplex' }, true],
    [{ propertyType: 'residential', propertyClassDescription: 'Six-unit apartment building' }, true],
    [{ propertyType: 'residential', propertySubtype: 'single_family' }, false],
    [{ propertyType: 'agricultural' }, false],
    [{ propertyType: null, propertySubtype: null, propertyClassDescription: null }, false],
  ])('returns %s for %o', (descriptor, expected) => {
    expect(supportsIncomeApproach(descriptor)).toBe(expected);
  });
});

describe('isMultifamilyProperty', () => {
  it('recognizes multifamily descriptors without classifying generic residential property', () => {
    expect(isMultifamilyProperty({ propertyType: 'residential', propertySubtype: 'triplex' })).toBe(true);
    expect(isMultifamilyProperty({ propertyType: 'residential', propertySubtype: 'single_family' })).toBe(false);
  });
});
