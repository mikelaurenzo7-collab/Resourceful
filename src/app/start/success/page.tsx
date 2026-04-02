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

  return (
    <div className="min-h-screen bg-pattern relative overflow-hidden flex items-center justify-center px-6">
      {/* Decorative glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-gold/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-lg text-center animate-fade-in">
        {/* Success icon with glow ring */}
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-glow" />
          <div className="relative w-24 h-24 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center animate-scale-in">
            <svg className="w-12 h-12 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <h1 className="font-display text-3xl md:text-4xl text-cream mb-4">
          Payment Confirmed
        </h1>

        <p className="text-cream/50 text-lg mb-2">
          Your report is now being built by our team.
        </p>
        <p className="text-cream/40 text-sm mb-8 max-w-md mx-auto leading-relaxed">
          {serviceType === 'pre_purchase'
            ? 'We\u2019re analyzing comparable sales and market data to give you a clear picture of this property\u2019s true value before you buy.'
            : serviceType === 'pre_listing'
              ? 'We\u2019re building a data-driven market analysis to strengthen your listing price and give buyers confidence.'
              : 'We\u2019re pulling comparable sales, analyzing your photos, and building your full evidence package for the appeal.'}
          {' '}Every report is reviewed for accuracy before it reaches you.
        </p>

        {/* What happens next */}
        <div className="card-premium rounded-xl p-6 text-left mb-8">
          <h2 className="text-sm font-medium text-gold mb-4">What Happens Next</h2>
          <div className="space-y-4">
            {[
              {
                step: '1',
                title: 'Data Collection & Analysis',
                desc: 'We pull comparable sales, analyze your photos, and build a complete evidence package using independent market data.',
                active: true,
              },
              {
                step: '2',
                title: 'Expert Review',
                desc: 'Every report is reviewed by our team for accuracy and completeness before it reaches you. We stand behind our numbers.',
                active: false,
              },
              {
                step: '3',
                title: 'Report Delivered',
                desc: 'Your complete report with verified savings, filing instructions, and step-by-step hearing guidance — delivered to your inbox.',
                active: false,
              },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  item.active ? 'bg-gold/20 ring-2 ring-gold/30' : 'bg-gold/15'
                }`}>
                  {item.active ? (
                    <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                  ) : (
                    <span className="text-xs text-gold font-bold">{item.step}</span>
                  )}
                </div>
                <div>
                  <p className={`text-sm font-medium ${item.active ? 'text-gold' : 'text-cream'}`}>{item.title}</p>
                  <p className="text-xs text-cream/40 mt-0.5">{item.desc}</p>
                </div>
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
                View My Report
              </Button>
              <p className="text-xs text-cream/20">
                Bookmark this link to check back anytime
              </p>
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
