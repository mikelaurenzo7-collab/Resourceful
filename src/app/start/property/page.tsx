'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWizard } from '@/components/intake/WizardLayout';
import AddressInput from '@/components/intake/AddressInput';
import PropertyTypeSelector from '@/components/intake/PropertyTypeSelector';
import { TAX_BILL_DISCOUNT } from '@/config/pricing';
import Button from '@/components/ui/Button';

type JurisdictionState =
  | { status: 'not_required' | 'idle' | 'checking' }
  | {
      status: 'verified';
      message: string;
      county: string;
      filingAuthority: string;
      filingDeadline: string;
      verifiedDate: string;
    }
  | {
      status: 'blocked';
      code: string;
      message: string;
      retryable: boolean;
    };

interface JurisdictionResponse {
  allowed?: boolean;
  code?: string;
  message?: string;
  retryable?: boolean;
  jurisdiction?: {
    county?: string;
    filingAuthority?: string;
    filingDeadline?: string;
    ruleLastVerifiedDate?: string;
  } | null;
}

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
  const [attempted, setAttempted] = useState(false);
  const [screenRetry, setScreenRetry] = useState(0);
  const [jurisdiction, setJurisdiction] = useState<JurisdictionState>(
    state.serviceType === 'tax_appeal' ? { status: 'idle' } : { status: 'not_required' }
  );

  useEffect(() => {
    setCurrentStep(2);
    if (!state.serviceType) router.push('/start');
  }, [setCurrentStep, state.serviceType, router]);

  const addressKey = useMemo(() => {
    if (!state.address) return '';
    return [
      state.address.line1,
      state.address.city,
      state.address.state,
      state.address.zip,
      state.address.county,
    ].join('|');
  }, [state.address]);

  useEffect(() => {
    if (state.serviceType !== 'tax_appeal') {
      setJurisdiction({ status: 'not_required' });
      return;
    }

    if (!state.address || !addressKey) {
      setJurisdiction({ status: 'idle' });
      return;
    }

    const controller = new AbortController();
    setJurisdiction({ status: 'checking' });

    void fetch('/api/jurisdiction-screen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        service_type: state.serviceType,
        property_address: state.address.line1,
        city: state.address.city,
        state: state.address.state,
        zip: state.address.zip,
        county: state.address.county,
      }),
    })
      .then(async (response) => {
        const result = await response.json().catch(() => ({})) as JurisdictionResponse;
        if (controller.signal.aborted) return;

        if (
          response.ok &&
          result.allowed &&
          result.jurisdiction?.county &&
          result.jurisdiction.filingAuthority &&
          result.jurisdiction.filingDeadline &&
          result.jurisdiction.ruleLastVerifiedDate
        ) {
          setJurisdiction({
            status: 'verified',
            message: result.message ?? 'Jurisdiction verified.',
            county: result.jurisdiction.county,
            filingAuthority: result.jurisdiction.filingAuthority,
            filingDeadline: result.jurisdiction.filingDeadline,
            verifiedDate: result.jurisdiction.ruleLastVerifiedDate,
          });
          return;
        }

        setJurisdiction({
          status: 'blocked',
          code: result.code ?? 'JURISDICTION_UNAVAILABLE',
          message:
            result.message ??
            'Resourceful could not verify this county’s current filing requirements. No payment will be collected.',
          retryable: result.retryable ?? response.status >= 500,
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setJurisdiction({
          status: 'blocked',
          code: 'JURISDICTION_UNAVAILABLE',
          message:
            error instanceof Error && error.name !== 'AbortError'
              ? 'Resourceful could not verify the jurisdiction right now. No payment will be collected. Please try again.'
              : 'Jurisdiction verification was interrupted.',
          retryable: true,
        });
      });

    return () => controller.abort();
  }, [addressKey, screenRetry, state.address, state.serviceType]);

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

  useEffect(() => {
    if (showTaxBillForm) {
      const av = parseFloat(assessedValue.replace(/[^0-9.]/g, ''));
      if (av > 0) {
        const timer = setTimeout(() => handleTaxBillSave(), 500);
        return () => clearTimeout(timer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessedValue, taxAmount, taxYear, pin, showTaxBillForm]);

  const jurisdictionReady =
    state.serviceType !== 'tax_appeal' || jurisdiction.status === 'verified';
  const canContinue = Boolean(state.address && state.propertyType && jurisdictionReady);

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <div className="text-center mb-10 animate-fade-in">
        <span className="inline-block text-[11px] font-semibold tracking-[0.2em] text-gold/70 uppercase mb-3">
          Step 2 — Your Property
        </span>
        <h1 className="font-display text-3xl text-cream mb-3">
          Tell Us About Your Property
        </h1>
        <p className="text-cream/50 max-w-lg mx-auto">
          Enter your address and we&apos;ll verify the jurisdiction before any payment, then pull the available property, assessment, and market evidence.
        </p>
      </div>

      <div className="space-y-10 animate-slide-up">
        <section>
          <AddressInput
            initialAddress={state.address}
            onAddressSelect={(address) => {
              setAttempted(false);
              updateState({ address });
            }}
          />
          {attempted && !state.address && (
            <p role="alert" className="mt-2 text-sm text-red-400">Please select an address to continue.</p>
          )}
          {state.address && (
            <div className="mt-3 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20 px-4 py-2.5 flex items-center gap-2.5 animate-fade-in">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-emerald-400/80">
                {state.address.line1}, {state.address.city}, {state.address.state} {state.address.zip}
                {state.address.county ? <span className="text-emerald-400/50"> — {state.address.county} County</span> : ''}
              </p>
            </div>
          )}

          {state.serviceType === 'tax_appeal' && state.address && (
            <div className="mt-3" aria-live="polite">
              {jurisdiction.status === 'checking' && (
                <div className="rounded-lg border border-gold/15 bg-gold/[0.035] px-4 py-3">
                  <p className="text-sm text-gold/75">Verifying county filing rules…</p>
                  <p className="mt-1 text-xs text-cream/35">Checkout remains locked until the jurisdiction contract is confirmed.</p>
                </div>
              )}

              {jurisdiction.status === 'verified' && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-3">
                  <p className="text-sm font-medium text-emerald-300">{jurisdiction.county} County verified</p>
                  <p className="mt-1 text-xs leading-relaxed text-cream/50">
                    Filing authority: {jurisdiction.filingAuthority}. Current deadline or rule: {jurisdiction.filingDeadline}
                  </p>
                  <p className="mt-1 text-[10px] text-cream/30">Rules last verified {jurisdiction.verifiedDate}.</p>
                </div>
              )}

              {jurisdiction.status === 'blocked' && (
                <div role="alert" className="rounded-lg border border-amber-500/25 bg-amber-500/[0.055] px-4 py-3">
                  <p className="text-sm font-medium text-amber-200">Eligibility review required</p>
                  <p className="mt-1 text-xs leading-relaxed text-cream/55">{jurisdiction.message}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {jurisdiction.retryable && (
                      <button
                        type="button"
                        onClick={() => setScreenRetry((value) => value + 1)}
                        className="text-xs font-medium text-gold hover:text-gold-light"
                      >
                        Verify again
                      </button>
                    )}
                    <a href="mailto:support@resourceful.app" className="text-xs text-cream/45 underline hover:text-cream/70">
                      Request manual review
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className={`transition-all duration-500 ${state.address ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <PropertyTypeSelector
            selected={state.propertyType}
            onChange={(propertyType) => updateState({ propertyType })}
          />
          {attempted && !state.propertyType && state.address && (
            <p role="alert" className="mt-2 text-sm text-red-400">Please select a property type.</p>
          )}
        </section>

        {state.address && state.propertyType && (
          <section className="animate-fade-in">
            <div className="card-premium rounded-xl p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
                      <label htmlFor="assessed-value" className="block text-sm text-cream/60 mb-1.5">Assessed Value *</label>
                      <input
                        id="assessed-value"
                        type="text"
                        inputMode="numeric"
                        value={assessedValue}
                        onChange={(event) => setAssessedValue(event.target.value)}
                        placeholder="$320,000"
                        className="w-full rounded-lg bg-navy-light border border-gold/15 px-4 py-3 text-cream placeholder-cream/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20"
                      />
                    </div>
                    <div>
                      <label htmlFor="annual-tax" className="block text-sm text-cream/60 mb-1.5">
                        Annual Tax Amount <span className="text-cream/30">(optional)</span>
                      </label>
                      <input
                        id="annual-tax"
                        type="text"
                        inputMode="numeric"
                        value={taxAmount}
                        onChange={(event) => setTaxAmount(event.target.value)}
                        placeholder="$4,200"
                        className="w-full rounded-lg bg-navy-light border border-gold/15 px-4 py-3 text-cream placeholder-cream/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="tax-year" className="block text-sm text-cream/60 mb-1.5">
                        Tax Year <span className="text-cream/30">(optional)</span>
                      </label>
                      <input
                        id="tax-year"
                        type="text"
                        value={taxYear}
                        onChange={(event) => setTaxYear(event.target.value)}
                        placeholder="2025"
                        className="w-full rounded-lg bg-navy-light border border-gold/15 px-4 py-3 text-cream placeholder-cream/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20"
                      />
                    </div>
                    <div>
                      <label htmlFor="parcel-pin" className="block text-sm text-cream/60 mb-1.5">
                        Parcel ID / PIN <span className="text-cream/30">(optional)</span>
                      </label>
                      <input
                        id="parcel-pin"
                        type="text"
                        value={pin}
                        onChange={(event) => setPin(event.target.value)}
                        placeholder="12-34-567-890"
                        className="w-full rounded-lg bg-navy-light border border-gold/15 px-4 py-3 text-cream placeholder-cream/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20"
                      />
                    </div>
                  </div>

                  {state.hasTaxBill && (
                    <div className="flex items-center gap-2 text-xs text-emerald-400/70 pt-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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

      <div className="flex gap-4 mt-10 pt-2">
        <Button variant="secondary" size="lg" onClick={() => router.push('/start')}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          Back
        </Button>
        <Button
          size="lg"
          fullWidth
          disabled={!canContinue}
          onClick={() => {
            if (!canContinue) {
              setAttempted(true);
              return;
            }
            router.push('/start/situation');
          }}
        >
          {state.serviceType === 'tax_appeal' && jurisdiction.status === 'checking'
            ? 'Verifying Jurisdiction…'
            : 'Continue'}
          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Button>
      </div>

      {attempted && state.serviceType === 'tax_appeal' && state.address && jurisdiction.status !== 'verified' && (
        <p role="alert" className="mt-3 text-center text-sm text-amber-300">
          Resourceful must verify this county’s current appeal requirements before you can continue.
        </p>
      )}
    </main>
  );
}
