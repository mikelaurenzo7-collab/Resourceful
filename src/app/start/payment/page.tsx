'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useWizard, PROPERTY_ISSUES } from '@/components/intake/WizardLayout';
import { formatPrice, getPriceCents, TAX_BILL_DISCOUNT } from '@/config/pricing';
import type { ReviewTier } from '@/types/database';
import Button from '@/components/ui/Button';

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

const SERVICE_LABELS: Record<string, string> = {
  tax_appeal: 'Tax Appeal Report',
  pre_purchase: 'Pre-Purchase Analysis',
  pre_listing: 'Pre-Listing Report',
};

// ─── Checkout Form ──────────────────────────────────────────────────────────

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { state } = useWizard();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError('');

    try {
      const { error: paymentError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/start/success?reportId=${state.reportId}`,
        },
        redirect: 'if_required',
      });

      if (paymentError) {
        setError(paymentError.message || 'Payment failed. Please try again.');
        setSubmitting(false);
        return;
      }

      // Payment succeeded — clear wizard state, redirect to success
      sessionStorage.removeItem('wizard');
      sessionStorage.removeItem('intake');
      router.push(`/start/success?reportId=${state.reportId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed.');
      setSubmitting(false);
    }
  };

  const priceCents = state.priceCents || (state.serviceType && state.propertyType
    ? getPriceCents(state.serviceType, state.propertyType, state.reviewTier, state.hasTaxBill)
    : 0);

  const fullAddress = state.address
    ? `${state.address.line1}, ${state.address.city}, ${state.address.state} ${state.address.zip}`
    : '';

  const selectedIssues = PROPERTY_ISSUES.filter((i) => state.propertyIssues.includes(i.id));
  const guaranteeEligible = !state.photosSkipped && state.photoCount > 0;

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        {/* Order summary */}
        <div className="card-premium rounded-xl overflow-hidden">
          <div className="border-b border-gold/10 px-6 py-4 bg-gold/5">
            <p className="text-xs uppercase tracking-widest text-gold/70">Order Summary</p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <p className="text-sm text-cream/40">Property</p>
              <p className="text-cream font-medium">{fullAddress}</p>
            </div>
            <div className="h-px bg-gold/10" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-cream/40">Report Type</p>
                <p className="text-cream font-medium">
                  {SERVICE_LABELS[state.serviceType ?? ''] || state.serviceType}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-cream/40">Property Type</p>
                <p className="text-cream font-medium capitalize">{state.propertyType}</p>
              </div>
            </div>

            {/* Review tier */}
            <div className="h-px bg-gold/10" />
            <div>
              <p className="text-sm text-cream/40">Analysis Package</p>
              <p className="text-cream font-medium">
                {state.reviewTier === 'full_representation'
                  ? 'Full Representation (We File For You)'
                  : state.reviewTier === 'guided_filing'
                    ? 'Guided Pro Se Filing (Report + Live Coaching)'
                    : state.reviewTier === 'expert_reviewed'
                      ? 'Expert-Reviewed (Analysis + Professional Appraiser)'
                      : 'Professional Analysis'}
              </p>
              <p className="text-xs text-cream/30 mt-0.5">
                {state.reviewTier === 'full_representation'
                  ? 'We file and attend the hearing on your behalf'
                  : state.reviewTier === 'guided_filing'
                    ? 'Report + live session to guide you through filing'
                    : state.reviewTier === 'expert_reviewed'
                      ? 'Delivered within 1-2 business days after appraiser review'
                      : 'Delivered to your email within minutes'}
              </p>
            </div>

            {/* Issues summary */}
            {selectedIssues.length > 0 && (
              <>
                <div className="h-px bg-gold/10" />
                <div>
                  <p className="text-sm text-cream/40 mb-2">Documented Issues</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedIssues.map((issue) => (
                      <span key={issue.id} className="text-xs bg-gold/5 text-cream/60 rounded px-2 py-0.5 border border-gold/10">
                        {issue.icon} {issue.label}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Photos status */}
            <div className="h-px bg-gold/10" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-cream/40">Photos</p>
                <p className="text-cream font-medium">
                  {state.photosSkipped
                    ? 'Skipped (data-only analysis)'
                    : `${state.photoCount} uploaded`}
                </p>
              </div>
              {/* Photo status indicator */}
            </div>

            {/* Tax bill discount */}
            {state.hasTaxBill && (
              <>
                <div className="h-px bg-gold/10" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-emerald-400">Tax Bill Discount</span>
                    <span className="text-[10px] bg-emerald-400/10 text-emerald-400 rounded-full px-2 py-0.5 font-medium">
                      {Math.round(TAX_BILL_DISCOUNT * 100)}% OFF
                    </span>
                  </div>
                  <span className="text-sm text-emerald-400">Applied</span>
                </div>
              </>
            )}

            <div className="h-px bg-gold/10" />
            <div className="flex items-center justify-between">
              <span className="text-cream font-medium">Total</span>
              <span className="font-display text-2xl text-gold">{formatPrice(priceCents)}</span>
            </div>
          </div>
        </div>

        {/* Trust signals */}
        <div className="rounded-xl border border-gold/10 bg-gold/[0.03] p-5 space-y-3">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-gold/60 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <p className="text-sm text-cream/80 font-medium">Comparable sales analysis</p>
              <p className="text-xs text-cream/40">5-10 recent sales, not automated estimates</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-gold/60 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <p className="text-sm text-cream/80 font-medium">IAAO-standard methodology</p>
              <p className="text-xs text-cream/40">Same standards used by licensed appraisers</p>
            </div>
          </div>
          {guaranteeEligible && (
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-emerald-400/70 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div>
                <p className="text-sm text-emerald-400/80 font-medium">Money-back guarantee</p>
                <p className="text-xs text-cream/40">Photo-backed appeals: refund if denied in full</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-gold/60 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <p className="text-sm text-cream/80 font-medium">Expert-reviewed before delivery</p>
              <p className="text-xs text-cream/40">Every report reviewed for accuracy</p>
            </div>
          </div>
        </div>

        {/* Stripe Payment Element */}
        <div className="card-premium rounded-xl overflow-hidden">
          <div className="border-b border-gold/10 px-6 py-4 bg-gold/5">
            <p className="text-xs uppercase tracking-widest text-gold/70">Payment Details</p>
          </div>
          <div className="p-6">
            <PaymentElement options={{ layout: 'tabs' }} />
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-lg bg-red-900/20 border border-red-500/20 p-4">
            <p className="text-sm text-red-400">{error}</p>
            <p className="text-xs text-red-400/60 mt-1">Please check your card details and try again. Your report data is saved.</p>
          </div>
        )}

        {/* Security badges */}
        <div className="flex items-center justify-center gap-6 text-xs text-cream/30 flex-wrap">
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            256-bit encryption
          </div>
          <div className="w-px h-3 bg-cream/10" />
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Secure payment via Stripe
          </div>
        </div>

        <Button type="submit" size="lg" fullWidth loading={submitting} disabled={!stripe || !elements}>
          {submitting ? 'Processing...' : `Pay ${formatPrice(priceCents)} & Generate Report`}
        </Button>

        <p className="text-center text-xs text-cream/25 leading-relaxed">
          {state.reviewTier === 'full_representation'
            ? 'Your report will be generated and expert-reviewed, then our team will file the appeal on your behalf and attend the hearing as your authorized representative.'
            : state.reviewTier === 'guided_filing'
              ? 'Your report will be generated and expert-reviewed, then our team will schedule a live session to walk you through the filing process step by step.'
              : state.reviewTier === 'expert_reviewed'
                ? 'Your report will be generated by our advanced analysis system, then personally reviewed by a licensed appraiser before delivery within 1-2 business days.'
                : 'Your report will be generated and delivered to your email within minutes, powered by our advanced valuation system.'}
          {state.serviceType === 'tax_appeal' && state.reviewTier === 'auto' && ' It includes step-by-step filing instructions for your county.'}
          {state.serviceType === 'tax_appeal' && guaranteeEligible && (
            <> Photo-backed tax appeal reports are covered by our <a href="/terms" target="_blank" className="underline hover:text-cream/40">money-back guarantee</a>.</>
          )}
        </p>

        <p className="text-center text-[10px] text-cream/15 leading-relaxed mt-2">
          By completing this purchase you agree to our{' '}
          <a href="/terms" target="_blank" className="underline hover:text-cream/30">Terms of Service</a>
          {' '}and{' '}
          <a href="/privacy" target="_blank" className="underline hover:text-cream/30">Privacy Policy</a>.
          Reports are informational analysis tools, not legal advice or formal appraisals.
          See our <a href="/disclaimer" target="_blank" className="underline hover:text-cream/30">Disclaimer</a>.
        </p>
      </div>
    </form>
  );
}

// ─── Payment Page Wrapper ────────────────────────────────────────────────────

export default function PaymentPage() {
  const router = useRouter();
  const { state, updateState, setCurrentStep } = useWizard();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [emailError, setEmailError] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    setCurrentStep(5);
    if (!state.address || !state.serviceType || !state.propertyType) {
      router.push('/start');
    }
  }, [setCurrentStep, state.address, state.serviceType, state.propertyType, router]);

  const handleCreateReport = async () => {
    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    setEmailError('');
    setCreating(true);
    setCreateError('');

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_email: email,
          client_name: name || undefined,
          property_address: state.address!.line1,
          city: state.address!.city,
          state: state.address!.state,
          county: state.address!.county,
          property_type: state.propertyType,
          service_type: state.serviceType,
          review_tier: state.reviewTier,
          photos_skipped: state.photosSkipped,
          property_issues: state.propertyIssues,
          additional_notes: state.additionalNotes,
          desired_outcome: state.desiredOutcome,
          has_tax_bill: state.hasTaxBill,
          tax_bill_assessed_value: state.taxBillData?.assessedValue ?? null,
          tax_bill_tax_amount: state.taxBillData?.taxAmount ?? null,
          tax_bill_tax_year: state.taxBillData?.taxYear ?? null,
          tax_bill_pin: state.taxBillData?.pin ?? null,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        // Surface specific field errors from validation
        if (body.details?.fieldErrors) {
          const fields = body.details.fieldErrors;
          const messages = Object.entries(fields)
            .map(([field, errs]) => `${field}: ${(errs as string[]).join(', ')}`)
            .join('; ');
          throw new Error(messages || body.error || `Server error (${response.status})`);
        }
        throw new Error(body.error || `Server error (${response.status})`);
      }

      const data = await response.json();
      if (data.founderAccess) {
        // Founder bypass — pipeline already triggered, go straight to success
        sessionStorage.removeItem('wizard');
        sessionStorage.removeItem('intake');
        router.push(`/start/success?reportId=${data.reportId}`);
        return;
      }
      updateState({ reportId: data.reportId, clientSecret: data.clientSecret, priceCents: data.priceCents });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create report.');
    } finally {
      setCreating(false);
    }
  };

  const autoPrice = state.serviceType && state.propertyType
    ? getPriceCents(state.serviceType, state.propertyType, 'auto', state.hasTaxBill)
    : 0;
  const expertPrice = state.serviceType && state.propertyType
    ? getPriceCents(state.serviceType, state.propertyType, 'expert_reviewed', state.hasTaxBill)
    : 0;
  const guidedPrice = state.serviceType && state.propertyType
    ? getPriceCents(state.serviceType, state.propertyType, 'guided_filing', state.hasTaxBill)
    : 0;
  const fullRepPrice = state.serviceType && state.propertyType
    ? getPriceCents(state.serviceType, state.propertyType, 'full_representation', state.hasTaxBill)
    : 0;

  const isTaxAppeal = state.serviceType === 'tax_appeal';

  const handleTierSelect = (tier: ReviewTier) => {
    updateState({
      reviewTier: tier,
      priceCents: state.serviceType && state.propertyType
        ? getPriceCents(state.serviceType, state.propertyType, tier, state.hasTaxBill)
        : 0,
    });
  };

  // Phase 1: Collect email and create report
  if (!state.clientSecret) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-10 animate-fade-in">
          <h1 className="font-display text-3xl text-cream mb-3">Choose Your Package</h1>
          <p className="text-cream/50">
            Select how you&apos;d like your report prepared, then enter your email.
          </p>
        </div>

        {/* Trust bar */}
        {state.serviceType === 'tax_appeal' && (
          <div className="mb-8 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-emerald-300">Money-Back Guarantee</p>
                <p className="text-xs text-cream/40 mt-0.5">Photo-backed tax appeal reports: if your assessed value isn&apos;t reduced, we refund the full report cost. <a href="/disclaimer" target="_blank" className="underline hover:text-cream/50">Details</a></p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6 animate-slide-up">
          {/* Tier Selection */}
          <div className={`grid grid-cols-1 ${isTaxAppeal ? 'sm:grid-cols-2' : 'sm:grid-cols-2'} gap-4`}>
            {/* Auto tier */}
            <button
              type="button"
              onClick={() => handleTierSelect('auto')}
              className={`relative text-left rounded-xl p-5 transition-all ${
                state.reviewTier === 'auto'
                  ? 'card-premium ring-2 ring-gold/50 shadow-lg shadow-gold/5'
                  : 'bg-navy-light/50 border border-gold/10 hover:border-gold/25'
              }`}
            >
              {state.reviewTier === 'auto' && (
                <div className="absolute top-3 right-3">
                  <div className="w-5 h-5 rounded-full bg-gold flex items-center justify-center">
                    <svg className="w-3 h-3 text-navy-deep" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
              <div className="mb-3">
                <span className="inline-block rounded-full bg-gold/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
                  Most Popular
                </span>
              </div>
              <h3 className="font-display text-lg text-cream mb-1">Professional Report</h3>
              <p className="text-sm text-cream/40 mb-3">
                Same methodology licensed appraisers use: comparable sales with line-item adjustments, assessment ratio analysis, and condition documentation from your photos.
              </p>
              <ul className="text-xs text-cream/50 space-y-1.5 mb-4">
                <li className="flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 mt-0.5 text-gold/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  5-10 comparable sales with adjustment grid
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 mt-0.5 text-gold/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Photo-based condition analysis and depreciation
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 mt-0.5 text-gold/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {isTaxAppeal ? 'County-specific filing guide with deadlines and forms' : 'Same-day delivery to your inbox'}
                </li>
              </ul>
              <p className="font-display text-2xl text-gold">{formatPrice(autoPrice)}</p>
              {isTaxAppeal && <p className="text-[10px] text-cream/25 mt-1">You file the appeal yourself</p>}
            </button>

            {/* Expert tier */}
            <button
              type="button"
              onClick={() => handleTierSelect('expert_reviewed')}
              className={`relative text-left rounded-xl p-5 transition-all ${
                state.reviewTier === 'expert_reviewed'
                  ? 'card-premium ring-2 ring-gold/50 shadow-lg shadow-gold/5'
                  : 'bg-navy-light/50 border border-gold/10 hover:border-gold/25'
              }`}
            >
              {state.reviewTier === 'expert_reviewed' && (
                <div className="absolute top-3 right-3">
                  <div className="w-5 h-5 rounded-full bg-gold flex items-center justify-center">
                    <svg className="w-3 h-3 text-navy-deep" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
              <div className="mb-3">
                <span className="inline-block rounded-full bg-gold/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
                  Premium
                </span>
              </div>
              <h3 className="font-display text-lg text-cream mb-1">Expert-Reviewed</h3>
              <p className="text-sm text-cream/40 mb-3">
                Everything in the standard report, plus a hands-on review by a licensed professional appraiser who verifies accuracy and strengthens your case.
              </p>
              <ul className="text-xs text-cream/50 space-y-1.5 mb-4">
                <li className="flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 mt-0.5 text-gold/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Everything in the Professional Report
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 mt-0.5 text-gold/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Personally reviewed by a licensed appraiser
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 mt-0.5 text-gold/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Delivered within 1-2 business days
                </li>
              </ul>
              <p className="font-display text-2xl text-gold">{formatPrice(expertPrice)}</p>
              {isTaxAppeal && <p className="text-[10px] text-cream/25 mt-1">You file the appeal yourself</p>}
            </button>

            {/* Guided Filing tier — tax appeal only */}
            {isTaxAppeal && (
              <button
                type="button"
                onClick={() => handleTierSelect('guided_filing')}
                className={`relative text-left rounded-xl p-5 transition-all ${
                  state.reviewTier === 'guided_filing'
                    ? 'card-premium ring-2 ring-gold/50 shadow-lg shadow-gold/5'
                    : 'bg-navy-light/50 border border-gold/10 hover:border-gold/25'
                }`}
              >
                {state.reviewTier === 'guided_filing' && (
                  <div className="absolute top-3 right-3">
                    <div className="w-5 h-5 rounded-full bg-gold flex items-center justify-center">
                      <svg className="w-3 h-3 text-navy-deep" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                )}
                <div className="mb-3">
                  <span className="inline-block rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    Guided
                  </span>
                </div>
                <h3 className="font-display text-lg text-cream mb-1">Guided Pro Se Filing</h3>
                <p className="text-sm text-cream/40 mb-3">
                  Everything in the Expert-Reviewed report, plus a live guided session where we walk you through filling out the appeal form and preparing for your hearing.
                </p>
                <ul className="text-xs text-cream/50 space-y-1.5 mb-4">
                  <li className="flex items-start gap-2">
                    <svg className="w-3.5 h-3.5 mt-0.5 text-emerald-400/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Everything in Expert-Reviewed
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-3.5 h-3.5 mt-0.5 text-emerald-400/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Live guided filing session with our team
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-3.5 h-3.5 mt-0.5 text-emerald-400/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Hearing prep coaching and talking points
                  </li>
                </ul>
                <p className="font-display text-2xl text-gold">{formatPrice(guidedPrice)}</p>
                <p className="text-[10px] text-cream/25 mt-1">You file, but we guide you every step</p>
              </button>
            )}

            {/* Full Representation (POA) tier — tax appeal only */}
            {isTaxAppeal && (
              <button
                type="button"
                onClick={() => handleTierSelect('full_representation')}
                className={`relative text-left rounded-xl p-5 transition-all ${
                  state.reviewTier === 'full_representation'
                    ? 'card-premium ring-2 ring-gold/50 shadow-lg shadow-gold/5'
                    : 'bg-navy-light/50 border border-gold/10 hover:border-gold/25'
                }`}
              >
                {state.reviewTier === 'full_representation' && (
                  <div className="absolute top-3 right-3">
                    <div className="w-5 h-5 rounded-full bg-gold flex items-center justify-center">
                      <svg className="w-3 h-3 text-navy-deep" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                )}
                <div className="mb-3">
                  <span className="inline-block rounded-full bg-gold/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
                    Full Service
                  </span>
                </div>
                <h3 className="font-display text-lg text-cream mb-1">We File For You</h3>
                <p className="text-sm text-cream/40 mb-3">
                  We handle everything: prepare the report, file the appeal on your behalf as your authorized representative, and attend the hearing for you.
                </p>
                <ul className="text-xs text-cream/50 space-y-1.5 mb-4">
                  <li className="flex items-start gap-2">
                    <svg className="w-3.5 h-3.5 mt-0.5 text-gold/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Everything in Expert-Reviewed
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-3.5 h-3.5 mt-0.5 text-gold/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    We file the appeal on your behalf (POA)
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-3.5 h-3.5 mt-0.5 text-gold/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    We attend the hearing as your representative
                  </li>
                </ul>
                <p className="font-display text-2xl text-gold">{formatPrice(fullRepPrice)}</p>
                <p className="text-[10px] text-cream/25 mt-1">Available where authorized representatives are permitted</p>
              </button>
            )}
          </div>

          {/* Email collection */}
          <div className="card-premium rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm text-cream/60 mb-1.5">Email address *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                placeholder="your@email.com"
                className="w-full rounded-lg bg-navy-light border border-gold/15 px-4 py-3 text-cream placeholder-cream/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20"
              />
              {emailError && <p className="text-xs text-red-400 mt-1">{emailError}</p>}
              <p className="text-xs text-cream/30 mt-1">We&apos;ll send your completed report here.</p>
            </div>
            <div>
              <label className="block text-sm text-cream/60 mb-1.5">
                Your name <span className="text-cream/30">(optional)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
                className="w-full rounded-lg bg-navy-light border border-gold/15 px-4 py-3 text-cream placeholder-cream/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20"
              />
            </div>
          </div>

          {createError && (
            <div role="alert" className="rounded-lg bg-red-900/20 border border-red-500/20 p-4 text-sm text-red-400">
              {createError}
            </div>
          )}

          <div className="flex gap-4">
            <Button variant="secondary" size="lg" onClick={() => router.push('/start/photos')}>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
              Back
            </Button>
            <Button size="lg" fullWidth loading={creating} onClick={handleCreateReport}>
              Continue to Payment — {formatPrice(state.serviceType && state.propertyType ? getPriceCents(state.serviceType, state.propertyType, state.reviewTier, state.hasTaxBill) : 0)}
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // Phase 2: Stripe payment
  if (!stripePromise) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center animate-fade-in">
          <h1 className="font-display text-3xl text-cream mb-3">Payment Unavailable</h1>
          <p className="text-cream/50">
            Payment processing is not configured. Please contact support if this issue persists.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <div className="text-center mb-10 animate-fade-in">
        <h1 className="font-display text-3xl text-cream mb-3">Complete Your Order</h1>
        <p className="text-cream/50">
          Review your details and submit payment to begin report generation.
        </p>
      </div>

      <div className="animate-slide-up">
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret: state.clientSecret,
            appearance: {
              theme: 'night',
              variables: {
                colorPrimary: '#d4a853',
                colorBackground: '#1a2332',
                colorText: '#f5f0e8',
                colorDanger: '#ef4444',
                fontFamily: 'Inter, system-ui, sans-serif',
                borderRadius: '8px',
              },
            },
          }}
        >
          <CheckoutForm />
        </Elements>
      </div>
    </main>
  );
}
