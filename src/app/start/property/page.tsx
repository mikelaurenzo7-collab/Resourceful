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

        {/* Tax Bill Upload */}
        {state.address && state.propertyType && (
          <section className="animate-fade-in">
            <div className="card-premium rounded-xl p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display text-lg text-cream mb-1">
                    Have your tax bill handy?
                  </h3>
                  <p className="text-sm text-cream/50">
                    Enter a few details from your tax bill and get <span className="text-gold font-semibold">{discountPct}% off</span> your report.
                    It speeds up our analysis and gives us a head start on your case.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => handleTaxBillToggle(true)}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm border transition-all ${
                    showTaxBillForm
                      ? 'border-gold/60 bg-gold/10 text-gold'
                      : 'border-gold/10 text-cream/50 hover:border-gold/30'
                  }`}
                >
                  Yes, I have it
                </button>
                <button
                  type="button"
                  onClick={() => handleTaxBillToggle(false)}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm border transition-all ${
                    !showTaxBillForm
                      ? 'border-gold/60 bg-gold/10 text-gold'
                      : 'border-gold/10 text-cream/50 hover:border-gold/30'
                  }`}
                >
                  No, skip this
                </button>
              </div>

              {showTaxBillForm && (
                <div className="space-y-4 animate-fade-in pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-cream/60 mb-1.5">Assessed Value *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={assessedValue}
                        onChange={(e) => setAssessedValue(e.target.value)}
                        placeholder="$320,000"
                        className="w-full rounded-lg bg-navy-light border border-gold/15 px-4 py-3 text-cream placeholder-cream/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-cream/60 mb-1.5">
                        Annual Tax Amount <span className="text-cream/30">(optional)</span>
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={taxAmount}
                        onChange={(e) => setTaxAmount(e.target.value)}
                        placeholder="$4,200"
                        className="w-full rounded-lg bg-navy-light border border-gold/15 px-4 py-3 text-cream placeholder-cream/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-cream/60 mb-1.5">
                        Tax Year <span className="text-cream/30">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={taxYear}
                        onChange={(e) => setTaxYear(e.target.value)}
                        placeholder="2025"
                        className="w-full rounded-lg bg-navy-light border border-gold/15 px-4 py-3 text-cream placeholder-cream/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-cream/60 mb-1.5">
                        Parcel ID / PIN <span className="text-cream/30">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        placeholder="12-34-567-890"
                        className="w-full rounded-lg bg-navy-light border border-gold/15 px-4 py-3 text-cream placeholder-cream/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20"
                      />
                    </div>
                  </div>

                  {state.hasTaxBill && (
                    <div className="flex items-center gap-2 text-xs text-emerald-400/70 pt-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Tax bill data saved — {discountPct}% discount will be applied at checkout
                    </div>
                  )}
                </div>
              )}
            </div>
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
