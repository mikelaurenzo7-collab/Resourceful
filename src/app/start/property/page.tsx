'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWizard } from '@/components/intake/WizardLayout';
import AddressInput from '@/components/intake/AddressInput';
import PropertyTypeSelector from '@/components/intake/PropertyTypeSelector';
import { TAX_BILL_DISCOUNT } from '@/config/pricing';
import Button from '@/components/ui/Button';

export default function PropertyPage() {
  const router = useRouter();
  const { state, updateState, setCurrentStep } = useWizard();
  const [showTaxBillForm, setShowTaxBillForm] = useState(state.hasTaxBill);
  const [assessedValue, setAssessedValue] = useState(
    state.taxBillData?.assessedValue?.toString() ?? ''
  );
  const [taxAmount, setTaxAmount] = useState(
    state.taxBillData?.taxAmount?.toString() ?? ''
  );
  const [taxYear, setTaxYear] = useState(
    state.taxBillData?.taxYear ?? ''
  );
  const [pin, setPin] = useState(
    state.taxBillData?.pin ?? ''
  );

  useEffect(() => {
    setCurrentStep(2);
    if (!state.serviceType) router.push('/start');
  }, [setCurrentStep, state.serviceType, router]);

  const discountPct = Math.round(TAX_BILL_DISCOUNT * 100);

  const handleTaxBillToggle = (has: boolean) => {
    setShowTaxBillForm(has);
    if (!has) {
      updateState({ hasTaxBill: false, taxBillData: null });
      setAssessedValue('');
      setTaxAmount('');
      setTaxYear('');
      setPin('');
    }
  };

  const handleTaxBillSave = () => {
    const av = parseFloat(assessedValue.replace(/[^0-9.]/g, ''));
    const ta = parseFloat(taxAmount.replace(/[^0-9.]/g, ''));
    if (!av || av <= 0) return;
    updateState({
      hasTaxBill: true,
      taxBillData: {
        assessedValue: av,
        taxAmount: ta > 0 ? ta : null,
        taxYear: taxYear || null,
        pin: pin || null,
      },
    });
  };

  // Auto-save tax bill data when fields change
  useEffect(() => {
    if (showTaxBillForm) {
      const av = parseFloat(assessedValue.replace(/[^0-9.]/g, ''));
      if (av > 0) handleTaxBillSave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessedValue, taxAmount, taxYear, pin, showTaxBillForm]);

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

        {/* Tax bill collection moved post-payment — trust first, enhance later */}
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
