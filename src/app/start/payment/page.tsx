'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWizard, PROPERTY_ISSUES } from '@/components/intake/WizardLayout';
import { formatPrice, getPriceCents, TAX_BILL_DISCOUNT } from '@/config/pricing';
import type { ReviewTier } from '@/types/database';
import Button from '@/components/ui/Button';

const SERVICE_LABELS: Record<string, string> = {
  tax_appeal: 'Tax Appeal Report',
  pre_purchase: 'Pre-Purchase Analysis',
  pre_listing: 'Pre-Listing Report',
};

// ─── Submit Page ────────────────────────────────────────────────────────────
// Collects email, shows order summary, and submits the report.
// No payment at this stage — users pay after the report is ready.

export default function SubmitPage() {
  const router = useRouter();
  const { state, updateState, setCurrentStep } = useWizard();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [emailError, setEmailError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    setCurrentStep(5);
    if (!state.address || !state.serviceType || !state.propertyType) {
      router.push('/start');
    }
  }, [setCurrentStep, state.address, state.serviceType, state.propertyType, router]);

  const handleSubmit = async () => {
    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    setEmailError('');
    setSubmitting(true);
    setSubmitError('');

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
        throw new Error(body.error || `Server error (${response.status})`);
      }

      const { reportId, priceCents } = await response.json();
      updateState({ reportId, priceCents });

      // Clear wizard state and redirect to success
      sessionStorage.removeItem('wizard');
      sessionStorage.removeItem('intake');
      router.push(`/start/success?reportId=${reportId}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTierSelect = (tier: ReviewTier) => {
    updateState({
      reviewTier: tier,
      priceCents: state.serviceType && state.propertyType
        ? getPriceCents(state.serviceType, state.propertyType, tier, state.hasTaxBill)
        : 0,
    });
  };

  const autoPrice = state.serviceType && state.propertyType
    ? getPriceCents(state.serviceType, state.propertyType, 'auto', state.hasTaxBill)
    : 0;
  const expertPrice = state.serviceType && state.propertyType
    ? getPriceCents(state.serviceType, state.propertyType, 'expert_reviewed', state.hasTaxBill)
    : 0;

  const fullAddress = state.address
    ? `${state.address.line1}, ${state.address.city}, ${state.address.state} ${state.address.zip}`
    : '';

  const selectedIssues = PROPERTY_ISSUES.filter((i) => state.propertyIssues.includes(i.id));

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <div className="text-center mb-10 animate-fade-in">
        <h1 className="font-display text-3xl text-cream mb-3">Submit Your Property</h1>
        <p className="text-cream/50">
          Choose your analysis package and we&apos;ll get started. You only pay when your report is ready.
        </p>
      </div>

      <div className="space-y-6 animate-slide-up">
        {/* Tier Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              Our advanced, professionally trained valuation system analyzes your property against real market data, comparable sales, and county records.
            </p>
            <ul className="text-xs text-cream/50 space-y-1.5 mb-4">
              <li className="flex items-start gap-2">
                <svg className="w-3.5 h-3.5 mt-0.5 text-gold/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Analysis trained on real appraisal standards
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-3.5 h-3.5 mt-0.5 text-gold/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Full comparable sales analysis with adjustments
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-3.5 h-3.5 mt-0.5 text-gold/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Results emailed within 24 hours
              </li>
            </ul>
            <p className="font-display text-2xl text-gold">{formatPrice(autoPrice)}</p>
            <p className="text-[10px] text-cream/30 mt-1">Pay only when your report is ready</p>
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
            <p className="text-[10px] text-cream/30 mt-1">Pay only when your report is ready</p>
          </button>
        </div>

        {/* Order Summary */}
        <div className="card-premium rounded-xl overflow-hidden">
          <div className="border-b border-gold/10 px-6 py-4 bg-gold/5">
            <p className="text-xs uppercase tracking-widest text-gold/70">Submission Summary</p>
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
              <span className="text-cream font-medium">Price when ready</span>
              <span className="font-display text-2xl text-gold">
                {formatPrice(state.serviceType && state.propertyType
                  ? getPriceCents(state.serviceType, state.propertyType, state.reviewTier, state.hasTaxBill)
                  : 0)}
              </span>
            </div>
          </div>
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
            <p className="text-xs text-cream/30 mt-1">We&apos;ll email you when your report is ready.</p>
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

        {submitError && (
          <div className="rounded-lg bg-red-900/20 border border-red-500/20 p-4 text-sm text-red-400">
            {submitError}
          </div>
        )}

        <div className="flex gap-4">
          <Button variant="secondary" size="lg" onClick={() => router.push('/start/photos')}>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            Back
          </Button>
          <Button size="lg" fullWidth loading={submitting} onClick={handleSubmit}>
            Submit for Analysis
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Button>
        </div>

        {/* How it works */}
        <div className="card-premium rounded-xl p-5">
          <h3 className="text-sm font-medium text-gold mb-3">How It Works</h3>
          <div className="space-y-3">
            {[
              { step: '1', title: 'Submit', desc: 'We receive your property details and start our analysis.' },
              { step: '2', title: 'We Analyze', desc: 'Our system pulls comparable sales, market data, and builds your evidence package.' },
              { step: '3', title: 'Report Ready', desc: 'We email you when your report is complete. Pay to unlock your full report and filing instructions.' },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-gold/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-gold font-bold">{item.step}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-cream">{item.title}</p>
                  <p className="text-xs text-cream/40 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-cream/25 leading-relaxed">
          By submitting you agree to our{' '}
          <a href="/terms" target="_blank" className="underline hover:text-cream/40">Terms of Service</a>
          {' '}and{' '}
          <a href="/privacy" target="_blank" className="underline hover:text-cream/40">Privacy Policy</a>.
          Reports are informational analysis tools, not legal advice or formal appraisals.
          See our <a href="/disclaimer" target="_blank" className="underline hover:text-cream/40">Disclaimer</a>.
        </p>
      </div>
    </main>
  );
}
