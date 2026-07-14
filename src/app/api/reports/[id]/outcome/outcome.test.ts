import { describe, expect, it } from 'vitest';
import {
  MAX_ASSESSED_VALUE,
  calculateAssessmentReductionCents,
  validateOutcomeSubmission,
  validateWinningAssessmentReduction,
} from '@/lib/outcomes/validation';

describe('appeal outcome validation', () => {
  it('accepts valid non-winning outcomes without a new assessed value', () => {
    for (const outcome of ['lost', 'pending', 'withdrew', 'didnt_file']) {
      expect(validateOutcomeSubmission({ outcome }).valid).toBe(true);
    }
  });

  it('rejects missing, empty, and unsupported outcomes', () => {
    expect(validateOutcomeSubmission({ outcome: null }).valid).toBe(false);
    expect(validateOutcomeSubmission({ outcome: '' }).valid).toBe(false);
    expect(validateOutcomeSubmission({ outcome: 'victory' }).valid).toBe(false);
    expect(validateOutcomeSubmission({ outcome: 42 }).valid).toBe(false);
  });

  it('requires a new assessed value for a winning appeal', () => {
    const result = validateOutcomeSubmission({ outcome: 'won' });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('required');
  });

  it('accepts a valid quantified winning outcome', () => {
    const result = validateOutcomeSubmission({
      outcome: 'won',
      newAssessedValue: 285_000,
      notes: 'Board adopted the requested value.',
    });

    expect(result).toEqual({
      valid: true,
      outcome: 'won',
      newAssessedValue: 285_000,
      notes: 'Board adopted the requested value.',
    });
  });

  it('rejects invalid assessed values', () => {
    expect(validateOutcomeSubmission({ outcome: 'won', newAssessedValue: -1 }).valid).toBe(false);
    expect(validateOutcomeSubmission({ outcome: 'won', newAssessedValue: Number.NaN }).valid).toBe(false);
    expect(validateOutcomeSubmission({ outcome: 'won', newAssessedValue: Infinity }).valid).toBe(false);
    expect(validateOutcomeSubmission({ outcome: 'won', newAssessedValue: MAX_ASSESSED_VALUE + 1 }).valid).toBe(false);
    expect(validateOutcomeSubmission({ outcome: 'won', newAssessedValue: '285000' }).valid).toBe(false);
  });

  it('accepts zero and the maximum boundary when the underlying assessment permits them', () => {
    expect(validateOutcomeSubmission({ outcome: 'won', newAssessedValue: 0 }).valid).toBe(true);
    expect(
      validateOutcomeSubmission({ outcome: 'won', newAssessedValue: MAX_ASSESSED_VALUE }).valid
    ).toBe(true);
  });

  it('rejects a new assessed value for non-winning outcomes', () => {
    const result = validateOutcomeSubmission({
      outcome: 'lost',
      newAssessedValue: 285_000,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('only be submitted for a winning appeal');
  });

  it('normalizes empty notes and trims supplied notes', () => {
    expect(validateOutcomeSubmission({ outcome: 'pending', notes: '' }).notes).toBeNull();
    expect(
      validateOutcomeSubmission({ outcome: 'pending', notes: '  Hearing continued  ' }).notes
    ).toBe('Hearing continued');
  });

  it('rejects notes over 5000 characters or non-string notes', () => {
    expect(validateOutcomeSubmission({ outcome: 'pending', notes: 'a'.repeat(5001) }).valid).toBe(false);
    expect(validateOutcomeSubmission({ outcome: 'pending', notes: 42 }).valid).toBe(false);
    expect(validateOutcomeSubmission({ outcome: 'pending', notes: ['note'] }).valid).toBe(false);
  });
});

describe('winning assessment reduction validation', () => {
  it('requires an available positive original assessment', () => {
    expect(validateWinningAssessmentReduction(null, 250_000).valid).toBe(false);
    expect(validateWinningAssessmentReduction(0, 0).valid).toBe(false);
  });

  it('requires the new assessment to be lower than the original assessment', () => {
    expect(validateWinningAssessmentReduction(300_000, 300_000).valid).toBe(false);
    expect(validateWinningAssessmentReduction(300_000, 325_000).valid).toBe(false);
    expect(validateWinningAssessmentReduction(300_000, 275_000).valid).toBe(true);
  });

  it('calculates the legacy cents field as assessed-value reduction', () => {
    expect(calculateAssessmentReductionCents(300_000, 275_000)).toBe(2_500_000);
  });
});
