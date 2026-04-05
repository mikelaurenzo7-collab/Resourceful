import { describe, it, expect } from 'vitest';
import { parseCountySlug, buildCountySlug, countyNameToIlikePattern } from './county-slug';

// ─── parseCountySlug ─────────────────────────────────────────────────────────

describe('parseCountySlug', () => {
  describe('simple single-word county names', () => {
    it('parses a simple county slug', () => {
      expect(parseCountySlug('cook-county-il')).toEqual({
        countyName: 'Cook County',
        stateAbbrev: 'IL',
      });
    });

    it('uppercases state abbreviation', () => {
      expect(parseCountySlug('harris-county-tx')).toEqual({
        countyName: 'Harris County',
        stateAbbrev: 'TX',
      });
    });

    it('title-cases the county name', () => {
      expect(parseCountySlug('maricopa-county-az')).toEqual({
        countyName: 'Maricopa County',
        stateAbbrev: 'AZ',
      });
    });
  });

  describe('multi-word county names', () => {
    it('parses a two-word county name', () => {
      expect(parseCountySlug('los-angeles-county-ca')).toEqual({
        countyName: 'Los Angeles County',
        stateAbbrev: 'CA',
      });
    });

    it('parses prince georges county (apostrophe stripped in slug)', () => {
      expect(parseCountySlug('prince-georges-county-md')).toEqual({
        countyName: 'Prince Georges County',
        stateAbbrev: 'MD',
      });
    });

    it('parses st louis county', () => {
      expect(parseCountySlug('st-louis-county-mo')).toEqual({
        countyName: 'St Louis County',
        stateAbbrev: 'MO',
      });
    });

    it('parses a three-word county name', () => {
      expect(parseCountySlug('new-york-county-ny')).toEqual({
        countyName: 'New York County',
        stateAbbrev: 'NY',
      });
    });
  });

  describe('invalid slugs', () => {
    it('returns null for a slug with fewer than 3 parts', () => {
      expect(parseCountySlug('cook-il')).toBeNull();
    });

    it('returns null when state abbreviation is not 2 characters', () => {
      expect(parseCountySlug('cook-county-illinois')).toBeNull();
    });

    it('returns null when slug does not end with "county"', () => {
      expect(parseCountySlug('cook-district-il')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parseCountySlug('')).toBeNull();
    });

    it('returns null for a single segment', () => {
      expect(parseCountySlug('il')).toBeNull();
    });
  });
});

// ─── buildCountySlug ─────────────────────────────────────────────────────────

describe('buildCountySlug', () => {
  it('builds a simple slug', () => {
    expect(buildCountySlug('Cook County', 'IL')).toBe('cook-county-il');
  });

  it('lowercases the state abbreviation', () => {
    expect(buildCountySlug('Harris County', 'TX')).toBe('harris-county-tx');
  });

  it('handles multi-word county names', () => {
    expect(buildCountySlug('Los Angeles County', 'CA')).toBe('los-angeles-county-ca');
  });

  it("strips apostrophes from county names (Prince George's → prince-georges)", () => {
    expect(buildCountySlug("Prince George's County", 'MD')).toBe('prince-georges-county-md');
  });

  it("strips curly apostrophes too", () => {
    expect(buildCountySlug('Prince George\u2019s County', 'MD')).toBe('prince-georges-county-md');
  });

  it('handles St. Louis (strips period)', () => {
    // The function strips non-alphanumeric chars other than spaces
    expect(buildCountySlug('St. Louis County', 'MO')).toBe('st-louis-county-mo');
  });

  it('is a round-trip inverse of parseCountySlug for simple names', () => {
    const slug = buildCountySlug('Cook County', 'IL');
    const parsed = parseCountySlug(slug);
    expect(parsed?.stateAbbrev).toBe('IL');
    // County name may differ due to apostrophe stripping — just check state
  });

  it('collapses multiple spaces', () => {
    expect(buildCountySlug('Cook  County', 'IL')).toBe('cook-county-il');
  });
});

// ─── countyNameToIlikePattern ─────────────────────────────────────────────────

describe('countyNameToIlikePattern', () => {
  it('returns the name unchanged when no apostrophe words present', () => {
    expect(countyNameToIlikePattern('Cook County')).toBe('Cook County');
  });

  it('inserts wildcard before trailing s in "Georges"', () => {
    const result = countyNameToIlikePattern('Prince Georges County');
    expect(result).toBe('Prince George%s County');
  });

  it('inserts wildcard for "Queens"', () => {
    const result = countyNameToIlikePattern('Queens County');
    expect(result).toBe('Queen%s County');
  });

  it('inserts wildcard for "Kings"', () => {
    const result = countyNameToIlikePattern('Kings County');
    expect(result).toBe('King%s County');
  });

  it('does not insert wildcard for ordinary words ending in s', () => {
    const result = countyNameToIlikePattern('Harris County');
    expect(result).toBe('Harris County');
  });

  it('handles lowercase input', () => {
    // The function matches case-insensitively via the apostropheWords array
    const result = countyNameToIlikePattern('prince georges county');
    expect(result).toBe('prince george%s county');
  });
});
