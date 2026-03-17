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
    title: 'Lower My Property Taxes',
    subtitle: 'Tax Appeal Report',
    description:
      'We analyze your assessment, find comparable sales, and build a professional evidence package you can file to reduce your property taxes.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'pre_purchase',
    title: "I'm Buying a Property",
    subtitle: 'Pre-Purchase Analysis',
    description:
      "Get an independent market analysis before you buy. We'll compare the asking price against recent sales so you know if it's a fair deal.",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: 'pre_listing',
    title: "I'm Selling a Property",
    subtitle: 'Pre-Listing Report',
    description:
      "Know your property's true market value before you list. Our analysis helps you price it right and gives buyers confidence in your asking price.",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <h1 className="font-display text-3xl md:text-4xl text-cream mb-3">
          How can we help you?
        </h1>
        <p className="text-cream/50 max-w-lg mx-auto">
          Tell us what you&apos;re looking to accomplish and we&apos;ll guide you through the process.
        </p>
      </div>

      <div className="space-y-4 animate-slide-up">
        {SERVICE_OPTIONS.map((opt) => {
          const isSelected = state.serviceType === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              className={`w-full text-left rounded-xl p-6 transition-all duration-300 border ${
                isSelected
                  ? 'border-gold/60 bg-gold/10 shadow-lg shadow-gold/5'
                  : 'border-gold/10 bg-navy-light/50 hover:border-gold/30 hover:bg-navy-light'
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-gold/20 text-gold' : 'bg-gold/5 text-cream/40'
                  }`}
                >
                  {opt.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className={`font-display text-lg ${isSelected ? 'text-gold' : 'text-cream'}`}>
                      {opt.title}
                    </h3>
                    <span className="text-xs text-cream/30 bg-cream/5 rounded px-2 py-0.5">
                      {opt.subtitle}
                    </span>
                  </div>
                  <p className="text-sm text-cream/50 leading-relaxed">{opt.description}</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 flex items-center justify-center ${
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

      {/* Desired outcome — appears after selection */}
      {state.serviceType === 'tax_appeal' && (
        <div className="mt-8 animate-fade-in">
          <label className="block text-sm text-cream/60 mb-2">
            What outcome are you hoping for? <span className="text-cream/30">(optional)</span>
          </label>
          <textarea
            value={state.desiredOutcome}
            onChange={(e) => updateState({ desiredOutcome: e.target.value })}
            placeholder="e.g., My taxes went up 40% last year and I think my home is over-assessed compared to my neighbors..."
            rows={3}
            className="w-full rounded-lg bg-navy-light border border-gold/15 px-4 py-3 text-sm text-cream placeholder-cream/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 resize-none"
          />
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
          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Button>
      </div>
    </main>
  );
}
