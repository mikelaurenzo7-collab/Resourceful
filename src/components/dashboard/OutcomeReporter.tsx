'use client';

import { useState } from 'react';

interface OutcomeReporterProps {
  reportId: string;
  currentOutcome: string | null;
  assessedValue: number | null;
}

const OUTCOMES = [
  { value: 'won', label: 'Won — assessment reduced', icon: '✓', color: 'emerald' },
  { value: 'lost', label: 'Lost — no change', icon: '✗', color: 'red' },
  { value: 'pending', label: 'Still pending', icon: '⏳', color: 'amber' },
  { value: 'withdrew', label: 'Withdrew appeal', icon: '↩', color: 'slate' },
  { value: 'didnt_file', label: "Didn't file", icon: '—', color: 'slate' },
] as const;

export default function OutcomeReporter({
  reportId,
  currentOutcome,
  assessedValue,
}: OutcomeReporterProps) {
  const [outcome, setOutcome] = useState(currentOutcome ?? '');
  const [newAssessedInput, setNewAssessedInput] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(!!currentOutcome);
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Already reported
  if (submitted && !isOpen) {
    return null;
  }

  const handleSubmit = async () => {
    if (!outcome) {
      setError('Please select an outcome');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const body: Record<string, unknown> = {
        outcome,
        notes: notes || null,
      };

      if (outcome === 'won' && newAssessedInput) {
        const val = parseFloat(newAssessedInput);
        if (isNaN(val) || val < 0) {
          setError('Please enter a valid dollar amount');
          setSubmitting(false);
          return;
        }
        body.new_assessed_value = val;
      }

      const res = await fetch(`/api/reports/${reportId}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Failed to save (${res.status})`);
      }

      setSubmitted(true);
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card-premium rounded-xl overflow-hidden" data-animate>
      <div className="px-5 py-4 border-b border-gold/[0.08]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-cream">How did your appeal go?</h3>
            <p className="text-[11px] text-cream/30 mt-0.5">
              Your feedback improves our accuracy for everyone.
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
          {/* Outcome selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {OUTCOMES.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setOutcome(opt.value)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all text-sm ${
                  outcome === opt.value
                    ? opt.color === 'emerald'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                      : opt.color === 'red'
                      ? 'border-red-500/40 bg-red-500/10 text-red-400'
                      : opt.color === 'amber'
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                      : 'border-cream/20 bg-cream/5 text-cream/60'
                    : 'border-gold/10 text-cream/40 hover:border-gold/25 hover:text-cream/60'
                }`}
              >
                <span className="text-base w-5 text-center flex-shrink-0">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>

          {/* New assessed value input (only when won) */}
          {outcome === 'won' && (
            <div>
              <label className="block text-xs text-cream/40 mb-1.5">
                New assessed value after appeal
                {assessedValue && assessedValue > 0 && (
                  <span className="text-cream/20 ml-1">
                    — was {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(assessedValue)}
                  </span>
                )}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/30 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={newAssessedInput}
                  onChange={(e) => setNewAssessedInput(e.target.value)}
                  placeholder="e.g. 285000"
                  className="w-full bg-navy-deep/60 border border-gold/15 rounded-lg pl-7 pr-4 py-2.5 text-sm text-cream placeholder:text-cream/20 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20"
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs text-cream/40 mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any details about the hearing or decision..."
              rows={2}
              maxLength={500}
              className="w-full bg-navy-deep/60 border border-gold/15 rounded-lg px-4 py-2.5 text-sm text-cream placeholder:text-cream/20 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={submitting || !outcome}
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
              onClick={() => { setIsOpen(false); setError(''); }}
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
