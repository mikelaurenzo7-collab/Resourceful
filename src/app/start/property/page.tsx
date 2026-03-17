'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWizard } from '@/components/intake/WizardLayout';
import AddressInput from '@/components/intake/AddressInput';
import PropertyTypeSelector from '@/components/intake/PropertyTypeSelector';
import Button from '@/components/ui/Button';

export default function PropertyPage() {
  const router = useRouter();
  const { state, updateState, setCurrentStep } = useWizard();

  useEffect(() => {
    setCurrentStep(2);
    if (!state.serviceType) router.push('/start');
  }, [setCurrentStep, state.serviceType, router]);

  const canContinue = state.address && state.propertyType;

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <div className="text-center mb-10 animate-fade-in">
        <h1 className="font-display text-3xl text-cream mb-3">
          Your Property
        </h1>
        <p className="text-cream/50 max-w-lg mx-auto">
          Enter your property address and we&apos;ll pull public records, comparable sales, and assessment data automatically.
        </p>
      </div>

      <div className="space-y-10 animate-slide-up">
        {/* Address */}
        <section>
          <AddressInput
            onAddressSelect={(addr) => updateState({ address: addr })}
          />
          {state.address && (
            <p className="mt-2 text-xs text-emerald-400/70 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {state.address.line1}, {state.address.city}, {state.address.state} {state.address.zip}
              {state.address.county ? ` — ${state.address.county} County` : ''}
            </p>
          )}
        </section>

        {/* Property Type */}
        <section className={`transition-all duration-500 ${state.address ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <PropertyTypeSelector
            selected={state.propertyType}
            onChange={(pt) => updateState({ propertyType: pt })}
          />
        </section>
      </div>

      {/* Navigation */}
      <div className="flex gap-4 mt-10 pt-6 border-t border-gold/10">
        <Button variant="secondary" size="lg" onClick={() => router.push('/start')}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          Back
        </Button>
        <Button
          size="lg"
          fullWidth
          disabled={!canContinue}
          onClick={() => router.push('/start/situation')}
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
