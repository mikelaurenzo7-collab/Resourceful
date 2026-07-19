'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';

import { PROPERTY_ISSUES, PropertyIssueIcon, useWizard } from '@/components/intake/WizardLayout';
import Button from '@/components/ui/Button';
import { formatPrice, getPriceCents, TAX_BILL_DISCOUNT } from '@/config/pricing';
import { isIndependentValuationPurpose } from '@/lib/assignments/routing';
import type { ReviewTier } from '@/types/database';

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

type PurchasableTier = Exclude<ReviewTier, 'full_representation'>;

const SERVICE_LABELS: Record<string, string> = {
  tax_appeal: 'Property Tax Appeal Analysis',
  pre_purchase: 'Pre-Purchase Property Review',
  pre_listing: 'Pre-Listing Property Review',
};

function getServiceLabel(serviceType: string | null, desiredOutcome: string): string {
  if (isIndependentValuationPurpose(desiredOutcome)) {
    return 'Independent Value Workfile';
  }

  return SERVICE_LABELS[serviceType ?? ''] || serviceType || 'Property Analysis';
}

const TIER_DETAILS: Record<
  PurchasableTier,
  {
    name: string;
    shortDescription: string;
    delivery: string;
    features: string[];
    badge?: string;
  }
> = {
  auto: {
    name: 'Case Analysis',
    shortDescription:
      'A source-labeled property workfile for customers who are comfortable reviewing the evidence and taking the next step themselves.',
    delivery: 'Delivery target shown for the completed intake',
    features: [
      'Property and assessment review',
      'Relevant comparable-sales evidence',
      'Condition documentation from submitted photos',
      'Sources, calculations, and limitations',
      'Jurisdiction-specific next-step checklist when verified',
    ],
  },
  expert_reviewed: {
    name: 'Expert Review',
    shortDescription:
      'Case Analysis with additional professional review of the evidence, calculations, conclusions, and customer-ready work product.',
    delivery: 'Priority delivery after professional review',
    features: [
      'Everything in Case Analysis',
      'Professional evidence and calculation review',
      'Comparable-selection quality check',
      'Clearer scope, limitation, and action notes',
      'Reviewer role disclosed in the delivered work product',
    ],
    badge: 'Most popular',
  },
  guided_filing: {
    name: 'Guided Filing',
    shortDescription:
      'Residential Expert Review plus a live working session to help you prepare the filing and understand the hearing process.',
    delivery: 'Review delivery followed by a scheduled working session',
    features: [
      'Everything in Expert Review',
      'Live filing-preparation session',
      'Evidence and form walkthrough',
      'Hearing preparation and talking points',
      'You remain responsible for signing and filing',
    ],
    badge: 'Residential appeals',
  },
};

function normalizeTier(
  tier: ReviewTier,
  supportsInstantGuidedFiling: boolean
): PurchasableTier {
  if (tier === 'full_representation') {
    return supportsInstantGuidedFiling ? 'guided_filing' : 'expert_reviewed';
  }
  if (tier === 'guided_filing' && !supportsInstantGuidedFiling) {
    return 'expert_reviewed';
  }
  return tier;
}

function CheckIcon({ className = 'text-gold/60' }: { className?: string }) {
  return (
    <svg className={`mt-0.5 h-4 w-4 shrink-0 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m5 13 4 4L19 7" />
    </svg>
  );
}

function TierCard({
  tier,
  selected,
  price,
  onSelect,
}: {
  tier: PurchasableTier;
  selected: boolean;
  price: number;
  onSelect: () => void;
}) {
  const details = TIER_DETAILS[tier];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative rounded-xl p-5 text-left transition-all focus:outline-none focus:ring-2 focus:ring-gold/50 ${
        selected
          ? 'card-premium ring-2 ring-gold/50 shadow-lg shadow-gold/5'
          : 'border border-gold/10 bg-navy-light/50 hover:border-gold/25'
      }`}
    >
      {selected && (
        <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-gold">
          <svg className="h-3 w-3 text-navy-deep" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="m5 13 4 4L19 7" />
          </svg>
        </div>
      )}

      {details.badge && (
        <span className="mb-3 inline-block rounded-full bg-gold/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
          {details.badge}
        </span>
      )}

      <h3 className="pr-7 font-display text-lg text-cream">{details.name}</h3>
      <p className="mt-2 text-sm leading-relaxed text-cream/50">{details.shortDescription}</p>

      <ul className="my-4 space-y-1.5 text-xs text-cream/60">
        {details.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <CheckIcon />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <p className="font-display text-2xl text-gold">{formatPrice(price)}</p>
      <p className="mt-1 text-[10px] leading-relaxed text-cream/35">{details.delivery}</p>
    </button>
  );
}

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { state } = useWizard();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isTaxAppeal = state.serviceType === 'tax_appeal';
  const supportsInstantGuidedFiling =
    isTaxAppeal && state.propertyType === 'residential';
  const selectedTier = normalizeTier(
    state.reviewTier,
    supportsInstantGuidedFiling
  );
  const tierDetails = TIER_DETAILS[selectedTier];
  const serviceLabel = getServiceLabel(state.serviceType, state.desiredOutcome);
  const selectedIssues = PROPERTY_ISSUES.filter((issue) => (state.propertyIssues ?? []).includes(issue.id));
  const guaranteeEligible =
    isTaxAppeal &&
    selectedTier === 'auto' &&
    !state.photosSkipped &&
    state.photoCount > 0;

  const priceCents = state.priceCents || (
    state.serviceType && state.propertyType
      ? getPriceCents(state.serviceType, state.propertyType, selectedTier, state.hasTaxBill)
      : 0
  );

  const fullAddress = state.address
    ? `${state.address.line1}, ${state.address.city}, ${state.address.state} ${state.address.zip}`
    : '';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError('');

    try {
      const { error: paymentError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/start/photos?reportId=${state.reportId}`,
        },
        redirect: 'if_required',
      });

      if (paymentError) {
        setError(paymentError.message || 'Payment could not be completed. Please review the details and try again.');
        setSubmitting(false);
        return;
      }

      router.push(`/start/photos?reportId=${state.reportId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment could not be completed.');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="card-premium overflow-hidden rounded-xl" aria-labelledby="order-summary-heading">
        <div className="border-b border-gold/10 bg-gold/5 px-6 py-4">
          <p id="order-summary-heading" className="text-xs uppercase tracking-widest text-gold/70">Order summary</p>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <p className="text-sm text-cream/40">Property</p>
            <p className="font-medium text-cream">{fullAddress}</p>
          </div>

          <div className="h-px bg-gold/10" />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-cream/40">Service</p>
              <p className="font-medium text-cream">{serviceLabel}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-sm text-cream/40">Property type</p>
              <p className="font-medium capitalize text-cream">{state.propertyType}</p>
            </div>
          </div>

          <div className="h-px bg-gold/10" />

          <div>
            <p className="text-sm text-cream/40">Package</p>
            <p className="font-medium text-cream">{tierDetails.name}</p>
            <p className="mt-0.5 text-xs text-cream/40">{tierDetails.delivery}</p>
          </div>

          {selectedIssues.length > 0 && (
            <>
              <div className="h-px bg-gold/10" />
              <div>
                <p className="mb-2 text-sm text-cream/40">Property issues provided</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedIssues.map((issue) => (
                    <span key={issue.id} className="inline-flex items-center gap-1.5 rounded border border-gold/10 bg-gold/5 px-2 py-0.5 text-xs text-cream/60">
                      <PropertyIssueIcon issue={issue} className="h-3 w-3 text-gold/70" />
                      {issue.label}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="h-px bg-gold/10" />

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-cream/40">Supporting documents</p>
              <p className="font-medium text-cream">
                {state.photosSkipped ? 'No property photos submitted' : `${state.photoCount} property photo${state.photoCount === 1 ? '' : 's'} submitted`}
              </p>
            </div>
            {state.hasTaxBill && (
              <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                {Math.round(TAX_BILL_DISCOUNT * 100)}% bill discount
              </span>
            )}
          </div>

          <div className="h-px bg-gold/10" />

          <div className="flex items-center justify-between">
            <span className="font-medium text-cream">Total</span>
            <span className="font-display text-2xl text-gold">{formatPrice(priceCents)}</span>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gold/10 bg-gold/[0.03] p-5" aria-labelledby="included-heading">
        <h2 id="included-heading" className="text-sm font-medium text-cream">What this purchase commits Resourceful to deliver</h2>
        <ul className="mt-3 space-y-2 text-xs leading-relaxed text-cream/55">
          <li className="flex items-start gap-2"><CheckIcon />Source-labeled evidence and visible limitations</li>
          <li className="flex items-start gap-2"><CheckIcon />Review level stated for the selected package</li>
          <li className="flex items-start gap-2"><CheckIcon />No filing or representation unless separately engaged in writing</li>
          {guaranteeEligible && (
            <li className="flex items-start gap-2"><CheckIcon className="text-emerald-400/70" />Limited photo-supported refund protection, subject to the Terms</li>
          )}
        </ul>
      </section>

      <section className="card-premium overflow-hidden rounded-xl" aria-labelledby="payment-details-heading">
        <div className="border-b border-gold/10 bg-gold/5 px-6 py-4">
          <p id="payment-details-heading" className="text-xs uppercase tracking-widest text-gold/70">Payment details</p>
        </div>
        <div className="p-6">
          <PaymentElement options={{ layout: 'tabs' }} />
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-lg border border-red-500/20 bg-red-900/20 p-4">
          <p className="text-sm text-red-400">{error}</p>
          <p className="mt-1 text-xs text-red-400/60">Your property information remains saved.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-cream/35">
        <span>Secure payment through Stripe</span>
        <span className="hidden text-cream/15 sm:inline">•</span>
        <span>Price confirmed before charge</span>
        <span className="hidden text-cream/15 sm:inline">•</span>
        <span>No recurring subscription</span>
      </div>

      <Button type="submit" size="lg" fullWidth loading={submitting} disabled={!stripe || !elements}>
        {submitting ? 'Processing…' : `Pay ${formatPrice(priceCents)} and start analysis`}
      </Button>

      <p className="text-center text-[11px] leading-relaxed text-cream/35">
        By purchasing, you agree to the{' '}
        <a href="/terms" target="_blank" rel="noreferrer" className="underline hover:text-cream/55">Terms of Service</a>,{' '}
        <a href="/privacy" target="_blank" rel="noreferrer" className="underline hover:text-cream/55">Privacy Policy</a>, and{' '}
        <a href="/disclaimer" target="_blank" rel="noreferrer" className="underline hover:text-cream/55">Disclaimer</a>.
        Standard work products are informational analyses, not legal advice or certified appraisals.
      </p>
    </form>
  );
}

export default function PaymentPage() {
  const router = useRouter();
  const { state, updateState, setCurrentStep } = useWizard();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [emailError, setEmailError] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralStatus, setReferralStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [referralDiscount, setReferralDiscount] = useState(0);
  const [referralError, setReferralError] = useState('');

  const isTaxAppeal = state.serviceType === 'tax_appeal';
  const supportsInstantGuidedFiling =
    isTaxAppeal && state.propertyType === 'residential';
  const selectedTier = normalizeTier(
    state.reviewTier,
    supportsInstantGuidedFiling
  );

  useEffect(() => {
    setCurrentStep(4);

    if (!state.address || !state.serviceType || !state.propertyType) {
      router.push('/start');
      return;
    }

    if (selectedTier !== state.reviewTier) {
      updateState({
        reviewTier: selectedTier,
        priceCents: getPriceCents(state.serviceType, state.propertyType, selectedTier, state.hasTaxBill),
      });
    }

    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient().auth.getUser().then(({ data: { user } }) => {
        if (user?.email) setEmail(user.email);
      });
    });
  }, [router, selectedTier, setCurrentStep, state.address, state.hasTaxBill, state.propertyType, state.reviewTier, state.serviceType, updateState]);

  const handleTierSelect = (tier: PurchasableTier) => {
    const priceCents = state.serviceType && state.propertyType
      ? getPriceCents(state.serviceType, state.propertyType, tier, state.hasTaxBill)
      : 0;

    updateState({ reviewTier: tier, priceCents });
    setCreateError('');
  };

  const handleValidateReferral = async () => {
    if (!referralCode.trim()) return;

    setReferralStatus('validating');
    setReferralError('');

    try {
      const response = await fetch(`/api/referral/validate?code=${encodeURIComponent(referralCode.trim())}`);
      const data = await response.json();

      if (data.valid) {
        setReferralStatus('valid');
        setReferralDiscount(data.discountPct);
      } else {
        setReferralStatus('invalid');
        setReferralError(data.error || 'This referral code is not valid.');
      }
    } catch {
      setReferralStatus('invalid');
      setReferralError('The referral code could not be checked. Please try again.');
    }
  };

  const handleCreateReport = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Enter a valid email address.');
      return;
    }

    if (!state.address || !state.serviceType || !state.propertyType) {
      router.push('/start');
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
          property_address: state.address.line1,
          city: state.address.city,
          state: state.address.state,
          county: state.address.county,
          property_type: state.propertyType,
          service_type: state.serviceType,
          review_tier: selectedTier,
          photos_skipped: state.photosSkipped,
          property_issues: state.propertyIssues,
          additional_notes: state.additionalNotes,
          desired_outcome: state.desiredOutcome,
          has_tax_bill: state.hasTaxBill,
          tax_bill_assessed_value: state.taxBillData?.assessedValue ?? null,
          tax_bill_tax_amount: state.taxBillData?.taxAmount ?? null,
          tax_bill_tax_year: state.taxBillData?.taxYear ?? null,
          tax_bill_pin: state.taxBillData?.pin ?? null,
          referral_code: referralStatus === 'valid' ? referralCode.trim() : undefined,
        }),
      });

      const responseBody = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (responseBody.recommendedTier) {
          const recommendedTier = normalizeTier(
            responseBody.recommendedTier as ReviewTier,
            supportsInstantGuidedFiling
          );
          handleTierSelect(recommendedTier);
        }

        if (responseBody.details?.fieldErrors) {
          const messages = Object.entries(responseBody.details.fieldErrors)
            .map(([field, errors]) => `${field}: ${(errors as string[]).join(', ')}`)
            .join('; ');
          throw new Error(messages || responseBody.error || `Server error (${response.status})`);
        }

        throw new Error(responseBody.error || `Server error (${response.status})`);
      }

      if (responseBody.founderAccess) {
        try {
          sessionStorage.setItem('intake', JSON.stringify({ email }));
        } catch {}
        sessionStorage.removeItem('wizard');
        router.push(`/start/success?reportId=${responseBody.reportId}`);
        return;
      }

      updateState({
        reportId: responseBody.reportId,
        clientSecret: responseBody.clientSecret,
        priceCents: responseBody.priceCents,
      });

      try {
        sessionStorage.setItem('intake', JSON.stringify({ email, reportId: responseBody.reportId }));
      } catch {}
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'The order could not be created.');
    } finally {
      setCreating(false);
    }
  };

  const tierOptions: PurchasableTier[] = supportsInstantGuidedFiling
    ? ['auto', 'expert_reviewed', 'guided_filing']
    : ['auto', 'expert_reviewed'];

  const basePrice = state.serviceType && state.propertyType
    ? getPriceCents(state.serviceType, state.propertyType, selectedTier, state.hasTaxBill)
    : 0;
  const displayedPrice = referralStatus === 'valid'
    ? Math.round(basePrice * (1 - referralDiscount / 100))
    : basePrice;

  if (!state.clientSecret) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-10 text-center animate-fade-in">
          <span className="mb-3 inline-block text-[11px] font-semibold uppercase tracking-[0.2em] text-gold/70">
            Step 4 — Service and delivery
          </span>
          <h1 className="font-display text-3xl text-cream">Choose the level of support</h1>
          <p className="mx-auto mt-3 max-w-2xl text-cream/50">
            Select the work Resourceful can deliver as purchased. Filing or representation on your behalf requires a separate eligibility review and written engagement.
          </p>
        </header>

        <div className="space-y-6 animate-slide-up">
          {isTaxAppeal && (
            <aside className="rounded-xl border border-gold/15 bg-gold/[0.04] px-5 py-4">
              <p className="text-sm font-medium text-cream">Outcome protection is limited and conditional</p>
              <p className="mt-1 text-xs leading-relaxed text-cream/50">
                Eligible photo-supported Case Analysis orders may qualify for refund protection when a timely, complete filing is denied in full. Review the{' '}
                <a href="/terms" target="_blank" rel="noreferrer" className="text-gold underline hover:text-gold-light">Terms</a>{' '}
                before purchase.
              </p>
            </aside>
          )}

          <section className={`grid grid-cols-1 gap-4 ${tierOptions.length === 3 ? 'lg:grid-cols-3' : 'sm:grid-cols-2'}`} aria-label="Available packages">
            {tierOptions.map((tier) => (
              <TierCard
                key={tier}
                tier={tier}
                selected={selectedTier === tier}
                price={state.serviceType && state.propertyType
                  ? getPriceCents(state.serviceType, state.propertyType, tier, state.hasTaxBill)
                  : 0}
                onSelect={() => handleTierSelect(tier)}
              />
            ))}
          </section>

          {isTaxAppeal && !supportsInstantGuidedFiling && (
            <aside className="rounded-xl border border-amber-400/15 bg-amber-400/[0.035] p-5">
              <p className="text-sm font-medium text-cream">Need guided filing for this property?</p>
              <p className="mt-1 text-xs leading-relaxed text-cream/50">
                Commercial, industrial, land, and agricultural appeals require a property-scope and professional-availability review before Guided Filing can be quoted. Choose Expert Review now or contact{' '}
                <a href="mailto:support@resourceful.app" className="text-gold underline hover:text-gold-light">support@resourceful.app</a>{' '}
                for scoped filing support.
              </p>
            </aside>
          )}

          {isTaxAppeal && (
            <aside className="rounded-xl border border-cream/[0.08] bg-navy-light/35 p-5">
              <p className="text-sm font-medium text-cream">Need someone to file or appear for you?</p>
              <p className="mt-1 text-xs leading-relaxed text-cream/50">
                Representation is not sold through instant checkout. Resourceful must first verify the property scope, jurisdiction, eligible representative type, professional availability, authorization requirements, conflicts, and fee. {supportsInstantGuidedFiling ? 'Start with Guided Filing or contact' : 'Choose Expert Review or contact'}{' '}
                <a href="mailto:support@resourceful.app" className="text-gold underline hover:text-gold-light">support@resourceful.app</a>{' '}
                for an eligibility review.
              </p>
            </aside>
          )}

          <section className="card-premium overflow-hidden rounded-xl" aria-labelledby="delivery-details-heading">
            <div className="border-b border-gold/10 bg-gold/[0.04] px-6 py-4">
              <p id="delivery-details-heading" className="text-xs uppercase tracking-widest text-gold/70">Delivery details</p>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label htmlFor="referral-code" className="mb-1.5 block text-sm font-medium text-cream/70">
                  Referral code <span className="font-normal text-cream/30">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    id="referral-code"
                    type="text"
                    autoComplete="off"
                    value={referralCode}
                    onChange={(event) => {
                      setReferralCode(event.target.value.toUpperCase());
                      setReferralStatus('idle');
                      setReferralError('');
                    }}
                    placeholder="Enter code"
                    maxLength={50}
                    className="min-w-0 flex-1 rounded-lg border border-gold/15 bg-navy-light px-4 py-3 uppercase text-cream placeholder:text-cream/25 focus:border-gold/40 focus:outline-none focus:ring-1 focus:ring-gold/20"
                  />
                  <button
                    type="button"
                    onClick={handleValidateReferral}
                    disabled={!referralCode.trim() || referralStatus === 'validating'}
                    className="rounded-lg border border-gold/20 bg-gold/10 px-4 py-3 text-sm font-medium text-gold transition-colors hover:bg-gold/15 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {referralStatus === 'validating' ? 'Checking…' : 'Apply'}
                  </button>
                </div>
                {referralStatus === 'valid' && (
                  <p className="mt-1.5 text-xs font-medium text-emerald-400">{referralDiscount}% discount will be applied by the server.</p>
                )}
                {referralStatus === 'invalid' && referralError && (
                  <p className="mt-1.5 text-xs text-red-400">{referralError}</p>
                )}
              </div>

              <div className="h-px bg-gold/10" />

              <div>
                <label htmlFor="payment-email" className="mb-1.5 block text-sm font-medium text-cream/70">Email address *</label>
                <input
                  id="payment-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setEmailError('');
                  }}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-gold/15 bg-navy-light px-4 py-3 text-cream placeholder:text-cream/25 focus:border-gold/40 focus:outline-none focus:ring-1 focus:ring-gold/20"
                />
                {emailError && <p className="mt-1.5 text-xs text-red-400">{emailError}</p>}
                <p className="mt-1.5 text-xs text-cream/35">Order updates and the completed work product are sent here.</p>
              </div>

              <div>
                <label htmlFor="payment-name" className="mb-1.5 block text-sm font-medium text-cream/70">
                  Name <span className="font-normal text-cream/30">(optional)</span>
                </label>
                <input
                  id="payment-name"
                  type="text"
                  autoComplete="name"
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Jane Smith"
                  className="w-full rounded-lg border border-gold/15 bg-navy-light px-4 py-3 text-cream placeholder:text-cream/25 focus:border-gold/40 focus:outline-none focus:ring-1 focus:ring-gold/20"
                />
              </div>
            </div>
          </section>

          {createError && (
            <div role="alert" className="rounded-lg border border-red-500/20 bg-red-900/20 p-4 text-sm text-red-400">
              {createError}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
            <Button variant="secondary" size="lg" onClick={() => router.push('/start/situation')}>
              Back
            </Button>
            <Button size="lg" fullWidth loading={creating} onClick={handleCreateReport}>
              Continue to secure payment — {formatPrice(displayedPrice)}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (!stripePromise) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="text-center animate-fade-in">
          <h1 className="font-display text-3xl text-cream">Payment is temporarily unavailable</h1>
          <p className="mt-3 text-cream/50">
            No charge was attempted. Contact support if the issue continues.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-10 text-center animate-fade-in">
        <span className="mb-3 inline-block text-[11px] font-semibold uppercase tracking-[0.2em] text-gold/70">
          Step 4 — Secure payment
        </span>
        <h1 className="font-display text-3xl text-cream">Review and complete the order</h1>
        <p className="mt-3 text-cream/50">
          The server has confirmed the package and price. The analysis begins after successful payment.
        </p>
      </header>

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
