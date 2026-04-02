'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface CountyInfo {
  name: string;
  state: string;
  appealBoardName: string;
  appealBoardAddress: string | null;
  appealBoardPhone: string | null;
  acceptsOnlineFiling: boolean;
  portalUrl: string | null;
  acceptsEmailFiling: boolean;
  filingEmail: string | null;
  requiresMailFiling: boolean;
  appealDeadlineRule: string;
  nextAppealDeadline: string | null;
  currentTaxYear: number | null;
  assessmentCycle: string | null;
  appealFormName: string | null;
  formDownloadUrl: string | null;
  filingFeeCents: number;
  filingFeeNotes: string | null;
  requiredDocuments: string[] | null;
  filingSteps: { step_number: number; title: string; description: string; url?: string; form_name?: string }[] | null;
  hearingTypicallyRequired: boolean;
  hearingFormat: string | null;
  hearingDurationMinutes: number | null;
  virtualHearingAvailable: boolean;
  virtualHearingPlatform: string | null;
  informalReviewAvailable: boolean;
  informalReviewNotes: string | null;
  typicalResolutionWeeksMin: number | null;
  typicalResolutionWeeksMax: number | null;
  furtherAppealBody: string | null;
  proSeTips: string | null;
}

interface ReportData {
  ready: boolean;
  status: string;
  message?: string;
  reportId: string;
  propertyAddress: string;
  serviceType: string;
  assessedValue: number;
  concludedValue: number;
  potentialSavings: number;
  pdfUrl: string | null;
  filingGuide: string | null;
  deliveredAt: string | null;
  county: CountyInfo | null;
}

function formatDollar(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

function formatFee(cents: number): string {
  if (cents === 0) return 'Waived';
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ReportViewerPage() {
  const params = useParams();
  const reportId = params.id as string;
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pollExhausted, setPollExhausted] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'filing' | 'guide'>('overview');

  useEffect(() => {
    if (!reportId) return;

    const fetchReport = async () => {
      try {
        const res = await fetch(`/api/reports/${reportId}/viewer`);
        if (!res.ok) {
          setError(res.status === 404 ? 'Report not found.' : 'Failed to load report.');
          return;
        }
        const json = await res.json();
        setData(json);
      } catch {
        setError('Failed to load report. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
    // Poll with backoff: 10s → 20s → 30s → 30s (max), up to 60 attempts (~25 min)
    let pollCount = 0;
    const maxPolls = 60;
    let pollTimer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      if (pollCount >= maxPolls) {
        setPollExhausted(true);
        return;
      }
      pollCount++;
      const delay = Math.min(10000 * Math.pow(1.5, Math.min(pollCount - 1, 3)), 30000);
      pollTimer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/reports/${reportId}/viewer`);
          if (res.ok) {
            const json = await res.json();
            setData(json);
            if (json.ready) return; // Stop polling
          }
        } catch { /* ignore transient polling errors */ }
        if (!cancelled) poll();
      }, delay);
    };

    // Only start polling if initial fetch didn't return ready data
    if (!data?.ready) poll();

    return () => {
      cancelled = true;
      clearTimeout(pollTimer);
    };
  }, [reportId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <main className="min-h-screen bg-pattern flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-cream/50">Loading your report...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-pattern flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-cream/60 mb-6">{error}</p>
          <Link href="/" className="text-gold hover:text-gold-light transition-colors">
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  if (data && !data.ready) {
    return (
      <main className="min-h-screen bg-pattern flex items-center justify-center px-6">
        <div className="text-center max-w-lg animate-fade-in">
          {pollExhausted ? (
            <>
              <div className="w-20 h-20 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-8">
                <svg className="w-10 h-10 text-gold/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="font-display text-3xl text-cream mb-4">Still Working</h1>
              <p className="text-cream/50 mb-2">
                Your report is taking longer than usual. This can happen with complex properties.
              </p>
              <p className="text-cream/30 text-sm mb-6">
                You can safely close this page — we&apos;ll email your report when it&apos;s ready.
              </p>
              <button
                onClick={() => { setPollExhausted(false); window.location.reload(); }}
                className="text-sm font-medium text-gold border border-gold/20 px-5 py-2.5 rounded-lg hover:bg-gold/10 transition-all"
              >
                Refresh Page
              </button>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-8">
                <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              </div>
              <h1 className="font-display text-3xl text-cream mb-4">Report in Progress</h1>
              <p className="text-cream/50 mb-2">{data.message || 'Your report is being generated.'}</p>
              <p className="text-cream/30 text-sm">This page will automatically update when your report is ready.</p>
            </>
          )}
          <p className="text-xs text-cream/20 mt-8">Report ID: {reportId}</p>
        </div>
      </main>
    );
  }

  if (!data) return null;

  const county = data.county;
  const isTaxAppeal = data.serviceType === 'tax_appeal';

  return (
    <main className="min-h-screen bg-pattern">
      {/* Nav */}
      <nav className="border-b border-gold/5 bg-navy-deep/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="mx-auto max-w-5xl px-6 flex items-center justify-between h-16">
          <Link href="/" className="font-display text-xl text-gold">
            Resourceful
          </Link>
          {data.pdfUrl && (
            <a
              href={data.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-navy-deep bg-gradient-to-r from-gold-light via-gold to-gold-dark px-4 py-2 rounded-lg hover:shadow-gold transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </a>
          )}
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-2xl md:text-3xl text-cream mb-1">{data.propertyAddress}</h1>
          <p className="text-sm text-cream/40">
            {isTaxAppeal ? 'Tax Appeal Report' : data.serviceType === 'pre_purchase' ? 'Pre-Purchase Analysis' : 'Pre-Listing Report'}
            {data.deliveredAt && ` — Delivered ${new Date(data.deliveredAt).toLocaleDateString()}`}
          </p>
        </div>

        {/* Tabs */}
        {isTaxAppeal && (
          <div className="flex gap-1 mb-8 bg-navy-light/50 rounded-lg p-1 w-fit">
            {(['overview', 'filing', 'guide'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-gold/15 text-gold'
                    : 'text-cream/40 hover:text-cream/60'
                }`}
              >
                {tab === 'overview' ? 'Report Summary' : tab === 'filing' ? 'How to File' : 'Full Filing Guide'}
              </button>
            ))}
          </div>
        )}

        {/* ─── OVERVIEW TAB ───────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* Value summary cards */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="card-premium rounded-xl p-6">
                <p className="text-xs uppercase tracking-widest text-cream/40 mb-1">Assessed Value</p>
                <p className="font-display text-2xl text-cream">{formatDollar(data.assessedValue)}</p>
              </div>
              <div className="card-premium rounded-xl p-6">
                <p className="text-xs uppercase tracking-widest text-cream/40 mb-1">Our Concluded Value</p>
                <p className="font-display text-2xl text-gold">{formatDollar(data.concludedValue)}</p>
              </div>
              {isTaxAppeal && data.potentialSavings > 0 && (
                <div className="card-premium rounded-xl p-6 border border-emerald-500/20">
                  <p className="text-xs uppercase tracking-widest text-emerald-400/60 mb-1">Potential Savings</p>
                  <p className="font-display text-2xl text-emerald-400">{formatDollar(data.potentialSavings)}</p>
                  <p className="text-xs text-cream/30 mt-1">in over-assessment</p>
                </div>
              )}
            </div>

            {/* Download CTA */}
            {data.pdfUrl && (
              <div className="card-premium rounded-xl p-6 flex items-center justify-between">
                <div>
                  <p className="text-cream font-medium">Your Full Report (PDF)</p>
                  <p className="text-xs text-cream/40 mt-0.5">
                    Includes comparable sales, adjustment grid, narratives, and filing instructions.
                    Download link valid for 7 days.
                  </p>
                </div>
                <a
                  href={data.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm font-medium bg-gold/10 text-gold border border-gold/20 px-4 py-2.5 rounded-lg hover:bg-gold/20 transition-all flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download PDF
                </a>
              </div>
            )}

            {/* Quick filing summary for tax appeals */}
            {isTaxAppeal && county && (
              <div className="card-premium rounded-xl overflow-hidden">
                <div className="border-b border-gold/10 px-6 py-4 bg-gold/5">
                  <p className="text-xs uppercase tracking-widest text-gold/70">Quick Filing Summary</p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-cream/40">Appeal Board</p>
                      <p className="text-cream font-medium">{county.appealBoardName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-cream/40">Filing Deadline</p>
                      <p className="text-cream font-medium">
                        {county.nextAppealDeadline
                          ? new Date(county.nextAppealDeadline).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                          : county.appealDeadlineRule}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-cream/40">Filing Method</p>
                      <p className="text-cream font-medium">
                        {county.acceptsOnlineFiling ? 'Online Portal Available' :
                         county.acceptsEmailFiling ? 'Email Filing Available' :
                         'Mail Filing Required'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-cream/40">Filing Fee</p>
                      <p className="text-cream font-medium">
                        {formatFee(county.filingFeeCents)}
                        {county.filingFeeNotes && <span className="text-cream/40 text-xs ml-1">({county.filingFeeNotes})</span>}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('filing')}
                    className="text-sm text-gold hover:text-gold-light transition-colors flex items-center gap-1"
                  >
                    View complete filing instructions
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── FILING TAB ─────────────────────────────────────────────── */}
        {activeTab === 'filing' && county && (
          <div className="space-y-6 animate-fade-in">
            {/* Deadline alert */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-5 flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-400">Filing Deadline</p>
                <p className="text-sm text-amber-400/70 mt-0.5">
                  {county.nextAppealDeadline
                    ? `Your next filing deadline is ${new Date(county.nextAppealDeadline).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`
                    : county.appealDeadlineRule}
                  {county.currentTaxYear && ` (Tax Year ${county.currentTaxYear})`}
                </p>
                {county.assessmentCycle && (
                  <p className="text-xs text-amber-400/50 mt-1">
                    {county.name} uses a {county.assessmentCycle} assessment cycle.
                  </p>
                )}
              </div>
            </div>

            {/* Filing method - prominent if online */}
            {county.acceptsOnlineFiling && county.portalUrl && (
              <div className="card-premium rounded-xl overflow-hidden border border-emerald-500/20">
                <div className="border-b border-emerald-500/10 px-6 py-4 bg-emerald-950/20">
                  <p className="text-xs uppercase tracking-widest text-emerald-400/70">Recommended: File Online</p>
                </div>
                <div className="p-6">
                  <p className="text-cream/60 text-sm mb-4">
                    {county.name} accepts online appeals. This is the fastest way to file — no printing, mailing, or office visits required.
                  </p>
                  <a
                    href={county.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-5 py-2.5 rounded-lg hover:bg-emerald-500/20 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Go to {county.name} Filing Portal
                  </a>
                </div>
              </div>
            )}

            {/* Appeal form download */}
            {county.appealFormName && (
              <div className="card-premium rounded-xl p-6 flex items-center justify-between">
                <div>
                  <p className="text-cream font-medium">{county.appealFormName}</p>
                  <p className="text-xs text-cream/40 mt-0.5">Required appeal form for {county.name}</p>
                </div>
                {county.formDownloadUrl && (
                  <a
                    href={county.formDownloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-gold border border-gold/20 px-4 py-2 rounded-lg hover:bg-gold/10 transition-all flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Form
                  </a>
                )}
              </div>
            )}

            {/* Filing steps */}
            {county.filingSteps && county.filingSteps.length > 0 && (
              <div className="card-premium rounded-xl overflow-hidden">
                <div className="border-b border-gold/10 px-6 py-4 bg-gold/5">
                  <p className="text-xs uppercase tracking-widest text-gold/70">Step-by-Step Filing Process</p>
                </div>
                <div className="p-6 space-y-4">
                  {county.filingSteps
                    .sort((a, b) => a.step_number - b.step_number)
                    .map((step) => (
                    <div key={step.step_number} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-gold/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs text-gold font-bold">{step.step_number}</span>
                      </div>
                      <div>
                        <p className="text-sm text-cream font-medium">{step.title}</p>
                        <p className="text-xs text-cream/40 mt-0.5">{step.description}</p>
                        {step.url && (
                          <a href={step.url} target="_blank" rel="noopener noreferrer" className="text-xs text-gold hover:text-gold-light mt-1 inline-block">
                            {step.form_name || 'Open link'}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Required documents */}
            {county.requiredDocuments && county.requiredDocuments.length > 0 && (
              <div className="card-premium rounded-xl overflow-hidden">
                <div className="border-b border-gold/10 px-6 py-4 bg-gold/5">
                  <p className="text-xs uppercase tracking-widest text-gold/70">Documents to Include</p>
                </div>
                <div className="p-6">
                  <ul className="space-y-2">
                    {county.requiredDocuments.map((doc, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-cream/60">
                        <svg className="w-4 h-4 text-gold/50 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                        </svg>
                        {doc}
                      </li>
                    ))}
                    <li className="flex items-start gap-2 text-sm text-gold/70 font-medium">
                      <svg className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                      </svg>
                      Your Resourceful report (PDF) — attach as evidence
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* Hearing info */}
            {county.hearingTypicallyRequired && (
              <div className="card-premium rounded-xl overflow-hidden">
                <div className="border-b border-gold/10 px-6 py-4 bg-gold/5">
                  <p className="text-xs uppercase tracking-widest text-gold/70">About Your Hearing</p>
                </div>
                <div className="p-6 space-y-3">
                  <div className="grid md:grid-cols-2 gap-4">
                    {county.hearingFormat && (
                      <div>
                        <p className="text-xs text-cream/40">Format</p>
                        <p className="text-sm text-cream capitalize">{county.hearingFormat.replace(/_/g, ' ')}</p>
                      </div>
                    )}
                    {county.hearingDurationMinutes && (
                      <div>
                        <p className="text-xs text-cream/40">Typical Length</p>
                        <p className="text-sm text-cream">{county.hearingDurationMinutes} minutes</p>
                      </div>
                    )}
                    {county.virtualHearingAvailable && (
                      <div>
                        <p className="text-xs text-cream/40">Virtual Option</p>
                        <p className="text-sm text-cream">
                          Available{county.virtualHearingPlatform && ` via ${county.virtualHearingPlatform}`}
                        </p>
                      </div>
                    )}
                    {county.typicalResolutionWeeksMin != null && county.typicalResolutionWeeksMax != null && (
                      <div>
                        <p className="text-xs text-cream/40">Typical Resolution</p>
                        <p className="text-sm text-cream">{county.typicalResolutionWeeksMin}–{county.typicalResolutionWeeksMax} weeks</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Informal review */}
            {county.informalReviewAvailable && (
              <div className="rounded-xl border border-blue-500/20 bg-blue-950/10 p-5">
                <p className="text-sm font-medium text-blue-400 mb-1">Informal Review Available</p>
                <p className="text-sm text-blue-400/60">
                  {county.informalReviewNotes || `${county.name} offers an informal review process before the formal hearing. This is often a quicker way to get a reduction without a formal proceeding.`}
                </p>
              </div>
            )}

            {/* Contact info */}
            <div className="card-premium rounded-xl p-6">
              <p className="text-xs uppercase tracking-widest text-cream/40 mb-3">Appeal Board Contact</p>
              <div className="space-y-2 text-sm">
                <p className="text-cream font-medium">{county.appealBoardName}</p>
                {county.appealBoardAddress && <p className="text-cream/50">{county.appealBoardAddress}</p>}
                {county.appealBoardPhone && (
                  <p className="text-cream/50">
                    <a href={`tel:${county.appealBoardPhone}`} className="text-gold hover:text-gold-light transition-colors">
                      {county.appealBoardPhone}
                    </a>
                  </p>
                )}
                {county.filingEmail && (
                  <p className="text-cream/50">
                    <a href={`mailto:${county.filingEmail}`} className="text-gold hover:text-gold-light transition-colors">
                      {county.filingEmail}
                    </a>
                  </p>
                )}
              </div>
            </div>

            {/* Pro se tips */}
            {county.proSeTips && (
              <div className="card-premium rounded-xl p-6">
                <p className="text-xs uppercase tracking-widest text-gold/70 mb-3">Pro Se Tips for {county.name}</p>
                <p className="text-sm text-cream/60 whitespace-pre-wrap leading-relaxed">{county.proSeTips}</p>
              </div>
            )}
          </div>
        )}

        {/* ─── GUIDE TAB ──────────────────────────────────────────────── */}
        {activeTab === 'guide' && (
          <div className="animate-fade-in">
            {data.filingGuide ? (
              <div className="card-premium rounded-xl p-6 md:p-8">
                <div className="prose-legal text-sm text-cream/60 leading-relaxed whitespace-pre-wrap"
                     style={{ maxWidth: 'none' }}
                     dangerouslySetInnerHTML={{
                       __html: data.filingGuide
                         .replace(/&/g, '&amp;')
                         .replace(/</g, '&lt;')
                         .replace(/>/g, '&gt;')
                         .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-cream mt-8 mb-3">$1</h2>')
                         .replace(/^### (.+)$/gm, '<h3 class="text-base font-medium text-cream/80 mt-6 mb-2">$1</h3>')
                         .replace(/\*\*(.+?)\*\*/g, '<strong class="text-cream/80">$1</strong>')
                         .replace(/^\d+\.\s/gm, (match) => `<span class="text-gold font-medium">${match}</span>`)
                     }}
                />
              </div>
            ) : (
              <div className="card-premium rounded-xl p-8 text-center">
                <p className="text-cream/40">Filing guide is being generated. Check back shortly.</p>
              </div>
            )}
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-[10px] text-cream/15 leading-relaxed mt-12 max-w-2xl mx-auto text-center">
          This report is an informational analysis tool, not legal advice or a formal appraisal.
          You are responsible for verifying all data and meeting filing deadlines. Confirm all deadlines and
          requirements directly with your county&apos;s assessment office.
          See our <a href="/disclaimer" className="underline hover:text-cream/30">Disclaimer</a> and{' '}
          <a href="/terms" className="underline hover:text-cream/30">Terms of Service</a>.
        </p>
      </div>
    </main>
  );
}
