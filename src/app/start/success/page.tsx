'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import Button from '@/components/ui/Button';

// ─── 24-Hour Photo Window ───────────────────────────────────────────────────

const PHOTO_WINDOW_HOURS = 24;

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Window closed';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

// ─── Valuation Preview ──────────────────────────────────────────────────────

interface ValuationPreview {
  estimatedOverassessment: number;
  estimatedAnnualSavings: number;
  countyName?: string | null;
  assessmentRatio?: number | null;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const reportId = searchParams.get('reportId');

  const [preview, setPreview] = useState<ValuationPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(PHOTO_WINDOW_HOURS * 60 * 60 * 1000);

  // Fetch instant preview on mount
  useEffect(() => {
    if (!reportId) return;
    setPreviewLoading(true);

    fetch(`/api/reports/${reportId}/valuation`, { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        if (data.estimatedOverassessment != null) {
          setPreview(data);
        }
      })
      .catch(() => setPreviewError(true))
      .finally(() => setPreviewLoading(false));
  }, [reportId]);

  // Countdown timer for photo window
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const photoWindowOpen = timeRemaining > 0;
  const formatDollar = (n: number) => `$${n.toLocaleString('en-US')}`;

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

        {/* ── Instant Preview (Option C core) ─────────────────────────────── */}
        {previewLoading && (
          <div className="card-premium rounded-xl p-8 mb-8 border border-gold/20">
            <div className="flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-cream/50">Running the numbers...</span>
            </div>
          </div>
        )}

        {preview && !previewLoading && (
          <div className="card-premium rounded-xl p-6 mb-8 border border-gold/30 text-left animate-slide-up">
            <h2 className="text-xs uppercase tracking-widest text-gold/70 mb-4 text-center">
              Preliminary Analysis
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-cream/50">Estimated Over-Assessment</span>
                <span className="font-display text-xl text-gold">
                  {formatDollar(preview.estimatedOverassessment)}
                </span>
              </div>
              <div className="h-px bg-gold/10" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-cream/50">Potential Annual Tax Savings</span>
                <span className="font-display text-2xl text-emerald-400">
                  {formatDollar(preview.estimatedAnnualSavings)}
                </span>
              </div>
              {preview.countyName && (
                <>
                  <div className="h-px bg-gold/10" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-cream/50">County</span>
                    <span className="text-sm text-cream">{preview.countyName}</span>
                  </div>
                </>
              )}
            </div>
            <p className="text-[10px] text-cream/25 mt-4 leading-relaxed text-center">
              Based on IAAO error rate analysis. Your full report with comparable sales
              will provide a detailed, independently verified valuation.
            </p>
          </div>
        )}

        {previewError && !previewLoading && (
          <div className="card-premium rounded-xl p-6 mb-8 text-center">
            <p className="text-cream/50 text-sm mb-1">Your report is being built now.</p>
            <p className="text-cream/30 text-xs">Full analysis results will be delivered to your email.</p>
          </div>
        )}

        {/* ── Money-Back Guarantee ────────────────────────────────────────── */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 mb-8 text-left">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-emerald-400">Money-Back Guarantee</p>
              <p className="text-xs text-cream/40 mt-1 leading-relaxed">
                If our full analysis finds no savings opportunity for your property,
                you&apos;ll receive a complete refund — no questions asked. We only succeed when you do.
              </p>
            </div>
          </div>
        </div>

        {/* ── 24-Hour Photo Upload Window ─────────────────────────────────── */}
        <div className="card-premium rounded-xl p-6 text-left mb-8 border border-gold/20">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-medium text-gold">
                  Strengthen Your Evidence
                </h2>
                {photoWindowOpen && (
                  <span className="text-[10px] bg-gold/10 text-gold/80 rounded-full px-2 py-0.5 font-medium">
                    {formatTimeRemaining(timeRemaining)}
                  </span>
                )}
              </div>
              <p className="text-xs text-cream/50 leading-relaxed mb-3">
                {preview && preview.estimatedAnnualSavings > 0
                  ? `We found potential savings of ${formatDollar(preview.estimatedAnnualSavings)}/year. Upload photos of your property to build even stronger evidence — the assessor has never been inside your home.`
                  : 'Upload photos of your property\'s actual condition to build the strongest possible evidence package. The assessor has never been inside your home.'}
              </p>
              <p className="text-xs text-cream/40 leading-relaxed mb-4">
                Photograph any damage, deferred maintenance, outdated finishes,
                or aging systems. Your appeal deadline is weeks away — take your time.
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
                title: 'Upload Photos (Optional)',
                desc: 'You have up to 24 hours to upload photos of your property. Damage, deferred maintenance, and aging systems strengthen your case. We\'ll remind you at the 12-hour mark.',
                active: true,
              },
              {
                step: '2',
                title: 'Full Analysis Built',
                desc: 'We pull comparable sales, analyze your photos (if uploaded), and build your complete evidence package using independent market data and AI.',
                active: false,
              },
              {
                step: '3',
                title: 'Reviewed & Delivered',
                desc: 'Every report is reviewed by our team for accuracy, then delivered to your inbox within 24 hours — with filing instructions and hearing guidance.',
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
