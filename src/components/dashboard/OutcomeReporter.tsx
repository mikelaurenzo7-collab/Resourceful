'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  validateOutcomeSubmission,
  validateWinningAssessmentReduction,
  type AppealOutcome,
} from '@/lib/outcomes/validation';

interface OutcomeReporterProps {
  reportId: string;
  currentOutcome: string | null;
  assessedValue: number | null;
}

const OUTCOMES: {
  value: AppealOutcome;
  label: string;
  icon: string;
  color: 'emerald' | 'red' | 'amber' | 'slate';
}[] = [
  { value: 'won', label: 'Won — assessment reduced', icon: '✓', color: 'emerald' },
  { value: 'lost', label: 'Lost — no change', icon: '✗', color: 'red' },
  { value: 'pending', label: 'Still pending', icon: '⏳', color: 'amber' },
  { value: 'withdrew', label: 'Withdrew appeal', icon: '↩', color: 'slate' },
  { value: 'didnt_file', label: "Didn't file", icon: '—', color: 'slate' },
];

export default function OutcomeReporter({
  reportId,
  currentOutcome,
  assessedValue,
}: OutcomeReporterProps) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<AppealOutcome | ''>(
    OUTCOMES.some((option) => option.value === currentOutcome)
      ? (currentOutcome as AppealOutcome)
      : ''
  );
  const [newAssessedInput, setNewAssessedInput] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(Boolean(currentOutcome));
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleOutcomeSelect = (nextOutcome: AppealOutcome) => {
    setOutcome(nextOutcome);
    setError('');
    if (nextOutcome !== 'won') setNewAssessedInput('');
  };

  const handleSubmit = async () => {
    if (!outcome) {
      setError('Please select an outcome.');
      return;
    }

    const parsedNewAssessment =
      outcome === 'won' && newAssessedInput.trim()
        ? Number(newAssessedInput)
        : null;

    const submissionValidation = validateOutcomeSubmission({
      outcome,
      newAssessedValue: outcome === 'won' ? parsedNewAssessment : null,
      notes,
    });

    if (!submissionValidation.valid) {
      setError(submissionValidation.error ?? 'Please review the submitted outcome.');
      return;
    }

    if (outcome === 'won') {
      const reductionValidation = validateWinningAssessmentReduction(
        assessedValue,
        parsedNewAssessment
      );
      if (!reductionValidation.valid) {
        setError(
          reductionValidation.error ??
            'The assessment reduction could not be verified.'
        );
        return;
      }
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/reports/${reportId}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome,
          notes: notes.trim() || null,
          new_assessed_value:
            outcome === 'won' ? parsedNewAssessment : null,
        }),
      });

      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? `Failed to save (${response.status})`);
      }

      setSubmitted(true);
      setIsOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted && !isOpen) {
    return (
      <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.05] p-5" data-animate>
        <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-emerald-300/70">
          Appeal Result Recorded
        </p>
        <p className="text-sm text-cream/55 mt-2">
          The reported result was saved and will be used to improve future valuation calibration.
        </p>
      </div>
    );
  }

  const maxWinningAssessment =
    assessedValue != null && assessedValue > 0
      ? Math.max(0, assessedValue - 0.01)
      : undefined;

  return (
    <div className="card-premium rounded-xl overflow-hidden" data-animate>
      <div className="px-5 py-4 border-b border-gold/[0.08]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium text-cream">How did your appeal go?</h3>
            <p className="text-[11px] text-cream/30 mt-0.5">
              Your verified result improves future valuation calibration.
            </p>
          </div>
          {!isOpen && (
            <button
              onClick={() => setIsOpen(true)}
              className="text-xs font-medium text-gold hover:text-gold-light transition-colors px-3 py-1.5 border border-gold/20 rounded-lg hover:border-gold/40"
            >
              Share Result
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="px-5 py-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {OUTCOMES.map((option) => (
              <button
                key={option.value}
                onClick={() => handleOutcomeSelect(option.value)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all text-sm ${
                  outcome === option.value
                    ? option.color === 'emerald'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                      : option.color === 'red'
                        ? 'border-red-500/40 bg-red-500/10 text-red-400'
                        : option.color === 'amber'
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                          : 'border-cream/20 bg-cream/5 text-cream/60'
                    : 'border-gold/10 text-cream/40 hover:border-gold/25 hover:text-cream/60'
                }`}
              >
                <span className="text-base w-5 text-center flex-shrink-0">{option.icon}</span>
                {option.label}
              </button>
            ))}
          </div>

          {outcome === 'won' && (
            <div>
              <label className="block text-xs text-cream/45 mb-1.5">
                New assessed value after the decision <span className="text-red-300">*</span>
                {assessedValue != null && assessedValue > 0 && (
                  <span className="text-cream/20 ml-1">
                    — original {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      maximumFractionDigits: 0,
                    }).format(assessedValue)}
                  </span>
                )}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/30 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  max={maxWinningAssessment}
                  step="1"
                  value={newAssessedInput}
                  onChange={(event) => {
                    setNewAssessedInput(event.target.value);
                    setError('');
                  }}
                  placeholder={
                    assessedValue != null && assessedValue > 0
                      ? `Enter a value below ${assessedValue.toLocaleString('en-US')}`
                      : 'Enter the board-approved assessment'
                  }
                  className="w-full bg-navy-deep/60 border border-gold/15 rounded-lg pl-7 pr-4 py-2.5 text-sm text-cream placeholder:text-cream/20 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20"
                />
              </div>
              <p className="text-[11px] text-cream/30 mt-1.5">
                Enter the final assessed value, not estimated tax savings. A winning result must be lower than the original assessment.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs text-cream/40 mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Any details about the hearing or decision..."
              rows={2}
              maxLength={5000}
              className="w-full bg-navy-deep/60 border border-gold/15 rounded-lg px-4 py-2.5 text-sm text-cream placeholder:text-cream/20 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 rounded-lg border border-red-500/15 bg-red-500/[0.06] px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={
                submitting ||
                !outcome ||
                (outcome === 'won' && !newAssessedInput.trim())
              }
              className="flex items-center gap-2 px-5 py-2.5 text-sm rounded-lg btn-premium-glow disabled:opacity-40 disabled:shadow-none"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-navy-deep/30 border-t-navy-deep rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                'Submit'
              )}
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                setError('');
              }}
              className="text-xs text-cream/30 hover:text-cream/50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
