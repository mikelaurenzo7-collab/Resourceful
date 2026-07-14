'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWizard } from '@/components/intake/WizardLayout';
import Button from '@/components/ui/Button';
import type { ServiceType } from '@/types/database';

type WorkflowId = ServiceType | 'independent_valuation';

const INDEPENDENT_VALUATION_MARKER = '[INDEPENDENT_VALUATION]';

const SERVICE_OPTIONS: {
  id: WorkflowId;
  serviceType: ServiceType;
  title: string;
  subtitle: string;
  description: string;
  outcome: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'tax_appeal',
    serviceType: 'tax_appeal',
    title: 'Lower My Property Taxes',
    subtitle: 'Appeal & Filing',
    description:
      'Audit the assessment, build the strongest supportable case, document condition, and route the appeal through the filing method allowed in that jurisdiction.',
    outcome: 'Appeal package, filing plan, hearing preparation, and proof-of-submission workflow.',
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'pre_purchase',
    serviceType: 'pre_purchase',
    title: "I'm Buying a Property",
    subtitle: 'Buyer Intelligence',
    description:
      'Test the asking price, future tax exposure, condition risk, comparable support, and the downside case before committing capital.',
    outcome: 'Supported value range, due-diligence plan, negotiation framework, and walk-away analysis.',
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: 'pre_listing',
    serviceType: 'pre_listing',
    title: "I'm Selling or Improving a Property",
    subtitle: 'Seller Strategy',
    description:
      'Establish a credible value story, identify the improvements most likely to matter, and prepare evidence buyers and agents can understand.',
    outcome: 'Pricing support, improvement priorities, tax-positioning, and buyer-facing property intelligence.',
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: 'independent_valuation',
    serviceType: 'pre_listing',
    title: 'I Need an Independent Value Analysis',
    subtitle: 'Purpose-Specific Valuation',
    description:
      'Build a neutral, evidence-rich valuation workfile for estate planning, divorce, insurance, tax basis, internal decisions, litigation support, or another defined use.',
    outcome: 'Purpose-specific value analysis with source ledger, assumptions, exhibits, and a licensed-appraiser upgrade path when required.',
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-3-3v6m7 4H5a2 2 0 01-2-2V7a2 2 0 012-2h3l1-2h6l1 2h3a2 2 0 012 2v10a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

function selectedWorkflow(serviceType: ServiceType | null, desiredOutcome: string): WorkflowId | null {
  if (serviceType === 'pre_listing' && desiredOutcome.startsWith(INDEPENDENT_VALUATION_MARKER)) {
    return 'independent_valuation';
  }
  return serviceType;
}

export default function GoalsPage() {
  const router = useRouter();
  const { state, updateState, setCurrentStep } = useWizard();

  useEffect(() => {
    setCurrentStep(1);
  }, [setCurrentStep]);

  const activeWorkflow = selectedWorkflow(state.serviceType, state.desiredOutcome);

  const handleSelect = (option: (typeof SERVICE_OPTIONS)[number]) => {
    const wasIndependent = state.desiredOutcome.startsWith(INDEPENDENT_VALUATION_MARKER);
    const cleanOutcome = wasIndependent
      ? state.desiredOutcome.slice(INDEPENDENT_VALUATION_MARKER.length).trim()
      : state.desiredOutcome;

    updateState({
      serviceType: option.serviceType,
      desiredOutcome: option.id === 'independent_valuation'
        ? `${INDEPENDENT_VALUATION_MARKER} ${cleanOutcome}`.trim()
        : cleanOutcome,
      reviewTier: option.id === 'tax_appeal' ? state.reviewTier : 'auto',
    });
  };

  const visibleOutcome = state.desiredOutcome.startsWith(INDEPENDENT_VALUATION_MARKER)
    ? state.desiredOutcome.slice(INDEPENDENT_VALUATION_MARKER.length).trim()
    : state.desiredOutcome;

  const updateVisibleOutcome = (value: string) => {
    updateState({
      desiredOutcome: activeWorkflow === 'independent_valuation'
        ? `${INDEPENDENT_VALUATION_MARKER} ${value}`.trim()
        : value,
    });
  };

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-6 sm:py-12">
      <div className="mb-8 text-center animate-fade-in sm:mb-10">
        <span className="mb-3 inline-block text-[11px] font-semibold uppercase tracking-[0.2em] text-gold/70">
          Step 1 — Choose the Outcome
        </span>
        <h1 className="mb-3 font-display text-3xl text-cream md:text-4xl">
          What do you need to accomplish?
        </h1>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed text-cream/55 sm:text-base">
          Resourceful starts with the property and your objective, then verifies the available records,
          jurisdiction rules, filing path, evidence requirements, and level of human review.
        </p>
      </div>

      <div className="mb-6 grid gap-3 rounded-2xl border border-gold/15 bg-navy-light/35 p-4 sm:grid-cols-3 sm:p-5">
        {[
          ['Nationwide intake', 'Any U.S. address can enter the system.'],
          ['Jurisdiction-aware', 'The available appeal or appraisal route is verified after address resolution.'],
          ['Evidence-led', 'Records, comparable data, documents, and user photos stay traceable in the workfile.'],
        ].map(([label, copy]) => (
          <div key={label} className="rounded-xl border border-cream/[0.06] bg-navy-deep/35 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold/75">{label}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-cream/45">{copy}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 animate-slide-up md:grid-cols-2">
        {SERVICE_OPTIONS.map((option) => {
          const isSelected = activeWorkflow === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelect(option)}
              aria-pressed={isSelected}
              className={`group h-full rounded-2xl border p-5 text-left transition-all duration-300 sm:p-6 ${
                isSelected
                  ? 'border-gold/55 bg-gradient-to-br from-gold/[0.1] to-gold/[0.035] shadow-lg shadow-gold/5 ring-1 ring-gold/20'
                  : 'border-gold/10 bg-navy-light/40 hover:border-gold/30 hover:bg-navy-light/60'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl transition-all ${
                  isSelected
                    ? 'bg-gold/20 text-gold shadow-[0_0_20px_rgba(212,168,71,0.15)]'
                    : 'bg-gold/5 text-cream/35 group-hover:bg-gold/10 group-hover:text-cream/60'
                }`}>
                  {option.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h2 className={`font-display text-lg leading-tight ${isSelected ? 'text-gold' : 'text-cream'}`}>
                      {option.title}
                    </h2>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                      isSelected
                        ? 'border-gold/20 bg-gold/10 text-gold/75'
                        : 'border-cream/[0.07] bg-cream/[0.03] text-cream/30'
                    }`}>
                      {option.subtitle}
                    </span>
                  </div>
                  <p className={`text-sm leading-relaxed ${isSelected ? 'text-cream/65' : 'text-cream/45'}`}>
                    {option.description}
                  </p>
                  <div className="mt-4 border-t border-cream/[0.06] pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cream/30">Primary output</p>
                    <p className="mt-1 text-xs leading-relaxed text-cream/45">{option.outcome}</p>
                  </div>
                </div>
                <div className={`mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                  isSelected
                    ? 'border-gold bg-gold shadow-[0_0_8px_rgba(212,168,71,0.4)]'
                    : 'border-cream/20 group-hover:border-cream/35'
                }`}>
                  {isSelected && (
                    <svg className="h-3 w-3 text-navy-deep" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {activeWorkflow && (
        <div className="mt-7 animate-fade-in rounded-2xl border border-gold/10 bg-navy-light/30 p-5">
          <label htmlFor="desired-outcome" className="block text-sm font-medium text-cream/65">
            {activeWorkflow === 'tax_appeal'
              ? 'What changed, and why do you believe the assessment is wrong?'
              : activeWorkflow === 'independent_valuation'
                ? 'What is the valuation for, and what effective date or decision will it support?'
                : 'What decision are you trying to make?'}
            <span className="ml-1 text-cream/30">(optional)</span>
          </label>
          <textarea
            id="desired-outcome"
            value={visibleOutcome}
            onChange={(event) => updateVisibleOutcome(event.target.value)}
            placeholder={activeWorkflow === 'tax_appeal'
              ? 'Example: My assessment increased 40%, the assessor record overstates living area, and nearby comparable properties are assessed lower.'
              : activeWorkflow === 'independent_valuation'
                ? 'Example: Estate planning value as of July 1, 2026, with a licensed-appraiser review option if the analysis will be submitted to a court or agency.'
                : 'Describe the property, timing, target decision, concerns, and any documents or photos you already have.'}
            rows={4}
            className="mt-3 w-full resize-none rounded-xl border border-gold/15 bg-navy-deep/45 px-4 py-3 text-sm text-cream placeholder:text-cream/25 focus:border-gold/45 focus:outline-none focus:ring-1 focus:ring-gold/20"
          />
          <p className="mt-2 text-xs leading-relaxed text-cream/30">
            GPT-5.6 Sol will use this as context, not as proof. Every material conclusion must still be supported by records, calculations, photos, documents, or clearly labeled assumptions.
          </p>
        </div>
      )}

      <div className="mt-8">
        <Button
          size="lg"
          fullWidth
          disabled={!activeWorkflow}
          onClick={() => router.push('/start/property')}
        >
          Continue to property verification
          <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Button>
        {!activeWorkflow && (
          <p className="mt-3 text-center text-xs text-cream/25">Choose an outcome above to continue.</p>
        )}
      </div>
    </main>
  );
}
