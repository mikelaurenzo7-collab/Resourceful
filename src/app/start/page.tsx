'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWizard } from '@/components/intake/WizardLayout';
import Button from '@/components/ui/Button';
import type { ServiceType } from '@/types/database';

const SERVICE_OPTIONS: {
  id: ServiceType;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'tax_appeal',
    title: 'Reduce My Property Taxes',
    subtitle: 'Tax Reduction Engine',
    description:
      'Manus analyzes your assessment, builds the comparable set, and prepares the evidence package needed to pursue a reduction.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'pre_purchase',
    title: "I'm Buying a Property",
    subtitle: 'Acquisition Intelligence',
    description:
      "Before you buy, Manus tests price, taxes, and downside risk so you know whether the deal is actually worth pursuing.",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: 'pre_listing',
    title: "I'm Selling a Property",
    subtitle: 'Seller Strategy Intelligence',
    description:
      "Before you list, Manus sharpens your pricing story and gives buyers a clearer view of the tax burden attached to the property.",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

export default function GoalsPage() {
  const router = useRouter();
  const { state, updateState, setCurrentStep } = useWizard();

  useEffect(() => {
    setCurrentStep(1);
  }, [setCurrentStep]);

  const handleSelect = (id: ServiceType) => {
    updateState({ serviceType: id });
  };

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <div className="text-center mb-10 animate-fade-in">
        <span className="inline-block text-[11px] font-semibold tracking-[0.2em] text-gold/70 uppercase mb-3">
          Step 1 — Activate Manus
        </span>
        <h1 className="font-display text-3xl md:text-4xl text-cream mb-3">
          What should Manus run?
        </h1>
        <p className="text-cream/50 max-w-lg mx-auto">
          Select the workflow you want Manus to operate and we&apos;ll tailor the system to your property, county, and objective.
        </p>
      </div>

      <div className="space-y-3 animate-slide-up">
        {SERVICE_OPTIONS.map((opt) => {
          const isSelected = state.serviceType === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              className={`w-full text-left rounded-xl p-6 transition-all duration-300 border group ${
                isSelected
                  ? 'border-gold/50 bg-gradient-to-br from-gold/[0.08] to-gold/[0.04] shadow-lg shadow-gold/5 ring-1 ring-gold/20'
                  : 'border-gold/10 bg-navy-light/40 hover:border-gold/25 hover:bg-navy-light/60'
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                    isSelected
                      ? 'bg-gold/20 text-gold shadow-[0_0_20px_rgba(212,168,71,0.15)]'
                      : 'bg-gold/5 text-cream/35 group-hover:bg-gold/10 group-hover:text-cream/60'
                  }`}
                >
                  {opt.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5">
                    <h3 className={`font-display text-lg leading-tight ${isSelected ? 'text-gold' : 'text-cream'}`}>
                      {opt.title}
                    </h3>
                    <span className={`text-xs rounded-full px-2.5 py-0.5 border transition-colors ${
                      isSelected
                        ? 'text-gold/70 bg-gold/10 border-gold/20'
                        : 'text-cream/25 bg-cream/[0.03] border-cream/[0.06]'
                    }`}>
                      {opt.subtitle}
                    </span>
                  </div>
                  <p className={`text-sm leading-relaxed ${isSelected ? 'text-cream/60' : 'text-cream/45'}`}>
                    {opt.description}
                  </p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 flex items-center justify-center transition-all duration-300 ${
                    isSelected
                      ? 'border-gold bg-gold shadow-[0_0_8px_rgba(212,168,71,0.4)]'
                      : 'border-cream/20 group-hover:border-cream/35'
                  }`}
                >
                  {isSelected && (
                    <svg className="w-3 h-3 text-navy-deep" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Desired outcome — appears after selection */}
      {state.serviceType === 'tax_appeal' && (
        <div className="mt-8 animate-fade-in">
          <label className="block text-sm text-cream/60 mb-2">
            Tell Manus about your situation <span className="text-cream/30">(optional)</span>
          </label>
          <textarea
            value={state.desiredOutcome}
            onChange={(e) => updateState({ desiredOutcome: e.target.value })}
            placeholder="e.g., My taxes jumped 40% last year and I believe my home is over-assessed compared with similar properties nearby..."
            rows={3}
            className="w-full rounded-lg bg-navy-light border border-gold/15 px-4 py-3 text-sm text-cream placeholder-cream/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 resize-none"
          />
          <p className="text-xs text-cream/25 mt-1.5">This helps Manus prioritize the case and identify the strongest angle for action.</p>
        </div>
      )}

      <div className="mt-8">
        <Button
          size="lg"
          fullWidth
          disabled={!state.serviceType}
          onClick={() => router.push('/start/property')}
        >
          Continue
          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Button>
        {!state.serviceType && (
          <p className="text-center text-xs text-cream/25 mt-3">Select a workflow above to continue</p>
        )}
      </div>
    </main>
  );
}
