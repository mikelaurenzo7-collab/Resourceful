'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Button from '@/components/ui/Button';

function SuccessContent() {
  const searchParams = useSearchParams();
  const reportId = searchParams.get('reportId');

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
          Payment Confirmed!
        </h1>

        <p className="text-cream/50 text-lg mb-2">
          Your report is being generated now.
        </p>

        <p className="text-cream/40 text-sm mb-8 leading-relaxed">
          We&apos;re analyzing your property data, pulling comparable sales, and building your
          professional report. This typically takes a few hours. You&apos;ll receive an email
          when it&apos;s ready, and you can view everything right here in the app.
        </p>

        {/* What happens next */}
        <div className="card-premium rounded-xl p-6 text-left mb-8">
          <h2 className="text-sm font-medium text-gold mb-4">What Happens Next</h2>
          <div className="space-y-4">
            {[
              {
                step: '1',
                title: 'Data Collection',
                desc: 'We pull your property records, assessment data, and comparable sales from public databases.',
              },
              {
                step: '2',
                title: 'Property Analysis',
                desc: 'Our system analyzes the data, identifies over-assessment evidence, and generates professional narratives.',
              },
              {
                step: '3',
                title: 'Report Ready',
                desc: 'View your complete report, download the PDF, and get county-specific filing instructions — all in the app.',
              },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-gold/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs text-gold font-bold">{item.step}</span>
                </div>
                <div>
                  <p className="text-sm text-cream font-medium">{item.title}</p>
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

            {/* Primary CTA: go to report viewer (will show "in progress" until ready) */}
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

        {/* Disclaimer */}
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
