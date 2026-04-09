'use client';

import { useState } from 'react';

interface AppealJourneyProps {
  reportId: string;
  filingStatus: string;
  filedAt: string | null;
  filingMethod: string | null;
  appealOutcome: string | null;
  outcomeReportedAt: string | null;
  deliveredAt: string | null;
  /** Days since delivery — used to decide whether to prompt for outcome */
  daysSinceDelivery: number;
}

const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
  won:         { label: 'Won',          color: 'emerald' },
  lost:        { label: 'Lost',         color: 'red' },
  pending:     { label: 'Pending',      color: 'amber' },
  withdrew:    { label: 'Withdrew',     color: 'slate' },
  didnt_file:  { label: "Didn't File",  color: 'slate' },
};

const METHOD_LABELS: Record<string, string> = {
  online:    'Online',
  email:     'Email',
  mail:      'Mail',
  in_person: 'In Person',
};

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function AppealJourney({
  reportId,
  filingStatus,
  filedAt,
  filingMethod,
  appealOutcome,
  outcomeReportedAt,
  deliveredAt,
  daysSinceDelivery,
}: AppealJourneyProps) {
  const hasFiled = filedAt != null || filingStatus === 'filed' || filingStatus === 'hearing_scheduled' || filingStatus === 'decision_pending' || filingStatus === 'closed';
  const hasOutcome = appealOutcome != null && appealOutcome !== 'pending';

  const [localFilingStatus, setLocalFilingStatus] = useState(filingStatus);
  const [localFiledAt, setLocalFiledAt] = useState(filedAt);
  const [localFilingMethod, setLocalFilingMethod] = useState(filingMethod);
  const [localFiled, setLocalFiled] = useState(hasFiled);

  const [showFilingForm, setShowFilingForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const markFiled = async (method: string) => {
    setSaving(true);
    setSaveError('');
    const today = new Date().toISOString().substring(0, 10);
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filing_status: 'filed',
          filed_at: today,
          filing_method: method,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? 'Failed to save');
      }
      setLocalFilingStatus('filed');
      setLocalFiledAt(today);
      setLocalFilingMethod(method);
      setLocalFiled(true);
      setShowFilingForm(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Step definitions ────────────────────────────────────────────────────
  const steps = [
    {
      key: 'delivered',
      label: 'Report Delivered',
      done: true,
      date: deliveredAt ? fmt(deliveredAt) : null,
    },
    {
      key: 'filed',
      label: 'Appeal Filed',
      done: localFiled,
      date: localFiledAt ? fmt(localFiledAt) : null,
      sub: localFilingMethod ? METHOD_LABELS[localFilingMethod] ?? localFilingMethod : null,
    },
    {
      key: 'outcome',
      label: 'Outcome',
      done: hasOutcome,
      date: outcomeReportedAt ? fmt(outcomeReportedAt) : null,
      outcome: appealOutcome,
    },
  ] as const;

  const outcomeInfo = appealOutcome ? OUTCOME_LABELS[appealOutcome] : null;

  return (
    <div className="card-premium rounded-xl overflow-hidden">
      {/* ── 3-step tracker ────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 divide-x divide-gold/[0.08]">
        {steps.map((step) => (
          <div
            key={step.key}
            className={`px-4 py-4 ${step.done ? 'bg-emerald-950/[0.12]' : ''}`}
          >
            <div className="flex items-center gap-2 mb-1">
              {step.done ? (
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-4 h-4 rounded-full border border-cream/10 flex-shrink-0" />
              )}
              <span className={`text-xs font-medium leading-tight ${step.done ? 'text-emerald-400/80' : 'text-cream/25'}`}>
                {step.label}
              </span>
            </div>

            {step.done && step.date && (
              <p className="text-[10px] text-cream/20 pl-6">{step.date}</p>
            )}
            {'sub' in step && step.sub && step.done && (
              <p className="text-[10px] text-cream/15 pl-6">{step.sub}</p>
            )}
            {'outcome' in step && step.outcome && outcomeInfo && (
              <p className={`text-[10px] pl-6 font-medium mt-0.5 ${
                outcomeInfo.color === 'emerald' ? 'text-emerald-400/70'
                : outcomeInfo.color === 'red' ? 'text-red-400/70'
                : outcomeInfo.color === 'amber' ? 'text-amber-400/70'
                : 'text-cream/30'
              }`}>
                {outcomeInfo.label}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ── CTA strip ─────────────────────────────────────────────────── */}
      {!localFiled && !showFilingForm && (
        <div className="px-4 py-3 border-t border-gold/[0.06] flex items-center justify-between gap-3">
          <p className="text-[11px] text-cream/25">Filed your appeal yet?</p>
          <button
            onClick={() => setShowFilingForm(true)}
            className="text-[11px] font-medium text-gold hover:text-gold-light transition-colors"
          >
            Mark as Filed
          </button>
        </div>
      )}

      {!localFiled && showFilingForm && (
        <div className="px-4 py-4 border-t border-gold/[0.08] space-y-3">
          <p className="text-xs text-cream/40">How did you file?</p>
          {saveError && (
            <p className="text-xs text-red-400">{saveError}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {(['online', 'email', 'mail', 'in_person'] as const).map((method) => (
              <button
                key={method}
                onClick={() => markFiled(method)}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gold/20 text-cream/50 hover:border-gold/40 hover:text-cream/80 transition-all disabled:opacity-40 capitalize"
              >
                {saving ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 border border-gold/40 border-t-transparent rounded-full animate-spin" />
                    Saving…
                  </span>
                ) : (
                  METHOD_LABELS[method]
                )}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setShowFilingForm(false); setSaveError(''); }}
            className="text-[10px] text-cream/20 hover:text-cream/40 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Outcome prompt (30+ days after delivery, not yet recorded) ── */}
      {localFiled && !hasOutcome && daysSinceDelivery >= 30 && (
        <div className="px-4 py-3 border-t border-gold/[0.06] flex items-center justify-between gap-3">
          <p className="text-[11px] text-cream/25">How did your appeal go?</p>
          <a
            href={`/report/${reportId}`}
            className="text-[11px] font-medium text-gold hover:text-gold-light transition-colors"
          >
            Share Your Result
          </a>
        </div>
      )}

      {/* ── Outcome recorded: savings display ─────────────────────────── */}
      {hasOutcome && appealOutcome === 'won' && (
        <div className="px-4 py-3 border-t border-emerald-500/10 bg-emerald-950/10">
          <p className="text-[11px] text-emerald-400/70 font-medium">
            Appeal won
            {outcomeReportedAt && ` · reported ${fmt(outcomeReportedAt)}`}
          </p>
        </div>
      )}
    </div>
  );
}
