import { describe, it, expect } from 'vitest';
import {
  ECONOMIC_LIFE,
  PROPERTY_SUBTYPE_MAP,
  CONDITION_AGE_MULTIPLIER,
  EFFECTIVE_AGE_ADJ_RATE_PER_YEAR,
  EFFECTIVE_AGE_ADJ_MAX_PCT,
  LOCATION_ADJ_BY_DISTANCE,
  LOCATION_ADJ_MAX_PCT,
  INCOME_PARAMS,
  CASE_STRENGTH,
  REPLACEMENT_COST_PER_SQFT,
  DISTRESSED_SALE_ADJ_PCT,
  MARKET_TRENDS_ADJ_PER_MONTH,
  MARKET_TRENDS_ADJ_MAX_PCT,
  SIZE_ADJ_LARGER_PER_10PCT,
  SIZE_ADJ_SMALLER_PER_10PCT,
  SIZE_ADJ_MAX_PCT,
  CONDITION_ADJ_MAX_PCT,
  CONDITION_DEFECT_ADJUSTMENTS,
  resolvePropertySubtype,
  computePhysicalDepreciation,
  computeEffectiveAge,
} from './valuation';

// ─── Constants: sanity checks ─────────────────────────────────────────────────

describe('ECONOMIC_LIFE', () => {
  it('land has zero economic life', () => {
    expect(ECONOMIC_LIFE['land']).toBe(0);
  });

  it('residential SFR has a positive useful life', () => {
    expect(ECONOMIC_LIFE['residential_sfr']).toBeGreaterThan(0);
  });

  it('all commercial subtypes have positive economic life', () => {
    const commercialKeys = Object.keys(ECONOMIC_LIFE).filter((k) => k.startsWith('commercial'));
    for (const key of commercialKeys) {
      expect(ECONOMIC_LIFE[key]).toBeGreaterThan(0);
    }
  });

  it('all industrial subtypes have positive economic life', () => {
    const industrialKeys = Object.keys(ECONOMIC_LIFE).filter((k) => k.startsWith('industrial'));
    for (const key of industrialKeys) {
      expect(ECONOMIC_LIFE[key]).toBeGreaterThan(0);
    }
  });
});

describe('CONDITION_AGE_MULTIPLIER', () => {
  it('average condition has multiplier of 1.0 (baseline)', () => {
    expect(CONDITION_AGE_MULTIPLIER['average']).toBe(1.0);
  });

  it('excellent condition multiplier is less than 1 (acts younger)', () => {
    expect(CONDITION_AGE_MULTIPLIER['excellent']).toBeLessThan(1.0);
  });

  it('poor condition multiplier is greater than 1 (acts older)', () => {
    expect(CONDITION_AGE_MULTIPLIER['poor']).toBeGreaterThan(1.0);
  });

  it('multipliers are in ascending order: excellent < good < average < fair < poor', () => {
    const { excellent, good, average, fair, poor } = CONDITION_AGE_MULTIPLIER;
    expect(excellent).toBeLessThan(good);
    expect(good).toBeLessThan(average);
    expect(average).toBeLessThan(fair);
    expect(fair).toBeLessThan(poor);
  });
});

describe('LOCATION_ADJ_BY_DISTANCE', () => {
  it('zero-mile band has zero adjustment factor', () => {
    const zeroMile = LOCATION_ADJ_BY_DISTANCE.find((b) => b.maxMiles === 0.5);
    expect(zeroMile?.adjFactor).toBe(0);
  });

  it('adjustment factor increases with distance', () => {
    const factors = LOCATION_ADJ_BY_DISTANCE.map((b) => b.adjFactor);
    for (let i = 1; i < factors.length; i++) {
      expect(factors[i]).toBeGreaterThanOrEqual(factors[i - 1]);
    }
  });

  it('all bands have non-negative adjustment factors', () => {
    for (const band of LOCATION_ADJ_BY_DISTANCE) {
      expect(band.adjFactor).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('INCOME_PARAMS', () => {
  const expectedSubtypes = [
    'commercial_retail_strip',
    'commercial_office',
    'commercial_restaurant',
    'commercial_hotel',
    'commercial_mixed_use',
    'commercial_general',
    'industrial_warehouse',
    'industrial_manufacturing',
    'industrial_flex',
    'industrial_self_storage',
    'industrial_general',
  ];

  it('has entries for all commercial and industrial subtypes', () => {
    for (const subtype of expectedSubtypes) {
      expect(INCOME_PARAMS).toHaveProperty(subtype);
    }
  });

  it('all vacancy rates are between 0 and 1', () => {
    for (const params of Object.values(INCOME_PARAMS)) {
      expect(params.vacancy_rate).toBeGreaterThanOrEqual(0);
      expect(params.vacancy_rate).toBeLessThan(1);
    }
  });

  it('all expense ratios are between 0 and 1', () => {
    for (const params of Object.values(INCOME_PARAMS)) {
      expect(params.expense_ratio).toBeGreaterThan(0);
      expect(params.expense_ratio).toBeLessThan(1);
    }
  });

  it('all default cap rates are positive and reasonable (1-20%)', () => {
    for (const params of Object.values(INCOME_PARAMS)) {
      expect(params.cap_rate_default).toBeGreaterThan(0.01);
      expect(params.cap_rate_default).toBeLessThan(0.20);
    }
  });
});

describe('REPLACEMENT_COST_PER_SQFT', () => {
  it('luxury grade costs more than economy for residential SFR', () => {
    const sfr = REPLACEMENT_COST_PER_SQFT['residential_sfr'];
    expect(sfr.luxury).toBeGreaterThan(sfr.economy);
  });

  it('cost grades are in ascending order: economy < average < good < excellent', () => {
    for (const costs of Object.values(REPLACEMENT_COST_PER_SQFT)) {
      expect(costs.economy).toBeLessThan(costs.average);
      expect(costs.average).toBeLessThan(costs.good);
      expect(costs.good).toBeLessThan(costs.excellent);
    }
  });

  it('all costs are positive', () => {
    for (const costs of Object.values(REPLACEMENT_COST_PER_SQFT)) {
      for (const cost of Object.values(costs)) {
        expect(cost).toBeGreaterThan(0);
      }
    }
  });
});

describe('CONDITION_DEFECT_ADJUSTMENTS', () => {
  it('significant defects have larger (more negative) impact than minor ones', () => {
    for (const impact of ['low', 'medium', 'high'] as const) {
      expect(CONDITION_DEFECT_ADJUSTMENTS['significant'][impact]).toBeLessThan(
        CONDITION_DEFECT_ADJUSTMENTS['minor'][impact]
      );
    }
  });

  it('all adjustments are negative (reduce value)', () => {
    for (const severity of Object.values(CONDITION_DEFECT_ADJUSTMENTS)) {
      for (const value of Object.values(severity)) {
        expect(value).toBeLessThan(0);
      }
    }
  });
});

describe('CASE_STRENGTH limits', () => {
  it('overassessment max pts equals pts_per_pct * 20 (i.e. 20% caps it)', () => {
    expect(CASE_STRENGTH.overassessment_max_pts).toBe(
      CASE_STRENGTH.overassessment_pts_per_pct * 20
    );
  });

  it('comp max pts equals comp_pts_each * 5 (i.e. 5 comps caps it)', () => {
    expect(CASE_STRENGTH.comp_max_pts).toBe(CASE_STRENGTH.comp_pts_each * 5);
  });
});

// ─── resolvePropertySubtype ───────────────────────────────────────────────────

describe('resolvePropertySubtype', () => {
  it('maps ATTOM code "R1" to residential_sfr', () => {
    expect(resolvePropertySubtype('R1', 'residential')).toBe('residential_sfr');
  });

  it('maps ATTOM code "SFR" to residential_sfr', () => {
    expect(resolvePropertySubtype('SFR', 'residential')).toBe('residential_sfr');
  });

  it('maps ATTOM code "CONDO" to residential_condo', () => {
    expect(resolvePropertySubtype('CONDO', 'residential')).toBe('residential_condo');
  });

  it('maps ATTOM code "WAREHOUSE" to industrial_warehouse', () => {
    expect(resolvePropertySubtype('WAREHOUSE', 'industrial')).toBe('industrial_warehouse');
  });

  it('is case-insensitive for ATTOM codes', () => {
    expect(resolvePropertySubtype('single family', 'residential')).toBe('residential_sfr');
  });

  it('falls back to propertyType when ATTOM code is null', () => {
    expect(resolvePropertySubtype(null, 'commercial')).toBe('commercial_general');
    expect(resolvePropertySubtype(null, 'industrial')).toBe('industrial_general');
    expect(resolvePropertySubtype(null, 'land')).toBe('land');
  });

  it('falls back to propertyType when ATTOM code is unrecognised', () => {
    expect(resolvePropertySubtype('UNKNOWN_CODE_XYZ', 'residential')).toBe('residential_sfr');
  });

  it('falls back to residential_sfr for unknown propertyType', () => {
    expect(resolvePropertySubtype(null, 'unknown_type')).toBe('residential_sfr');
  });
});

// ─── computePhysicalDepreciation ─────────────────────────────────────────────

describe('computePhysicalDepreciation', () => {
  it('returns 0 for land (zero economic life)', () => {
    expect(computePhysicalDepreciation(10, 'land')).toBe(0);
  });

  it('returns 0 for a brand-new building (effectiveAge = 0)', () => {
    expect(computePhysicalDepreciation(0, 'residential_sfr')).toBe(0);
  });

  it('calculates depreciation as a percentage of economic life', () => {
    // residential_sfr = 60yr life. effectiveAge 30 → 50%
    expect(computePhysicalDepreciation(30, 'residential_sfr')).toBe(50);
  });

  it('caps depreciation at 90%', () => {
    // effectiveAge = 120, life = 60 → would be 200% but is capped at 90
    expect(computePhysicalDepreciation(120, 'residential_sfr')).toBe(90);
  });

  it('uses a default life of 45 for unknown subtypes', () => {
    // 9 / 45 * 100 = 20%
    expect(computePhysicalDepreciation(9, 'unknown_subtype')).toBe(20);
  });
});

// ─── computeEffectiveAge ─────────────────────────────────────────────────────

describe('computeEffectiveAge', () => {
  it('returns 0 when yearBuilt is null', () => {
    expect(computeEffectiveAge(null)).toBe(0);
  });

  it('returns 0 when yearBuilt is undefined', () => {
    expect(computeEffectiveAge(undefined)).toBe(0);
  });

  it('uses average condition multiplier of 1.0 as default', () => {
    const currentYear = new Date().getFullYear();
    const builtYear = currentYear - 20;
    expect(computeEffectiveAge(builtYear)).toBe(20);
  });

  it('reduces effective age for excellent condition', () => {
    const currentYear = new Date().getFullYear();
    const builtYear = currentYear - 20;
    const effective = computeEffectiveAge(builtYear, 'excellent');
    expect(effective).toBeLessThan(20);
  });

  it('increases effective age for poor condition', () => {
    const currentYear = new Date().getFullYear();
    const builtYear = currentYear - 20;
    const effective = computeEffectiveAge(builtYear, 'poor');
    expect(effective).toBeGreaterThan(20);
  });

  it('never returns a negative value', () => {
    // Future year built with excellent condition could theoretically go negative
    const futureYear = new Date().getFullYear() + 5;
    expect(computeEffectiveAge(futureYear, 'excellent')).toBeGreaterThanOrEqual(0);
  });
});

// ─── Numeric constant integrity ───────────────────────────────────────────────

describe('numeric constant integrity', () => {
  it('EFFECTIVE_AGE_ADJ_RATE_PER_YEAR is a positive decimal', () => {
    expect(EFFECTIVE_AGE_ADJ_RATE_PER_YEAR).toBeGreaterThan(0);
    expect(EFFECTIVE_AGE_ADJ_RATE_PER_YEAR).toBeLessThan(1);
  });

  it('EFFECTIVE_AGE_ADJ_MAX_PCT is a reasonable cap (> 0, ≤ 50)', () => {
    expect(EFFECTIVE_AGE_ADJ_MAX_PCT).toBeGreaterThan(0);
    expect(EFFECTIVE_AGE_ADJ_MAX_PCT).toBeLessThanOrEqual(50);
  });

  it('LOCATION_ADJ_MAX_PCT is positive', () => {
    expect(LOCATION_ADJ_MAX_PCT).toBeGreaterThan(0);
  });

  it('DISTRESSED_SALE_ADJ_PCT is within IAAO standard range (10-20%)', () => {
    expect(DISTRESSED_SALE_ADJ_PCT).toBeGreaterThanOrEqual(10);
    expect(DISTRESSED_SALE_ADJ_PCT).toBeLessThanOrEqual(20);
  });

  it('MARKET_TRENDS_ADJ_PER_MONTH is a small positive number', () => {
    expect(MARKET_TRENDS_ADJ_PER_MONTH).toBeGreaterThan(0);
    expect(MARKET_TRENDS_ADJ_PER_MONTH).toBeLessThan(5);
  });

  it('MARKET_TRENDS_ADJ_MAX_PCT is a reasonable cap', () => {
    expect(MARKET_TRENDS_ADJ_MAX_PCT).toBeGreaterThan(0);
    expect(MARKET_TRENDS_ADJ_MAX_PCT).toBeLessThanOrEqual(30);
  });

  it('SIZE_ADJ asymmetry: smaller subject gets a larger positive adj than larger subject gets negative adj', () => {
    expect(SIZE_ADJ_SMALLER_PER_10PCT).toBeGreaterThan(Math.abs(SIZE_ADJ_LARGER_PER_10PCT));
  });

  it('SIZE_ADJ_MAX_PCT is a reasonable cap', () => {
    expect(SIZE_ADJ_MAX_PCT).toBeGreaterThan(0);
    expect(SIZE_ADJ_MAX_PCT).toBeLessThanOrEqual(30);
  });

  it('CONDITION_ADJ_MAX_PCT is positive', () => {
    expect(CONDITION_ADJ_MAX_PCT).toBeGreaterThan(0);
  });
});
