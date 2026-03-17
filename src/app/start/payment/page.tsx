'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useWizard, PROPERTY_ISSUES } from '@/components/intake/WizardLayout';
import { formatPrice, getPriceCents } from '@/config/pricing';
import Button from '@/components/ui/Button';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

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
  const { state, updateState } = useWizard();
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
          receipt_email: state.address ? undefined : undefined,
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
    ? getPriceCents(state.serviceType, state.propertyType)
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

            <div className="h-px bg-gold/10" />
            <div className="flex items-center justify-between">
              <span className="text-cream font-medium">Total</span>
              <span className="font-display text-2xl text-gold">{formatPrice(priceCents)}</span>
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
          <div className="rounded-lg bg-red-900/20 border border-red-500/20 p-4 text-sm text-red-400">
            {error}
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
          Your report will be generated and delivered to your email within a few hours.
          {state.serviceType === 'tax_appeal' && ' It includes step-by-step filing instructions for your county.'}
          {state.serviceType === 'tax_appeal' && guaranteeEligible && (
            <> Photo-backed tax appeal reports are covered by our <a href="/terms" target="_blank" className="underline hover:text-cream/40">money-back guarantee</a>.</>
          )}
        </p>

        <p className="text-center text-[10px] text-cream/15 leading-relaxed mt-2">
          By completing this purchase you agree to our{' '}
          <a href="/terms" target="_blank" className="underline hover:text-cream/30">Terms of Service</a>
          {' '}and{' '}
          <a href="/privacy" target="_blank" className="underline hover:text-cream/30">Privacy Policy</a>.
          Reports are AI-generated informational tools, not legal advice or formal appraisals.
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
          photos_skipped: state.photosSkipped,
          property_issues: state.propertyIssues,
          additional_notes: state.additionalNotes,
          desired_outcome: state.desiredOutcome,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Server error (${response.status})`);
      }

      const { reportId, clientSecret, priceCents } = await response.json();
      updateState({ reportId, clientSecret, priceCents });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create report.');
    } finally {
      setCreating(false);
    }
  };

  // Phase 1: Collect email and create report
  if (!state.clientSecret) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-10 animate-fade-in">
          <h1 className="font-display text-3xl text-cream mb-3">Almost There</h1>
          <p className="text-cream/50">
            Enter your email so we can deliver your report. No account needed.
          </p>
        </div>

        <div className="space-y-6 animate-slide-up">
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
            <div className="rounded-lg bg-red-900/20 border border-red-500/20 p-4 text-sm text-red-400">
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
              Continue to Payment
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
