'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AppealJourneyProps {
  reportId: string;
  filingStatus: string;
  filedAt: string | null;
  filingMethod: string | null;
  appealOutcome: string | null;
  outcomeReportedAt: string | null;
  deliveredAt: string | null;
  daysSinceDelivery: number;
}

const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
  won: { label: 'Won', color: 'emerald' },
  lost: { label: 'Lost', color: 'red' },
  pending: { label: 'Pending', color: 'amber' },
  withdrew: { label: 'Withdrew', color: 'slate' },
  didnt_file: { label: "Didn't File", color: 'slate' },
};

const METHOD_LABELS: Record<string, string> = {
  online: 'Online',
  email: 'Email',
  mail: 'Mail',
  in_person: 'In Person',
};

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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
  const router = useRouter();
  const initiallyFiled =
    filedAt != null ||
    ['filed', 'hearing_scheduled', 'decision_pending', 'closed'].includes(filingStatus);

  const [localFiledAt, setLocalFiledAt] = useState(filedAt);
  const [localFilingMethod, setLocalFilingMethod] = useState(filingMethod);
  const [localFilingStatus, setLocalFilingStatus] = useState(filingStatus);
  const [localFiled, setLocalFiled] = useState(initiallyFiled);
  const [showFilingForm, setShowFilingForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const finalOutcome = appealOutcome != null && appealOutcome !== 'pending';
  const finalOutcomeLabel = appealOutcome
    ? OUTCOME_LABELS[appealOutcome]?.label ?? appealOutcome
    : null;
  const authorityReviewStarted =
    ['hearing_scheduled', 'decision_pending', 'closed'].includes(localFilingStatus) ||
    appealOutcome === 'pending' ||
    finalOutcome;
  const caseClosed = localFilingStatus === 'closed' || finalOutcome;

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
        throw new Error(json.error ?? 'Failed to save filing details.');
      }

      setLocalFiledAt(today);
      setLocalFilingMethod(method);
      setLocalFilingStatus('filed');
      setLocalFiled(true);
      setShowFilingForm(false);
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    {
      key: 'delivered',
      label: 'Report Ready',
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
      key: 'review',
      label: 'Authority Review',
      done: authorityReviewStarted,
      sub: appealOutcome === 'pending' ? 'Decision pending' : null,
    },
    {
      key: 'decision',
      label: 'Decision Received',
      done: finalOutcome,
      date: outcomeReportedAt ? fmt(outcomeReportedAt) : null,
      outcome: appealOutcome,
    },
    {
      key: 'closed',
      label: 'Case Closed',
      done: caseClosed,
      sub: finalOutcome ? finalOutcomeLabel : null,
    },
  ] as const;

  const firstIncomplete = steps.findIndex((step) => !step.done);
  const outcomeInfo = appealOutcome ? OUTCOME_LABELS[appealOutcome] : null;

  return (
    <div className="card-premium rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gold/[0.08]">
        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-gold/65">
          Appeal Lifecycle
        </p>
        <h3 className="text-sm font-medium text-cream mt-1">From report delivery through final decision</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-gold/[0.08]">
        {steps.map((step, index) => {
          const isCurrent = firstIncomplete === index;
          return (
            <div
              key={step.key}
              className={`px-4 py-4 ${step.done ? 'bg-emerald-950/[0.12]' : isCurrent ? 'bg-gold/[0.035]' : ''}`}
            >
              <div className="flex items-center gap-2 mb-1">
                {step.done ? (
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : isCurrent ? (
                  <div className="w-4 h-4 rounded-full border border-gold/50 bg-gold/10 flex-shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-cream/10 flex-shrink-0" />
                )}
                <span className={`text-xs font-medium leading-tight ${
                  step.done ? 'text-emerald-400/80' : isCurrent ? 'text-gold/80' : 'text-cream/25'
                }`}>
                  {step.label}
                </span>
              </div>

              {'date' in step && step.done && step.date && (
                <p className="text-[10px] text-cream/25 pl-6">{step.date}</p>
              )}
              {'sub' in step && step.sub && (
                <p className="text-[10px] text-cream/25 pl-6">{step.sub}</p>
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
          );
        })}
      </div>

      {!localFiled && !showFilingForm && !finalOutcome && (
        <div className="px-5 py-4 border-t border-gold/[0.06] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs text-cream/55">Filed the appeal?</p>
            <p className="text-[11px] text-cream/25 mt-0.5">Record the submission method and date to unlock decision tracking.</p>
          </div>
          <button
            onClick={() => setShowFilingForm(true)}
            className="text-xs font-medium text-gold hover:text-gold-light transition-colors"
          >
            Record Filing →
          </button>
        </div>
      )}

      {!localFiled && showFilingForm && (
        <div className="px-5 py-4 border-t border-gold/[0.08] space-y-3">
          <p className="text-xs text-cream/45">How was the appeal submitted?</p>
          {saveError && <p className="text-xs text-red-400">{saveError}</p>}
          <div className="flex flex-wrap gap-2">
            {(['online', 'email', 'mail', 'in_person'] as const).map((method) => (
              <button
                key={method}
                onClick={() => markFiled(method)}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gold/20 text-cream/50 hover:border-gold/40 hover:text-cream/80 transition-all disabled:opacity-40"
              >
                {saving ? 'Saving…' : METHOD_LABELS[method]}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setShowFilingForm(false);
              setSaveError('');
            }}
            className="text-[10px] text-cream/25 hover:text-cream/45 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {localFiled && !finalOutcome && daysSinceDelivery >= 30 && (
        <div className="px-5 py-4 border-t border-gold/[0.06] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs text-cream/55">
              {appealOutcome === 'pending' ? 'Has the authority issued a decision?' : 'How did the appeal go?'}
            </p>
            <p className="text-[11px] text-cream/25 mt-0.5">Keep the case record current and improve future evidence calibration.</p>
          </div>
          <a
            href={`/report/${reportId}`}
            className="text-xs font-medium text-gold hover:text-gold-light transition-colors"
          >
            {appealOutcome === 'pending' ? 'Update Decision →' : 'Share Result →'}
          </a>
        </div>
      )}

      {finalOutcome && appealOutcome === 'won' && (
        <div className="px-5 py-4 border-t border-emerald-500/10 bg-emerald-950/10">
          <p className="text-xs text-emerald-400/75 font-medium">
            Appeal won{outcomeReportedAt && ` · final result recorded ${fmt(outcomeReportedAt)}`}
          </p>
        </div>
      )}
    </div>
  );
}
