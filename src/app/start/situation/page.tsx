'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWizard, PROPERTY_ISSUES } from '@/components/intake/WizardLayout';
import Button from '@/components/ui/Button';

export default function SituationPage() {
  const router = useRouter();
  const { state, updateState, setCurrentStep } = useWizard();

  useEffect(() => {
    setCurrentStep(3);
    if (!state.address) router.push('/start/property');
  }, [setCurrentStep, state.address, router]);

  const toggleIssue = (id: string) => {
    const current = state.propertyIssues;
    if (current.includes(id)) {
      updateState({ propertyIssues: current.filter((i) => i !== id) });
    } else {
      updateState({ propertyIssues: [...current, id] });
    }
  };

  const isTaxAppeal = state.serviceType === 'tax_appeal';

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <div className="text-center mb-10 animate-fade-in">
        <h1 className="font-display text-3xl text-cream mb-3">
          {isTaxAppeal ? 'Tell Us About Your Property' : 'Property Condition'}
        </h1>
        <p className="text-cream/50 max-w-lg mx-auto">
          {isTaxAppeal
            ? "Select any issues affecting your property. These strengthen your appeal by documenting conditions that reduce your property's value below the assessed amount."
            : 'Select any known issues so we can factor them into our analysis.'}
        </p>
      </div>

      {/* Context questions for tax appeals */}
      {isTaxAppeal && (
        <div className="space-y-6 mb-10 animate-slide-up">
          {/* Owner occupied */}
          <div className="card-premium rounded-xl p-5" role="radiogroup" aria-label="Do you live in this property?">
            <p className="text-sm text-cream mb-3" id="owner-occupied-label">Do you live in this property?</p>
            <div className="flex gap-3" aria-labelledby="owner-occupied-label">
              {[
                { value: true, label: 'Yes, owner-occupied' },
                { value: false, label: 'No, investment / rental' },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  role="radio"
                  aria-checked={state.ownerOccupied === opt.value}
                  onClick={() => updateState({ ownerOccupied: opt.value })}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm border transition-all ${
                    state.ownerOccupied === opt.value
                      ? 'border-gold/60 bg-gold/10 text-gold'
                      : 'border-gold/10 text-cream/50 hover:border-gold/30'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Years owned */}
          <div className="card-premium rounded-xl p-5" role="radiogroup" aria-label="How long have you owned the property?">
            <p className="text-sm text-cream mb-3" id="years-owned-label">How long have you owned the property?</p>
            <div className="flex gap-3 flex-wrap" aria-labelledby="years-owned-label">
              {['Less than 1 year', '1-3 years', '3-5 years', '5-10 years', '10+ years'].map((period) => (
                <button
                  key={period}
                  role="radio"
                  aria-checked={state.yearsOwned === period}
                  onClick={() => updateState({ yearsOwned: period })}
                  className={`rounded-lg px-4 py-2.5 text-sm border transition-all ${
                    state.yearsOwned === period
                      ? 'border-gold/60 bg-gold/10 text-gold'
                      : 'border-gold/10 text-cream/50 hover:border-gold/30'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          {/* Previous appeal */}
          <div className="card-premium rounded-xl p-5" role="radiogroup" aria-label="Have you appealed your property taxes before?">
            <p className="text-sm text-cream mb-3" id="previous-appeal-label">Have you appealed your property taxes before?</p>
            <div className="flex gap-3" aria-labelledby="previous-appeal-label">
              {[
                { value: true, label: 'Yes' },
                { value: false, label: 'No, this is my first time' },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  role="radio"
                  aria-checked={state.previousAppeal === opt.value}
                  onClick={() => updateState({ previousAppeal: opt.value })}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm border transition-all ${
                    state.previousAppeal === opt.value
                      ? 'border-gold/60 bg-gold/10 text-gold'
                      : 'border-gold/10 text-cream/50 hover:border-gold/30'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Property issues grid */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-cream/70 mb-1">
          {isTaxAppeal
            ? 'What issues does your property have?'
            : 'Any known issues?'}
        </h2>
        <p className="text-xs text-cream/40 mb-4">
          Select all that apply. Each issue you document strengthens your report.
          {isTaxAppeal && " We'll show you exactly what to photograph in the next step."}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-slide-up">
        {PROPERTY_ISSUES.map((issue) => {
          const isSelected = state.propertyIssues.includes(issue.id);
          return (
            <button
              key={issue.id}
              onClick={() => toggleIssue(issue.id)}
              className={`text-left rounded-xl p-4 border transition-all duration-200 ${
                isSelected
                  ? 'border-gold/50 bg-gold/10'
                  : 'border-gold/10 bg-navy-light/30 hover:border-gold/25'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg">{issue.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isSelected ? 'text-gold' : 'text-cream'}`}>
                    {issue.label}
                  </p>
                  <p className="text-xs text-cream/40 mt-0.5 leading-relaxed">{issue.description}</p>
                </div>
                <div
                  className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                    isSelected ? 'border-gold bg-gold' : 'border-cream/20'
                  }`}
                >
                  {isSelected && (
                    <svg className="w-3 h-3 text-navy-deep" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Additional notes */}
      <div className="mt-8">
        <label className="block text-sm text-cream/60 mb-2">
          Anything else we should know? <span className="text-cream/30">(optional)</span>
        </label>
        <textarea
          value={state.additionalNotes}
          onChange={(e) => updateState({ additionalNotes: e.target.value })}
          placeholder={
            isTaxAppeal
              ? 'e.g., My neighbor with a similar house sold for $50k less than my assessed value. The assessor never came inside...'
              : 'e.g., The roof was replaced in 2020. The basement floods during heavy rain...'
          }
          rows={3}
          className="w-full rounded-lg bg-navy-light border border-gold/15 px-4 py-3 text-sm text-cream placeholder-cream/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 resize-none"
        />
      </div>

      {/* Selected issues summary */}
      {state.propertyIssues.length > 0 && (
        <div className="mt-6 rounded-xl border border-gold/15 bg-gold/5 p-4">
          <p className="text-xs text-gold/70 mb-2">
            {state.propertyIssues.length} issue{state.propertyIssues.length !== 1 ? 's' : ''} selected
            {isTaxAppeal && ' — these will be documented in your appeal report'}
          </p>
          <div className="flex flex-wrap gap-2">
            {state.propertyIssues.map((id) => {
              const issue = PROPERTY_ISSUES.find((i) => i.id === id);
              return issue ? (
                <span key={id} className="text-xs bg-gold/10 text-cream/70 rounded-full px-3 py-1 border border-gold/20">
                  {issue.icon} {issue.label}
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-4 mt-10 pt-6 border-t border-gold/10">
        <Button variant="secondary" size="lg" onClick={() => router.push('/start/property')}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          Back
        </Button>
        <Button size="lg" fullWidth onClick={() => router.push('/start/photos')}>
          Continue to Photos
          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Button>
      </div>
    </main>
  );
}
