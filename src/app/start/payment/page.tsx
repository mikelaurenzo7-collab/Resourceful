'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatPrice } from '@/config/pricing';
import Button from '@/components/ui/Button';

interface IntakeData {
  address: {
    line1: string;
    city: string;
    state: string;
    zip: string;
    county: string;
  };
  propertyType: string;
  serviceType: string;
  priceCents: number;
}

const SERVICE_LABELS: Record<string, string> = {
  tax_appeal: 'Tax Appeal Report',
  pre_purchase: 'Pre-Purchase Analysis',
  pre_listing: 'Pre-Listing Report',
};

export default function PaymentPage() {
  const router = useRouter();
  const [intake, setIntake] = useState<IntakeData | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('intake');
    if (raw) {
      setIntake(JSON.parse(raw));
    }
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    // Simulate Stripe payment flow
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setSubmitting(false);
    router.push('/dashboard');
  };

  if (!intake) {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center">
        <div className="text-center">
          <p className="text-cream/50 mb-4">No intake data found.</p>
          <Button variant="secondary" onClick={() => router.push('/start')}>
            Start Over
          </Button>
        </div>
      </div>
    );
  }

  const fullAddress = `${intake.address.line1}, ${intake.address.city}, ${intake.address.state} ${intake.address.zip}`;

  // Estimated savings (mirrors the assessment card logic)
  const estimatedSavingsLow = 850;
  const estimatedSavingsHigh = 2100;

  return (
    <div className="min-h-screen bg-pattern">
      {/* Header */}
      <header className="border-b border-gold/10 bg-navy-deep/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-light to-gold-dark flex items-center justify-center">
              <span className="text-navy-deep font-bold text-sm">R</span>
            </div>
            <span className="font-display text-lg text-cream">Resourceful</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-cream/40">
            <div className="w-6 h-6 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-gold font-bold">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span>Info</span>
            <div className="w-8 h-px bg-gold/40" />
            <div className="w-6 h-6 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-gold font-bold">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span>Photos</span>
            <div className="w-8 h-px bg-gold/40" />
            <div className="w-6 h-6 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-gold font-bold">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span>Measure</span>
            <div className="w-8 h-px bg-gold/40" />
            <div className="w-6 h-6 rounded-full bg-gold flex items-center justify-center text-navy-deep font-bold">4</div>
            <span className="text-gold font-medium">Payment</span>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-navy-light">
        <div className="h-full bg-gradient-to-r from-gold-light via-gold to-gold-dark w-full transition-all duration-500" />
      </div>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-10 animate-fade-in">
          <h1 className="font-display text-3xl text-cream mb-3">
            Complete Your Order
          </h1>
          <p className="text-cream/50">
            Review your details and submit payment to begin report generation.
          </p>
        </div>

        <div className="space-y-8 animate-slide-up">
          {/* Order summary */}
          <div className="card-premium rounded-xl overflow-hidden">
            <div className="border-b border-gold/10 px-6 py-4 bg-gold/5">
              <p className="text-xs uppercase tracking-widest text-gold/70">Order Summary</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-cream/40">Property</p>
                  <p className="text-cream font-medium">{fullAddress}</p>
                </div>
              </div>
              <div className="h-px bg-gold/10" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-cream/40">Report Type</p>
                  <p className="text-cream font-medium">
                    {SERVICE_LABELS[intake.serviceType] || intake.serviceType}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-cream/40">Property Type</p>
                  <p className="text-cream font-medium capitalize">{intake.propertyType}</p>
                </div>
              </div>
              <div className="h-px bg-gold/10" />
              <div className="flex items-center justify-between">
                <span className="text-cream font-medium">Total</span>
                <span className="font-display text-2xl text-gold">{formatPrice(intake.priceCents)}</span>
              </div>
            </div>
          </div>

          {/* Savings estimate callout */}
          {intake.serviceType === 'tax_appeal' && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 flex items-center gap-5">
              <div className="flex-shrink-0 w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-400">
                  Estimated Annual Savings: ${estimatedSavingsLow.toLocaleString()} &ndash; ${estimatedSavingsHigh.toLocaleString()}
                </p>
                <p className="text-xs text-cream/40 mt-1">
                  Your {formatPrice(intake.priceCents)} report could pay for itself{' '}
                  <span className="text-emerald-400 font-semibold">
                    {Math.round(estimatedSavingsLow / (intake.priceCents / 100))}x &ndash;{' '}
                    {Math.round(estimatedSavingsHigh / (intake.priceCents / 100))}x
                  </span>{' '}
                  over in the first year alone.
                </p>
              </div>
            </div>
          )}

          {/* Stripe Elements placeholder */}
          <div className="card-premium rounded-xl overflow-hidden">
            <div className="border-b border-gold/10 px-6 py-4 bg-gold/5">
              <p className="text-xs uppercase tracking-widest text-gold/70">Payment Details</p>
            </div>
            <div className="p-6">
              {/* Card Number */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-cream/80 mb-2">
                    Card Number
                  </label>
                  <div className="rounded-lg border border-gold/20 bg-navy-deep/60 px-4 py-4 text-cream/30 text-sm flex items-center justify-between">
                    <span>Stripe Elements will render here</span>
                    <div className="flex gap-2">
                      <div className="w-8 h-5 rounded bg-cream/10" />
                      <div className="w-8 h-5 rounded bg-cream/10" />
                      <div className="w-8 h-5 rounded bg-cream/10" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-cream/80 mb-2">
                      Expiry Date
                    </label>
                    <div className="rounded-lg border border-gold/20 bg-navy-deep/60 px-4 py-4 text-cream/30 text-sm">
                      MM / YY
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream/80 mb-2">
                      CVC
                    </label>
                    <div className="rounded-lg border border-gold/20 bg-navy-deep/60 px-4 py-4 text-cream/30 text-sm">
                      CVC
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Security badges */}
          <div className="flex items-center justify-center gap-6 text-xs text-cream/30 flex-wrap">
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>256-bit encryption</span>
            </div>
            <div className="w-px h-3 bg-cream/10" />
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Secure payment via Stripe</span>
            </div>
            <div className="w-px h-3 bg-cream/10" />
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>100% money-back guarantee</span>
            </div>
          </div>

          {/* Submit */}
          <Button
            size="lg"
            fullWidth
            loading={submitting}
            onClick={handleSubmit}
          >
            {submitting ? 'Processing...' : `Pay ${formatPrice(intake.priceCents)} & Generate Report`}
          </Button>

          <p className="text-center text-xs text-cream/25 leading-relaxed">
            By clicking above, you agree to our Terms of Service and authorize a one-time charge.
            Your report will be delivered within 24 hours via email and your dashboard.
          </p>
        </div>
      </main>
    </div>
  );
}
