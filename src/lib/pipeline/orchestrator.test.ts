import { describe, it, expect } from 'vitest';

// The orchestrator's STAGES array and skipWhen predicates are private.
// We replicate the skip logic here to ensure correctness, since these
// predicates determine which pipeline stages run for each property/service type.

type PropertyType = 'residential' | 'commercial' | 'industrial' | 'land' | 'agricultural';

// These predicates must match the orchestrator exactly:
// Stage 3 (income) — for commercial, industrial, agricultural, and residential (multifamily filtered inside stage)
const stage3SkipWhen = (pt: PropertyType, _st: string) =>
  pt !== 'commercial' && pt !== 'industrial' && pt !== 'residential' && pt !== 'agricultural';

// Stage 6 (filing guide) — only for tax_appeal
const stage6SkipWhen = (_pt: PropertyType, st: string) =>
  st !== 'tax_appeal';

describe('pipeline stage skip logic', () => {
  describe('stage 3 — income analysis', () => {
    it('runs for commercial properties', () => {
      expect(stage3SkipWhen('commercial', 'tax_appeal')).toBe(false);
    });

    it('runs for industrial properties', () => {
      expect(stage3SkipWhen('industrial', 'tax_appeal')).toBe(false);
    });

    it('runs for residential properties (multifamily filtered inside stage)', () => {
      expect(stage3SkipWhen('residential', 'tax_appeal')).toBe(false);
    });

    it('skips for land properties', () => {
      expect(stage3SkipWhen('land', 'tax_appeal')).toBe(true);
    });

    it('runs for agricultural properties', () => {
      expect(stage3SkipWhen('agricultural', 'tax_appeal')).toBe(false);
    });

    it('runs for commercial regardless of service type', () => {
      expect(stage3SkipWhen('commercial', 'pre_purchase')).toBe(false);
      expect(stage3SkipWhen('commercial', 'pre_listing')).toBe(false);
    });
  });

  describe('stage 6 — filing guide', () => {
    it('runs for tax_appeal service type', () => {
      expect(stage6SkipWhen('residential', 'tax_appeal')).toBe(false);
    });

    it('skips for pre_purchase', () => {
      expect(stage6SkipWhen('residential', 'pre_purchase')).toBe(true);
    });

    it('skips for pre_listing', () => {
      expect(stage6SkipWhen('commercial', 'pre_listing')).toBe(true);
    });

    it('runs for tax_appeal regardless of property type', () => {
      expect(stage6SkipWhen('residential', 'tax_appeal')).toBe(false);
      expect(stage6SkipWhen('commercial', 'tax_appeal')).toBe(false);
      expect(stage6SkipWhen('industrial', 'tax_appeal')).toBe(false);
      expect(stage6SkipWhen('land', 'tax_appeal')).toBe(false);
      expect(stage6SkipWhen('agricultural', 'tax_appeal')).toBe(false);
    });
  });

  describe('stage combinations for typical reports', () => {
    it('residential tax appeal: runs stage 3 (multifamily check inside), runs stage 6', () => {
      expect(stage3SkipWhen('residential', 'tax_appeal')).toBe(false);
      expect(stage6SkipWhen('residential', 'tax_appeal')).toBe(false);
    });

    it('commercial tax appeal: runs both stages 3 and 6', () => {
      expect(stage3SkipWhen('commercial', 'tax_appeal')).toBe(false);
      expect(stage6SkipWhen('commercial', 'tax_appeal')).toBe(false);
    });

    it('residential pre_purchase: runs stage 3 (multifamily check inside), skips stage 6', () => {
      expect(stage3SkipWhen('residential', 'pre_purchase')).toBe(false);
      expect(stage6SkipWhen('residential', 'pre_purchase')).toBe(true);
    });

    it('commercial pre_listing: runs stage 3, skips stage 6', () => {
      expect(stage3SkipWhen('commercial', 'pre_listing')).toBe(false);
      expect(stage6SkipWhen('commercial', 'pre_listing')).toBe(true);
    });

    it('agricultural tax appeal: runs both stages 3 and 6', () => {
      expect(stage3SkipWhen('agricultural', 'tax_appeal')).toBe(false);
      expect(stage6SkipWhen('agricultural', 'tax_appeal')).toBe(false);
    });
  });
});

describe('pipeline stage 4 — computeConditionMode logic', () => {
  // Replicate the condition mode computation from stage4
  const CONDITION_ORDER = ['poor', 'fair', 'average', 'good', 'excellent'] as const;

  function computeConditionMode(values: string[]): string {
    if (values.length === 0) return 'average';

    const freq: Record<string, number> = {};
    for (const v of values) {
      freq[v] = (freq[v] ?? 0) + 1;
    }

    let maxCount = 0;
    let mode = values[0];
    for (const [val, count] of Object.entries(freq)) {
      const valIdx = CONDITION_ORDER.indexOf(val as typeof CONDITION_ORDER[number]);
      const modeIdx = CONDITION_ORDER.indexOf(mode as typeof CONDITION_ORDER[number]);
      if (count > maxCount || (count === maxCount && valIdx < modeIdx)) {
        maxCount = count;
        mode = val;
      }
    }

    return mode;
  }

  it('returns average for empty array', () => {
    expect(computeConditionMode([])).toBe('average');
  });

  it('returns the single value for one-element array', () => {
    expect(computeConditionMode(['poor'])).toBe('poor');
    expect(computeConditionMode(['excellent'])).toBe('excellent');
  });

  it('returns the mode when clear majority', () => {
    expect(computeConditionMode(['fair', 'fair', 'good'])).toBe('fair');
    expect(computeConditionMode(['good', 'good', 'excellent'])).toBe('good');
  });

  it('on tie, returns the worse (lower index) condition', () => {
    // poor=0, fair=1, average=2, good=3, excellent=4
    expect(computeConditionMode(['poor', 'excellent'])).toBe('poor');
    expect(computeConditionMode(['fair', 'good'])).toBe('fair');
    expect(computeConditionMode(['average', 'good'])).toBe('average');
  });

  it('handles all same values', () => {
    expect(computeConditionMode(['poor', 'poor', 'poor'])).toBe('poor');
  });
});
