'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useWizard } from '@/components/intake/WizardLayout';
import Button from '@/components/ui/Button';
import {
  isIndependentValuationPurpose,
  markIndependentValuationPurpose,
  stripIndependentValuationMarker,
} from '@/lib/assignments/routing';
import type { ServiceType } from '@/types/database';

type WorkflowId = ServiceType | 'independent_valuation';

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
    title: 'Review a Property Assessment',
    subtitle: 'Tax appeal evidence',
    description:
      'Check whether the recorded assessment appears supportable, organize the strongest available evidence, and understand the next permitted filing step.',
    outcome:
      'Assessment analysis, comparable evidence, condition documentation, source index, limitations, and a jurisdiction-aware action checklist.',
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0-3 9a5 5 0 0 0 6 0L6 7l6-2m6 2 3-1m-3 1-3 9a5 5 0 0 0 6 0l-3-9-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
  },
  {
    id: 'pre_purchase',
    serviceType: 'pre_purchase',
    title: 'Evaluate a Property Before Buying',
    subtitle: 'Pre-purchase review',
    description:
      'Review available value evidence, assessment and tax context, property condition, and unresolved risks before the purchase becomes expensive to reverse.',
    outcome:
      'Supported value evidence, recorded tax context, due-diligence questions, material limitations, and decision risks.',
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m3 12 2-2m0 0 7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11 2 2m-2-2v10a1 1 0 0 1-1 1h-3m-6 0a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: 'pre_listing',
    serviceType: 'pre_listing',
    title: 'Prepare a Property for Listing',
    subtitle: 'Pre-listing review',
    description:
      'Build a supportable pricing and property-tax story, document relevant condition, and identify the facts buyers or agents are likely to question.',
    outcome:
      'Independent value evidence, assessment and tax context, condition documentation, and buyer-ready discussion points.',
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.6a1 1 0 0 1 .7.3l5.4 5.4a1 1 0 0 1 .3.7V19a2 2 0 0 1-2 2Z" />
      </svg>
    ),
  },
  {
    id: 'independent_valuation',
    serviceType: 'pre_listing',
    title: 'Build an Independent Value Workfile',
    subtitle: 'Purpose-specific analysis',
    description:
      'Organize neutral, source-labeled value evidence for an internal decision, estate discussion, insurance question, tax-basis review, or another defined purpose.',
    outcome:
      'Purpose-specific analysis with sources, assumptions, exhibits, limitations, and a regulated-professional referral path when required.',
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-3-3v6m7 4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3l1-2h6l1 2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2Z" />
      </svg>
    ),
  },
];

function selectedWorkflow(serviceType: ServiceType | null, desiredOutcome: string): WorkflowId | null {
  if (isIndependentValuationPurpose(desiredOutcome)) return 'independent_valuation';
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
    const cleanOutcome = stripIndependentValuationMarker(state.desiredOutcome);

    updateState({
      serviceType: option.serviceType,
      desiredOutcome:
        option.id === 'independent_valuation'
          ? markIndependentValuationPurpose(cleanOutcome)
          : cleanOutcome,
      reviewTier: option.id === 'tax_appeal' ? state.reviewTier : 'auto',
      priceCents: 0,
      clientSecret: null,
      reportId: null,
    });
  };

  const visibleOutcome = stripIndependentValuationMarker(state.desiredOutcome);

  const updateVisibleOutcome = (value: string) => {
    updateState({
      desiredOutcome:
        activeWorkflow === 'independent_valuation'
          ? markIndependentValuationPurpose(value)
          : value,
    });
  };

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-6 sm:py-12">
      <header className="mb-8 text-center animate-fade-in sm:mb-10">
        <span className="mb-3 inline-block text-[11px] font-semibold uppercase tracking-[0.2em] text-gold/70">
          Step 1 — Choose the decision
        </span>
        <h1 className="mb-3 font-display text-3xl text-cream md:text-4xl">
          What property question are you trying to answer?
        </h1>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed text-cream/55 sm:text-base">
          Start with the outcome. Resourceful then checks the property, available evidence, jurisdiction, required scope, and level of review before payment.
        </p>
      </header>

      <section className="mb-6 grid gap-3 rounded-2xl border border-gold/15 bg-navy-light/35 p-4 sm:grid-cols-3 sm:p-5" aria-label="Intake principles">
        {[
          ['Any U.S. address', 'The address can enter intake even when local coverage still needs verification.'],
          ['Scope before payment', 'Unsupported services or jurisdictions are disclosed, rescoped, or declined.'],
          ['Evidence stays traceable', 'Records, calculations, documents, and photos remain linked to their source.'],
        ].map(([label, copy]) => (
          <div key={label} className="rounded-xl border border-cream/[0.06] bg-navy-deep/35 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold/75">{label}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-cream/45">{copy}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-3 animate-slide-up md:grid-cols-2" aria-label="Property decisions">
        {SERVICE_OPTIONS.map((option) => {
          const isSelected = activeWorkflow === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelect(option)}
              aria-pressed={isSelected}
              className={`group h-full rounded-2xl border p-5 text-left transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gold/50 sm:p-6 ${
                isSelected
                  ? 'border-gold/55 bg-gradient-to-br from-gold/[0.1] to-gold/[0.035] shadow-lg shadow-gold/5 ring-1 ring-gold/20'
                  : 'border-gold/10 bg-navy-light/40 hover:border-gold/30 hover:bg-navy-light/60'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all ${
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
                        : 'border-cream/[0.07] bg-cream/[0.03] text-cream/35'
                    }`}>
                      {option.subtitle}
                    </span>
                  </div>
                  <p className={`text-sm leading-relaxed ${isSelected ? 'text-cream/65' : 'text-cream/45'}`}>
                    {option.description}
                  </p>
                  <div className="mt-4 border-t border-cream/[0.06] pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cream/35">Expected output</p>
                    <p className="mt-1 text-xs leading-relaxed text-cream/50">{option.outcome}</p>
                  </div>
                </div>
                <div className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                  isSelected
                    ? 'border-gold bg-gold shadow-[0_0_8px_rgba(212,168,71,0.4)]'
                    : 'border-cream/20 group-hover:border-cream/35'
                }`}>
                  {isSelected && (
                    <svg className="h-3 w-3 text-navy-deep" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="m5 13 4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </section>

      {activeWorkflow && (
        <section className="mt-7 animate-fade-in rounded-2xl border border-gold/10 bg-navy-light/30 p-5" aria-labelledby="decision-context-heading">
          <label id="decision-context-heading" htmlFor="desired-outcome" className="block text-sm font-medium text-cream/65">
            {activeWorkflow === 'tax_appeal'
              ? 'What changed, and why do you believe the assessment may be unsupported?'
              : activeWorkflow === 'independent_valuation'
                ? 'What is the analysis for, and what effective date or decision should it support?'
                : 'What decision are you trying to make?'}
            <span className="ml-1 text-cream/30">(optional)</span>
          </label>
          <textarea
            id="desired-outcome"
            value={visibleOutcome}
            onChange={(event) => updateVisibleOutcome(event.target.value)}
            placeholder={activeWorkflow === 'tax_appeal'
              ? 'Example: The assessment increased substantially, the record may overstate living area, and nearby similar properties appear lower.'
              : activeWorkflow === 'independent_valuation'
                ? 'Example: Internal estate-planning discussion using a July 1, 2026 effective date. A regulated appraisal may be needed later.'
                : 'Describe the property, timing, decision, concerns, and documents or photos already available.'}
            rows={4}
            className="mt-3 w-full resize-none rounded-xl border border-gold/15 bg-navy-deep/45 px-4 py-3 text-sm text-cream placeholder:text-cream/25 focus:border-gold/45 focus:outline-none focus:ring-1 focus:ring-gold/20"
          />
          <p className="mt-2 text-xs leading-relaxed text-cream/35">
            This context helps organize research. It is not treated as proof without supporting records, calculations, photographs, documents, or a clearly labeled assumption.
          </p>
        </section>
      )}

      <div className="mt-8">
        <Button
          size="lg"
          fullWidth
          disabled={!activeWorkflow}
          onClick={() => router.push('/start/property')}
        >
          Continue to property
          <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m17 8 4 4m0 0-4 4m4-4H3" />
          </svg>
        </Button>
        {!activeWorkflow && (
          <p className="mt-3 text-center text-xs text-cream/30">Choose a property decision to continue.</p>
        )}
      </div>
    </main>
  );
}
