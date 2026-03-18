'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWizard } from '@/components/intake/WizardLayout';
import AddressInput from '@/components/intake/AddressInput';
import PropertyDetails from '@/components/intake/PropertyDetails';
import PropertyTypeSelector from '@/components/intake/PropertyTypeSelector';
import Button from '@/components/ui/Button';

export default function PropertyPage() {
  const router = useRouter();
  const { state, updateState, setCurrentStep } = useWizard();

  useEffect(() => {
    setCurrentStep(2);
    if (!state.serviceType) router.push('/start');
  }, [setCurrentStep, state.serviceType, router]);

  // Trigger ATTOM lookup when address is selected
  const handleAddressSelect = useCallback(
    async (addr: { line1: string; city: string; state: string; zip: string; county: string }) => {
      // Update address immediately
      updateState({
        address: addr,
        propertyLookup: null,
        propertyLookupLoading: true,
        propertyLookupError: null,
        propertyType: null,
      });

      // Skip lookup if address is incomplete (manual fallback)
      if (!addr.city || !addr.state) {
        updateState({ propertyLookupLoading: false });
        return;
      }

      try {
        const response = await fetch('/api/property/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            line1: addr.line1,
            city: addr.city,
            state: addr.state,
          }),
        });

        if (!response.ok) {
          updateState({
            propertyLookupLoading: false,
            propertyLookupError: 'Could not find property data. You can still continue.',
          });
          return;
        }

        const data = await response.json();
        updateState({
          propertyLookup: data,
          propertyLookupLoading: false,
          propertyLookupError: null,
          // Auto-set property type from ATTOM
          propertyType: data.propertyType || null,
          // Backfill county from ATTOM if Google didn't provide it
          address: {
            ...addr,
            county: addr.county || data.countyName || '',
          },
        });
      } catch {
        updateState({
          propertyLookupLoading: false,
          propertyLookupError: 'Could not find property data. You can still continue.',
        });
      }
    },
    [updateState]
  );

  // Can continue if we have address + property type (auto or manual)
  const canContinue = state.address && state.propertyType;

  // Show manual selector if: lookup failed, no type detected, or address incomplete
  const showManualSelector =
    state.address &&
    !state.propertyLookupLoading &&
    (!state.propertyLookup || !state.propertyLookup.propertyType);

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

      <div className="space-y-8 animate-slide-up">
        {/* Address */}
        <section>
          <AddressInput
            onAddressSelect={handleAddressSelect}
          />
          {state.address && !state.propertyLookupLoading && !state.propertyLookup && !state.propertyLookupError && (
            <p className="mt-2 text-xs text-emerald-400/70 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {state.address.line1}, {state.address.city}, {state.address.state} {state.address.zip}
              {state.address.county ? ` — ${state.address.county} County` : ''}
            </p>
          )}
        </section>

        {/* Loading state */}
        {state.propertyLookupLoading && (
          <div className="card-premium rounded-xl border border-gold/20 p-8">
            <div className="flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-cream/50">Looking up property records...</span>
            </div>
          </div>
        )}

        {/* Auto-populated property details */}
        {state.propertyLookup && !state.propertyLookupLoading && (
          <PropertyDetails
            lookup={state.propertyLookup}
            selectedType={state.propertyType}
            onTypeOverride={(type) => updateState({ propertyType: type })}
          />
        )}

        {/* Error state — non-blocking */}
        {state.propertyLookupError && (
          <div className="rounded-lg border border-gold/10 bg-navy-light/50 p-4">
            <p className="text-sm text-cream/50">{state.propertyLookupError}</p>
          </div>
        )}

        {/* Manual property type selector — only shown as fallback */}
        {showManualSelector && (
          <section className="animate-fade-in">
            <PropertyTypeSelector
              selected={state.propertyType}
              onChange={(pt) => updateState({ propertyType: pt })}
            />
          </section>
        )}
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
          onClick={() => router.push('/start/payment')}
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
