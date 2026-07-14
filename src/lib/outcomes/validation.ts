// ─── Appeal Outcome Validation ────────────────────────────────────────────────
// Shared by the outcome API and tests so submitted appeal results cannot drift
// from the rules used to calculate the legacy actual_savings_cents field.

export const VALID_APPEAL_OUTCOMES = [
  'won',
  'lost',
  'pending',
  'withdrew',
  'didnt_file',
] as const;

export type AppealOutcome = (typeof VALID_APPEAL_OUTCOMES)[number];

export const MAX_ASSESSED_VALUE = 10_000_000_000;
export const MAX_OUTCOME_NOTES_LENGTH = 5_000;

export interface OutcomeSubmissionInput {
  outcome: unknown;
  newAssessedValue?: unknown;
  notes?: unknown;
}

export interface OutcomeValidationResult {
  valid: boolean;
  error?: string;
  outcome?: AppealOutcome;
  newAssessedValue?: number | null;
  notes?: string | null;
}

function isValidAssessedValue(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_ASSESSED_VALUE
  );
}

export function validateOutcomeSubmission(
  input: OutcomeSubmissionInput
): OutcomeValidationResult {
  if (
    typeof input.outcome !== 'string' ||
    !VALID_APPEAL_OUTCOMES.includes(input.outcome as AppealOutcome)
  ) {
    return {
      valid: false,
      error: `Invalid outcome. Must be one of: ${VALID_APPEAL_OUTCOMES.join(', ')}`,
    };
  }

  const outcome = input.outcome as AppealOutcome;

  if (
    input.notes !== undefined &&
    input.notes !== null &&
    (typeof input.notes !== 'string' || input.notes.length > MAX_OUTCOME_NOTES_LENGTH)
  ) {
    return {
      valid: false,
      error: `Notes must be a string of ${MAX_OUTCOME_NOTES_LENGTH} characters or less.`,
    };
  }

  const normalizedNotes = typeof input.notes === 'string' && input.notes.trim()
    ? input.notes.trim()
    : null;

  if (outcome === 'won') {
    if (input.newAssessedValue === undefined || input.newAssessedValue === null) {
      return {
        valid: false,
        error: 'New assessed value is required when the appeal outcome is won.',
      };
    }

    if (!isValidAssessedValue(input.newAssessedValue)) {
      return {
        valid: false,
        error: `New assessed value must be between $0 and $${MAX_ASSESSED_VALUE.toLocaleString('en-US')}.`,
      };
    }

    return {
      valid: true,
      outcome,
      newAssessedValue: input.newAssessedValue,
      notes: normalizedNotes,
    };
  }

  if (input.newAssessedValue !== undefined && input.newAssessedValue !== null) {
    return {
      valid: false,
      error: 'New assessed value may only be submitted for a winning appeal.',
    };
  }

  return {
    valid: true,
    outcome,
    newAssessedValue: null,
    notes: normalizedNotes,
  };
}

export function validateWinningAssessmentReduction(
  originalAssessedValue: number | null | undefined,
  newAssessedValue: number | null | undefined
): { valid: boolean; error?: string } {
  if (!isValidAssessedValue(originalAssessedValue) || originalAssessedValue <= 0) {
    return {
      valid: false,
      error: 'Original assessed value is unavailable; the winning outcome cannot be quantified yet.',
    };
  }

  if (!isValidAssessedValue(newAssessedValue)) {
    return {
      valid: false,
      error: 'A valid new assessed value is required for a winning appeal.',
    };
  }

  if (newAssessedValue >= originalAssessedValue) {
    return {
      valid: false,
      error: 'The new assessed value must be lower than the original assessed value for a winning appeal.',
    };
  }

  return { valid: true };
}

/**
 * Returns the reduction in assessed value using the legacy cents storage field.
 * This is not annual tax-dollar savings and must not be labeled as such.
 */
export function calculateAssessmentReductionCents(
  originalAssessedValue: number,
  newAssessedValue: number
): number {
  return Math.max(0, Math.round((originalAssessedValue - newAssessedValue) * 100));
}
