'use client';

import { useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import Button from '@/components/ui/Button';

function SuccessContent() {
  const searchParams = useSearchParams();
  const reportId = searchParams.get('reportId');

  const [deletingTaxBill, setDeletingTaxBill] = useState(false);
  const [taxBillDeleted, setTaxBillDeleted] = useState(false);

  return (
    <div className="min-h-screen bg-pattern flex items-center justify-center px-6">
      <div className="max-w-lg text-center animate-fade-in">
        {/* Success icon */}
        <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-8">
          <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="font-display text-3xl md:text-4xl text-cream mb-4">
          Payment Confirmed
        </h1>

        <p className="text-cream/50 text-lg mb-2">
          Your report is being built now.
        </p>
        <p className="text-cream/40 text-sm mb-8 max-w-md mx-auto leading-relaxed">
          We&apos;re pulling comparable sales and property data to build your
          full evidence package. Every report is reviewed for accuracy before it reaches you.
        </p>

        {/* Photo upload encouragement */}
        <div className="card-premium rounded-xl p-6 text-left mb-8 border border-gold/20">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-medium text-gold mb-1">
                Want to strengthen your case?
              </h2>
              <p className="text-xs text-cream/50 leading-relaxed mb-3">
                Your report is already being built with market data and comparable sales.
                But photos of your property&apos;s actual condition are your strongest
                independent evidence — the assessor has never been inside your home.
              </p>
              <p className="text-xs text-cream/40 leading-relaxed mb-4">
                Upload photos of any damage, deferred maintenance, outdated finishes, or
                aging systems. Your appeal deadline is weeks away — no rush. The more you
                document, the stronger your evidence package.
              </p>
              {reportId && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => window.location.href = `/report/${reportId}/photos`}
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Upload Photos
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* What happens next */}
        <div className="card-premium rounded-xl p-6 text-left mb-8">
          <h2 className="text-sm font-medium text-gold mb-4">What Happens Next</h2>
          <div className="space-y-4">
            {[
              {
                step: '1',
                title: 'Data Collection & Analysis',
                desc: 'We pull comparable sales and property data to build a complete evidence package using independent market data.',
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
