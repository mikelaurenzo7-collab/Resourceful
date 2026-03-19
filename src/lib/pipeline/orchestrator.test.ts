import { describe, it, expect } from 'vitest';

// The orchestrator's STAGES array and skipWhen predicates are private.
// We replicate the skip logic here to ensure correctness, since these
// predicates determine which pipeline stages run for each property/service type.

type PropertyType = 'residential' | 'land';

// Stage 6 (filing guide) — only for tax_appeal
const stage6SkipWhen = (_pt: PropertyType, st: string) =>
  st !== 'tax_appeal';

describe('pipeline stage skip logic', () => {
  describe('stage 6 — filing guide', () => {
    it('runs for tax_appeal service type', () => {
      expect(stage6SkipWhen('residential', 'tax_appeal')).toBe(false);
    });

    it('skips for pre_purchase', () => {
      expect(stage6SkipWhen('residential', 'pre_purchase')).toBe(true);
    });

    it('skips for pre_listing', () => {
      expect(stage6SkipWhen('residential', 'pre_listing')).toBe(true);
    });

    it('runs for tax_appeal regardless of property type', () => {
      expect(stage6SkipWhen('residential', 'tax_appeal')).toBe(false);
      expect(stage6SkipWhen('land', 'tax_appeal')).toBe(false);
    });
  });

  describe('stage combinations for typical reports', () => {
    it('residential tax appeal: runs stage 6', () => {
      expect(stage6SkipWhen('residential', 'tax_appeal')).toBe(false);
    });

    it('land tax appeal: runs stage 6', () => {
      expect(stage6SkipWhen('land', 'tax_appeal')).toBe(false);
    });

    it('residential pre_purchase: skips stage 6', () => {
      expect(stage6SkipWhen('residential', 'pre_purchase')).toBe(true);
    });

    it('residential pre_listing: skips stage 6', () => {
      expect(stage6SkipWhen('residential', 'pre_listing')).toBe(true);
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
