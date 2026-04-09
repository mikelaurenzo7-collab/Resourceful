import { describe, it, expect } from 'vitest';

// ─── Outcome Validation Logic Tests ──────────────────────────────────────────
// Tests for the validation rules in POST /api/reports/[id]/outcome.
// These mirror the inline validation in the route handler.

const VALID_OUTCOMES = ['won', 'lost', 'pending', 'withdrew', 'didnt_file'] as const;
type AppealOutcome = (typeof VALID_OUTCOMES)[number];

function validateOutcome(outcome: unknown): { valid: boolean; error?: string } {
  if (!outcome || !VALID_OUTCOMES.includes(outcome as AppealOutcome)) {
    return { valid: false, error: `Invalid outcome. Must be one of: ${VALID_OUTCOMES.join(', ')}` };
  }
  return { valid: true };
}

function validateAssessedValue(value: unknown): { valid: boolean; error?: string } {
  if (value === undefined || value === null) return { valid: true };
  if (typeof value !== 'number' || !isFinite(value) || value < 0 || value > 100_000_000_00) {
    return { valid: false, error: 'Invalid assessed value. Must be a positive number.' };
  }
  return { valid: true };
}

function validateNotes(notes: unknown): { valid: boolean; error?: string } {
  if (notes === undefined || notes === null) return { valid: true };
  if (typeof notes !== 'string' || notes.length > 5000) {
    return { valid: false, error: 'Notes must be a string of 5000 characters or less.' };
  }
  return { valid: true };
}

describe('outcome validation', () => {
  describe('outcome field', () => {
    it('accepts all valid outcome values', () => {
      for (const outcome of VALID_OUTCOMES) {
        expect(validateOutcome(outcome).valid).toBe(true);
      }
    });

    it('rejects null outcome', () => {
      expect(validateOutcome(null).valid).toBe(false);
    });

    it('rejects undefined outcome', () => {
      expect(validateOutcome(undefined).valid).toBe(false);
    });

    it('rejects empty string outcome', () => {
      expect(validateOutcome('').valid).toBe(false);
    });

    it('rejects invalid outcome value', () => {
      expect(validateOutcome('victory').valid).toBe(false);
    });

    it('rejects numeric outcome', () => {
      expect(validateOutcome(42).valid).toBe(false);
    });
  });

  describe('assessed value', () => {
    it('accepts null (optional field)', () => {
      expect(validateAssessedValue(null).valid).toBe(true);
    });

    it('accepts undefined (optional field)', () => {
      expect(validateAssessedValue(undefined).valid).toBe(true);
    });

    it('accepts zero', () => {
      expect(validateAssessedValue(0).valid).toBe(true);
    });

    it('accepts positive numbers', () => {
      expect(validateAssessedValue(250000).valid).toBe(true);
    });

    it('rejects negative numbers', () => {
      expect(validateAssessedValue(-1).valid).toBe(false);
    });

    it('rejects NaN', () => {
      expect(validateAssessedValue(NaN).valid).toBe(false);
    });

    it('rejects Infinity', () => {
      expect(validateAssessedValue(Infinity).valid).toBe(false);
    });

    it('rejects values exceeding max (10 billion cents)', () => {
      expect(validateAssessedValue(100_000_000_01).valid).toBe(false);
    });

    it('accepts value at the max boundary', () => {
      expect(validateAssessedValue(100_000_000_00).valid).toBe(true);
    });

    it('rejects string values', () => {
      expect(validateAssessedValue('250000').valid).toBe(false);
    });
  });

  describe('notes', () => {
    it('accepts null (optional field)', () => {
      expect(validateNotes(null).valid).toBe(true);
    });

    it('accepts undefined (optional field)', () => {
      expect(validateNotes(undefined).valid).toBe(true);
    });

    it('accepts empty string', () => {
      expect(validateNotes('').valid).toBe(true);
    });

    it('accepts valid notes up to 5000 chars', () => {
      expect(validateNotes('Won the appeal with comps evidence.').valid).toBe(true);
    });

    it('accepts notes at exactly 5000 characters', () => {
      expect(validateNotes('a'.repeat(5000)).valid).toBe(true);
    });

    it('rejects notes over 5000 characters', () => {
      expect(validateNotes('a'.repeat(5001)).valid).toBe(false);
    });

    it('rejects non-string notes (number)', () => {
      expect(validateNotes(42).valid).toBe(false);
    });

    it('rejects non-string notes (array)', () => {
      expect(validateNotes(['note1', 'note2']).valid).toBe(false);
    });

    it('rejects non-string notes (object)', () => {
      expect(validateNotes({ text: 'some note' }).valid).toBe(false);
    });
  });
});
