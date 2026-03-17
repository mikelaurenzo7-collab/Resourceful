'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import Button from '@/components/ui/Button';

function SuccessContent() {
  const searchParams = useSearchParams();
  const reportId = searchParams.get('reportId');

  // ── Run valuation after payment ────────────────────────────────────────
  const [valuationLoading, setValuationLoading] = useState(true);
  const [valuationResult, setValuationResult] = useState<{
    estimatedOverassessment: number;
    estimatedAnnualSavings: number;
  } | null>(null);
  const [deletingTaxBill, setDeletingTaxBill] = useState(false);
  const [taxBillDeleted, setTaxBillDeleted] = useState(false);

  useEffect(() => {
    if (!reportId) {
      setValuationLoading(false);
      return;
    }

    // Call the valuation API to get the optimistic result
    const runValuation = async () => {
      try {
        const res = await fetch(`/api/reports/${reportId}/valuation`, {
          method: 'POST',
        });
        if (res.ok) {
          const data = await res.json();
          setValuationResult(data);
        }
      } catch {
        // Valuation preview is non-critical — pipeline will still run
      } finally {
        setValuationLoading(false);
      }
    };

    // Small delay so the user sees the confirmation first
    const timer = setTimeout(runValuation, 1500);
    return () => clearTimeout(timer);
  }, [reportId]);

  const formatDollars = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(n);

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

        {/* Valuation result — optimistic messaging */}
        {valuationLoading ? (
          <div className="card-premium rounded-xl p-8 mb-8 animate-pulse">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              <p className="text-cream/60 text-sm">Running the numbers on your property...</p>
            </div>
          </div>
        ) : valuationResult ? (
          <div className="card-premium rounded-xl p-8 mb-8 border border-gold/20 animate-slide-up">
            <p className="text-xs uppercase tracking-widest text-gold/70 mb-4">
              Initial Assessment
            </p>
            <p className="text-cream/70 text-sm mb-4 leading-relaxed">
              We found reason to believe your tax bill could be incorrect by up to
            </p>
            <p className="font-display text-4xl text-gold-gradient mb-2">
              {formatDollars(valuationResult.estimatedOverassessment)}
            </p>
            <p className="text-cream/50 text-sm mb-6">
              which could save you up to{' '}
              <span className="text-gold font-semibold">
                {formatDollars(valuationResult.estimatedAnnualSavings)}/year
              </span>
            </p>
            <div className="h-px bg-gold/10 mb-4" />
            <p className="text-xs text-cream/40 leading-relaxed">
              We&apos;re now conducting a final review for accuracy — pulling comparable sales,
              analyzing market data, and building your full evidence package. You&apos;ll receive
              your complete report with verified numbers and your options.
            </p>
          </div>
        ) : (
          <p className="text-cream/50 text-lg mb-2">
            Your report is being generated now.
          </p>
        )}

        {/* What happens next */}
        <div className="card-premium rounded-xl p-6 text-left mb-8">
          <h2 className="text-sm font-medium text-gold mb-4">What Happens Next</h2>
          <div className="space-y-4">
            {[
              {
                step: '1',
                title: 'Final Review for Accuracy',
                desc: 'We verify your assessment data against comparable sales and real market conditions to lock in the exact numbers.',
                active: true,
              },
              {
                step: '2',
                title: 'Evidence Package Built',
                desc: 'Comparable sales analysis, condition documentation, and a professional narrative — everything the Board of Review expects.',
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
