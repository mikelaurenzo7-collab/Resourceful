import { describe, expect, it } from 'vitest';

import {
  shouldSkipGuidanceStage,
  shouldSkipIncomeStage,
} from './stage-policy';
import {
  calculateRetryDelaySeconds,
  getCompletedStageNumber,
  inferNextStageNumber,
} from './run-types';

describe('pipeline stage policy', () => {
  describe('stage 3 — income analysis', () => {
    it('runs for potentially income-producing property categories', () => {
      expect(
        shouldSkipIncomeStage('commercial', 'tax_appeal')
      ).toBe(false);
      expect(
        shouldSkipIncomeStage('industrial', 'tax_appeal')
      ).toBe(false);
      expect(
        shouldSkipIncomeStage('residential', 'pre_purchase')
      ).toBe(false);
      expect(
        shouldSkipIncomeStage('agricultural', 'pre_listing')
      ).toBe(false);
    });

    it('skips land when no income-producing subtype can be established', () => {
      expect(
        shouldSkipIncomeStage('land', 'tax_appeal')
      ).toBe(true);
    });
  });

  describe('stage 6 — assignment guidance', () => {
    it('runs for tax appeals, pre-purchase, and pre-listing assignments', () => {
      expect(
        shouldSkipGuidanceStage('residential', 'tax_appeal')
      ).toBe(false);
      expect(
        shouldSkipGuidanceStage('residential', 'pre_purchase')
      ).toBe(false);
      expect(
        shouldSkipGuidanceStage('commercial', 'pre_listing')
      ).toBe(false);
    });
  });
});

describe('durable stage recovery policy', () => {
  it('maps persisted stage names to deterministic stage numbers', () => {
    expect(getCompletedStageNumber(null)).toBe(0);
    expect(getCompletedStageNumber('stage-1-data')).toBe(1);
    expect(getCompletedStageNumber('stage-4-photos')).toBe(4);
    expect(getCompletedStageNumber('stage-7-pdf')).toBe(7);
    expect(getCompletedStageNumber('unknown-stage')).toBe(0);
  });

  it('resumes at the first incomplete stage', () => {
    expect(inferNextStageNumber(null)).toBe(1);
    expect(inferNextStageNumber('stage-1-data')).toBe(2);
    expect(inferNextStageNumber('stage-6-filing')).toBe(7);
  });

  it('keeps stage 7 for terminal-state reconciliation', () => {
    expect(inferNextStageNumber('stage-7-pdf')).toBe(7);
  });

  it('uses bounded exponential retry delays', () => {
    expect(calculateRetryDelaySeconds(1)).toBe(30);
    expect(calculateRetryDelaySeconds(2)).toBe(60);
    expect(calculateRetryDelaySeconds(3)).toBe(120);
    expect(calculateRetryDelaySeconds(99)).toBe(900);
  });
});

describe('pipeline stage 4 — computeConditionMode logic', () => {
  const conditionOrder = [
    'poor',
    'fair',
    'average',
    'good',
    'excellent',
  ] as const;

  function computeConditionMode(values: string[]): string {
    if (values.length === 0) return 'average';

    const frequency: Record<string, number> = {};
    for (const value of values) {
      frequency[value] = (frequency[value] ?? 0) + 1;
    }

    let maxCount = 0;
    let mode = values[0];
    for (const [value, count] of Object.entries(frequency)) {
      const valueIndex = conditionOrder.indexOf(
        value as (typeof conditionOrder)[number]
      );
      const modeIndex = conditionOrder.indexOf(
        mode as (typeof conditionOrder)[number]
      );
      if (
        count > maxCount ||
        (count === maxCount && valueIndex < modeIndex)
      ) {
        maxCount = count;
        mode = value;
      }
    }

    return mode;
  }

  it('returns average for an empty array', () => {
    expect(computeConditionMode([])).toBe('average');
  });

  it('returns the mode when there is a clear majority', () => {
    expect(
      computeConditionMode(['fair', 'fair', 'good'])
    ).toBe('fair');
    expect(
      computeConditionMode(['good', 'good', 'excellent'])
    ).toBe('good');
  });

  it('chooses the more conservative condition on a tie', () => {
    expect(
      computeConditionMode(['poor', 'excellent'])
    ).toBe('poor');
    expect(
      computeConditionMode(['fair', 'good'])
    ).toBe('fair');
    expect(
      computeConditionMode(['average', 'good'])
    ).toBe('average');
  });
});
