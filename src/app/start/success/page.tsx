'use client';

import { useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import Button from '@/components/ui/Button';

function SuccessContent() {
  const searchParams = useSearchParams();
  const reportId = searchParams.get('reportId');
  const serviceType = searchParams.get('serviceType') ?? 'tax_appeal';

  const [deletingTaxBill, setDeletingTaxBill] = useState(false);
  const [taxBillDeleted, setTaxBillDeleted] = useState(false);
  const [emailPref, setEmailPref] = useState(true);

  return (
    <div className="min-h-screen bg-pattern relative overflow-hidden flex items-center justify-center px-6">
      {/* Decorative glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-500/[0.04] rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gold/[0.04] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-emerald-500/[0.03] rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-lg text-center animate-fade-in">
        {/* Success icon with glow ring */}
        <div className="relative w-28 h-28 mx-auto mb-10">
          <div className="absolute -inset-4 rounded-full bg-emerald-500/[0.06] blur-xl animate-glow" />
          <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-glow" />
          <div className="relative w-28 h-28 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center animate-scale-in">
            <svg className="w-14 h-14 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <h1 className="font-display text-3xl md:text-4xl text-cream mb-4">
          You&apos;re All Set
        </h1>

        <p className="text-cream/60 text-lg mb-2 font-medium">
          Your report is being built right now.
        </p>
        <p className="text-cream/40 text-sm mb-8 max-w-md mx-auto leading-relaxed">
          {serviceType === 'pre_purchase'
            ? 'We\'re analyzing comparable sales and market data to give you a clear picture of this property\'s true value before you buy.'
            : serviceType === 'pre_listing'
              ? 'We\'re building a data-driven market analysis to strengthen your listing price and give buyers confidence.'
              : 'We\'re pulling comparable sales, analyzing your photos, and building your full evidence package for the appeal.'}
          {' '}Every report is reviewed for accuracy before it reaches you.
        </p>

        {/* What happens next */}
        <div className="card-premium rounded-xl overflow-hidden text-left mb-8">
          <div className="px-6 pt-5 pb-4 border-b border-gold/[0.08] flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gold/80">What Happens Next</h2>
          </div>
          <div className="p-6 space-y-5">
            {[
              {
                step: '1',
                title: 'Data Collection & Analysis',
                desc: 'We pull comparable sales, analyze your photos, and build a complete evidence package using independent market data.',
                active: true,
              },
              {
                step: '2',
                title: 'Quality Review',
                desc: 'Every report is reviewed by our team for accuracy and completeness before it reaches you. We stand behind our numbers.',
                active: false,
              },
              {
                step: '3',
                title: 'Delivered to Your Dashboard',
                desc: 'Your complete report — comparable sales, filing instructions, and step-by-step hearing guidance — accessible anytime from your dashboard.',
                active: false,
              },
            ].map((item, i) => (
              <div key={item.step} className="flex items-start gap-4">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  item.active
                    ? 'bg-gold/20 ring-2 ring-gold/30 shadow-[0_0_12px_rgba(212,168,71,0.2)]'
                    : 'bg-navy-light border border-gold/15'
                }`}>
                  {item.active ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-gold animate-pulse" />
                  ) : (
                    <span className="text-xs text-gold/60 font-semibold">{item.step}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium leading-snug ${item.active ? 'text-gold' : 'text-cream/80'}`}>{item.title}</p>
                  <p className="text-xs text-cream/40 mt-1 leading-relaxed">{item.desc}</p>
                </div>
                {i < 2 && (
                  <div className="absolute ml-3 mt-8 w-px h-5 bg-gold/10 hidden" />
                )}
              </div>
            ))}
          </div>
        </div>

        {reportId && (
          <>
            <p className="text-xs text-cream/25 mb-6">
              Report ID: {reportId}
            </p>

            <div className="space-y-3">
              <Button size="lg" fullWidth onClick={() => window.location.href = `/report/${reportId}`}>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Check Report Status
              </Button>
              <p className="text-xs text-cream/20">
                Your report will be available on your dashboard — no need to wait here
              </p>
            </div>

            {/* Email notification preference */}
            <div className="mt-6 card-premium rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 text-cream/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-xs text-cream/40">Email me when my report is ready</span>
              </div>
              <button
                onClick={async () => {
                  const newPref = !emailPref;
                  setEmailPref(newPref);
                  try {
                    await fetch(`/api/reports/${reportId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email_delivery_preference: newPref }),
                    });
                  } catch { /* non-critical */ }
                }}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  emailPref ? 'bg-gold/30' : 'bg-cream/10'
                }`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                  emailPref ? 'left-5.5 bg-gold' : 'left-0.5 bg-cream/30'
                }`} style={{ left: emailPref ? '22px' : '2px' }} />
              </button>
            </div>
          </>
        )}

        {!reportId && (
          <Button size="lg" onClick={() => window.location.href = '/'}>
            Back to Home
          </Button>
        )}

        <p className="text-[10px] text-cream/15 leading-relaxed mt-8 max-w-md mx-auto">
          Reports are informational analysis tools, not legal advice or formal appraisals.
          You are responsible for verifying all data and meeting your county&apos;s filing deadlines.
          See our{' '}
          <a href="/disclaimer" className="underline hover:text-cream/30">Disclaimer</a>
          {' '}and{' '}
          <a href="/terms" className="underline hover:text-cream/30">Terms of Service</a>.
        </p>

        {/* Subtle tax bill data deletion option */}
        {reportId && !taxBillDeleted && (
          <p className="text-[10px] text-cream/15 mt-4">
            Uploaded a tax bill?{' '}
            <button
              type="button"
              disabled={deletingTaxBill}
              onClick={async () => {
                setDeletingTaxBill(true);
                try {
                  const res = await fetch(`/api/reports/${reportId}/tax-bill-data`, {
                    method: 'DELETE',
                  });
                  if (res.ok) setTaxBillDeleted(true);
                } catch { /* non-critical */ }
                setDeletingTaxBill(false);
              }}
              className="underline hover:text-cream/30 disabled:opacity-50"
            >
              {deletingTaxBill ? 'Removing...' : 'Request removal of your tax bill data'}
            </button>
          </p>
        )}
        {taxBillDeleted && (
          <p className="text-[10px] text-cream/25 mt-4">
            Your tax bill data has been removed.
          </p>
        )}
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-pattern flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
