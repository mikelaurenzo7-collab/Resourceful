import { describe, expect, it } from 'vitest';
import {
  filingStatusForOutcome,
  isAdjudicatedAppealOutcome,
  isFinalAppealOutcome,
  validateFilingUpdate,
  validateOutcomeFilingContext,
  validateOutcomeTransition,
} from './lifecycle';

describe('appeal outcome lifecycle', () => {
  it('allows an unresolved outcome to advance to a final outcome', () => {
    expect(validateOutcomeTransition(null, 'pending')).toEqual({ valid: true });
    expect(validateOutcomeTransition('pending', 'won')).toEqual({ valid: true });
    expect(validateOutcomeTransition('pending', 'lost')).toEqual({ valid: true });
  });

  it('keeps final outcomes immutable', () => {
    expect(validateOutcomeTransition('won', 'lost').valid).toBe(false);
    expect(validateOutcomeTransition('lost', 'lost').valid).toBe(false);
    expect(validateOutcomeTransition('didnt_file', 'pending').valid).toBe(false);
  });

  it('requires filing proof for every outcome except did not file', () => {
    expect(
      validateOutcomeFilingContext({
        outcome: 'pending',
        filingStatus: 'not_started',
        filedAt: null,
        filingMethod: null,
      }).valid
    ).toBe(false);

    expect(
      validateOutcomeFilingContext({
        outcome: 'won',
        filingStatus: 'filed',
        filedAt: '2026-07-01',
        filingMethod: 'online',
      })
    ).toEqual({ valid: true });

    expect(
      validateOutcomeFilingContext({
        outcome: 'didnt_file',
        filingStatus: 'not_started',
        filedAt: null,
        filingMethod: null,
      })
    ).toEqual({ valid: true });
  });

  it('maps pending and final decisions to deterministic filing states', () => {
    expect(filingStatusForOutcome('pending', 'filed')).toBe('decision_pending');
    expect(filingStatusForOutcome('won', 'decision_pending')).toBe('closed');
    expect(filingStatusForOutcome('didnt_file', 'not_started')).toBe('closed');
  });

  it('distinguishes final and adjudicated outcomes', () => {
    expect(isFinalAppealOutcome('won')).toBe(true);
    expect(isFinalAppealOutcome('withdrew')).toBe(true);
    expect(isFinalAppealOutcome('pending')).toBe(false);
    expect(isAdjudicatedAppealOutcome('won')).toBe(true);
    expect(isAdjudicatedAppealOutcome('lost')).toBe(true);
    expect(isAdjudicatedAppealOutcome('withdrew')).toBe(false);
  });
});

describe('filing progress lifecycle', () => {
  const base = {
    reportStatus: 'delivered' as const,
    serviceType: 'tax_appeal' as const,
    currentFilingStatus: 'not_started',
    currentFiledAt: null,
    currentFilingMethod: null,
    currentOutcome: null,
    now: new Date('2026-07-18T12:00:00Z'),
  };

  it('requires a delivered tax-appeal report', () => {
    expect(validateFilingUpdate({ ...base, reportStatus: 'processing', requestedFilingStatus: 'filed' }).valid).toBe(false);
    expect(validateFilingUpdate({ ...base, serviceType: 'pre_purchase', requestedFilingStatus: 'filed' }).valid).toBe(false);
  });

  it('allows filing when date and method are supplied', () => {
    expect(
      validateFilingUpdate({
        ...base,
        requestedFilingStatus: 'filed',
        requestedFiledAt: '2026-07-17',
        requestedFilingMethod: 'online',
      })
    ).toEqual({ valid: true });
  });

  it('rejects filing without complete proof or with a future date', () => {
    expect(
      validateFilingUpdate({
        ...base,
        requestedFilingStatus: 'filed',
        requestedFiledAt: '2026-07-17',
      }).valid
    ).toBe(false);

    expect(
      validateFilingUpdate({
        ...base,
        requestedFilingStatus: 'filed',
        requestedFiledAt: '2026-08-01',
        requestedFilingMethod: 'mail',
      }).valid
    ).toBe(false);
  });

  it('prevents skipping lifecycle stages or closing without a final outcome', () => {
    expect(validateFilingUpdate({ ...base, requestedFilingStatus: 'decision_pending' }).valid).toBe(false);

    expect(
      validateFilingUpdate({
        ...base,
        currentFilingStatus: 'decision_pending',
        currentFiledAt: '2026-07-01',
        currentFilingMethod: 'online',
        requestedFilingStatus: 'closed',
      }).valid
    ).toBe(false);

    expect(
      validateFilingUpdate({
        ...base,
        currentFilingStatus: 'decision_pending',
        currentFiledAt: '2026-07-01',
        currentFilingMethod: 'online',
        currentOutcome: 'won',
        requestedFilingStatus: 'closed',
      })
    ).toEqual({ valid: true });
  });
});
