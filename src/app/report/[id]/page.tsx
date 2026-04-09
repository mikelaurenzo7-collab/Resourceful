'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Wordmark from '@/components/ui/Wordmark';

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
  reviewTier: string;
  assessedValue: number;
  concludedValue: number;
  potentialSavings: number;
  pdfUrl: string | null;
  filingGuide: string | null;
  deliveredAt: string | null;
  county: CountyInfo | null;
  outcomeReportedAt: string | null;
  appealOutcome: string | null;
  caseStrengthScore: number | null;
  compCount: number;
  photoCount: number;
  photoDefectCount: number | null;
  photoImpactDollars: number | null;
  photoImpactPct: number | null;
  valuationMethod: string | null;
  comparableSales: {
    address: string | null;
    salePrice: number | null;
    saleDate: string | null;
    buildingSqft: number | null;
    adjustedPricePerSqft: number | null;
    distanceMiles: number | null;
    netAdjustmentPct: number | null;
    isDistressedSale: boolean | null;
    isWeakComparable: boolean | null;
  }[];
  narratives: {
    sectionName: string;
    content: string;
  }[];
}

function formatDollar(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

function formatFee(cents: number): string {
  if (cents === 0) return 'Waived';
  return `$${(cents / 100).toFixed(2)}`;
}

const NARRATIVE_DISPLAY_NAMES: Record<string, string> = {
  executive_summary: 'Executive Summary',
  condition_assessment: 'Condition Assessment',
  appeal_argument_summary: 'Appeal Argument Summary',
  hearing_script: 'Hearing Presentation Script',
  sales_comparison_narrative: 'Sales Comparison Analysis',
  adjustment_grid_narrative: 'Adjustment Grid Analysis',
  income_approach_narrative: 'Income Approach',
  cost_approach_narrative: 'Cost Approach',
  reconciliation_narrative: 'Value Reconciliation',
  market_analysis: 'Market Analysis',
  assessment_equity: 'Assessment Equity Analysis',
  area_analysis_county: 'County Area Analysis',
  area_analysis_city: 'City Area Analysis',
  area_analysis_neighborhood: 'Neighborhood Analysis',
  hbu_as_vacant: 'Highest & Best Use (Vacant)',
  hbu_as_improved: 'Highest & Best Use (Improved)',
};

/** Priority narratives shown expanded in overview tab */
const PRIORITY_NARRATIVES = ['executive_summary', 'appeal_argument_summary', 'hearing_script'];

export default function ReportViewerPage() {
  const params = useParams();
  const reportId = params.id as string;
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pollExhausted, setPollExhausted] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'filing' | 'guide'>('overview');

  // Keyboard navigation for tabs
  const isTaxAppealForKeys = data?.serviceType === 'tax_appeal';
  useEffect(() => {
    if (!isTaxAppealForKeys) return;
    const tabs = ['overview', 'filing', 'guide'] as const;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        setActiveTab((prev) => {
          const idx = tabs.indexOf(prev);
          if (e.key === 'ArrowLeft') return tabs[(idx - 1 + tabs.length) % tabs.length];
          return tabs[(idx + 1) % tabs.length];
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTaxAppealForKeys]);

  // Outcome form state
  const [showOutcomeForm, setShowOutcomeForm] = useState(false);
  const [outcomeValue, setOutcomeValue] = useState('');
  const [newAssessedValue, setNewAssessedValue] = useState('');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [outcomeSubmitting, setOutcomeSubmitting] = useState(false);
  const [outcomeSubmitted, setOutcomeSubmitted] = useState(false);
  const [outcomeError, setOutcomeError] = useState('');

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
              <p className="text-cream/50 mb-2">{data.message || 'Your report is being generated and reviewed by our team.'}</p>
              <p className="text-cream/30 text-sm mb-6">
                You don&apos;t need to wait here. We&apos;ll email your completed report with the PDF, filing instructions, and everything you need.
              </p>
              <p className="text-cream/25 text-xs">This page updates automatically if you want to stay.</p>
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
      <nav className="bg-navy-deep/80 backdrop-blur-xl nav-shadow sticky top-0 z-50">
        <div className="mx-auto max-w-5xl px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-display text-xl text-cream hover:opacity-80 transition-opacity">
              <Wordmark />
            </Link>
            <span className="text-cream/15">|</span>
            <Link href="/dashboard" className="text-sm text-cream/40 hover:text-cream/70 transition-colors">
              ← Dashboard
            </Link>
          </div>
          <a
            href={`/api/reports/${reportId}/download`}
            className="flex items-center gap-2 text-sm font-medium text-navy-deep bg-gradient-to-r from-gold-light via-gold to-gold-dark px-4 py-2 rounded-lg hover:shadow-gold transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download PDF
          </a>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-semibold tracking-[0.18em] text-gold/60 uppercase">
              {isTaxAppeal ? 'Tax Appeal Report' : data.serviceType === 'pre_purchase' ? 'Pre-Purchase Analysis' : 'Pre-Listing Report'}
            </span>
            {data.deliveredAt && (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/15 rounded-full px-2.5 py-0.5 font-medium">
                Delivered {new Date(data.deliveredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </div>
          <h1 className="font-display text-2xl md:text-3xl text-cream leading-tight">{data.propertyAddress}</h1>
        </div>

        {/* Tabs */}
        {isTaxAppeal && (
          <div className="flex gap-1 mb-8 bg-navy-light/50 rounded-lg p-1 w-fit" role="tablist" aria-label="Report sections">
            {(['overview', 'filing', 'guide'] as const).map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer ${
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
                <p className="text-[10px] uppercase tracking-widest text-cream/35 mb-2">County Assessed Value</p>
                <p className="font-display text-3xl text-cream">
                  {data.assessedValue > 0 ? formatDollar(data.assessedValue) : '—'}
                </p>
                <p className="text-xs text-cream/25 mt-1.5">Per county records</p>
              </div>
              {data.concludedValue > 0 && (
                <div className="card-premium rounded-xl p-6 ring-1 ring-gold/20">
                  <p className="text-[10px] uppercase tracking-widest text-gold/60 mb-2">Our Concluded Value</p>
                  <p className="font-display text-3xl text-gold">{formatDollar(data.concludedValue)}</p>
                  <p className="text-xs text-cream/25 mt-1.5">
                    {(!data.valuationMethod || data.valuationMethod === 'sales_comparison' || data.valuationMethod === 'sales_income_blend')
                      ? 'Based on comparable sales'
                      : data.valuationMethod === 'cost'
                      ? 'Based on cost approach (no recent sales)'
                      : data.valuationMethod === 'income'
                      ? 'Based on income approach'
                      : 'Based on market analysis'}
                  </p>
                </div>
              )}
              {isTaxAppeal && data.potentialSavings > 0 && (
                <div className="card-premium rounded-xl p-6 border border-emerald-500/25 bg-emerald-500/[0.04]">
                  <p className="text-[10px] uppercase tracking-widest text-emerald-400/60 mb-2">Potential Annual Savings</p>
                  <p className="font-display text-3xl text-emerald-400">{formatDollar(data.potentialSavings)}</p>
                  <p className="text-xs text-emerald-400/40 mt-1.5">From reduced assessment</p>
                </div>
              )}
            </div>

            {/* ── Deadline Countdown ─────────────────────────────── */}
            {isTaxAppeal && county?.nextAppealDeadline && (() => {
              const deadline = new Date(county.nextAppealDeadline);
              const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / 86400000);
              if (daysLeft < 0) return null;
              const urgent = daysLeft <= 14;
              const soon = daysLeft <= 30;
              return (
                <div className={`rounded-xl border p-4 flex items-center gap-4 ${
                  urgent ? 'border-red-500/25 bg-red-950/20' : soon ? 'border-amber-500/20 bg-amber-950/15' : 'border-blue-500/15 bg-blue-950/10'
                }`}>
                  <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
                    urgent ? 'bg-red-500/15' : soon ? 'bg-amber-500/10' : 'bg-blue-500/10'
                  }`}>
                    <span className={`text-xl font-bold leading-none ${urgent ? 'text-red-400' : soon ? 'text-amber-400' : 'text-blue-400'}`}>{daysLeft}</span>
                    <span className={`text-[9px] uppercase tracking-wider mt-0.5 ${urgent ? 'text-red-400/60' : soon ? 'text-amber-400/60' : 'text-blue-400/60'}`}>days</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${urgent ? 'text-red-300' : soon ? 'text-amber-300' : 'text-blue-300'}`}>
                      {urgent ? 'Filing deadline is approaching fast' : soon ? 'Your filing deadline is coming up' : 'Time to prepare your appeal'}
                    </p>
                    <p className={`text-xs mt-0.5 ${urgent ? 'text-red-400/50' : soon ? 'text-amber-400/50' : 'text-blue-400/50'}`}>
                      {county.name} deadline: {deadline.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('filing')}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all flex-shrink-0 ${
                      urgent ? 'border-red-500/20 text-red-400 hover:bg-red-500/10' : soon ? 'border-amber-500/20 text-amber-400 hover:bg-amber-500/10' : 'border-blue-500/20 text-blue-400 hover:bg-blue-500/10'
                    }`}
                  >
                    Filing Steps
                  </button>
                </div>
              );
            })()}

            {/* ── Case Intelligence & Evidence ────────────────────── */}
            {(data.caseStrengthScore != null || data.compCount > 0 || data.photoCount > 0) && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {data.caseStrengthScore != null && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                    <div className="relative w-14 h-14 mx-auto mb-2">
                      <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                        <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-cream/[0.06]" />
                        <circle
                          cx="18" cy="18" r="15" fill="none" strokeWidth="2.5"
                          strokeDasharray={`${(data.caseStrengthScore / 100) * 94.25} 94.25`}
                          strokeLinecap="round"
                          className={data.caseStrengthScore >= 75 ? 'text-emerald-400' : data.caseStrengthScore >= 50 ? 'text-amber-400' : 'text-cream/40'}
                          stroke="currentColor"
                        />
                      </svg>
                      <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${
                        data.caseStrengthScore >= 75 ? 'text-emerald-400' : data.caseStrengthScore >= 50 ? 'text-amber-400' : 'text-cream/50'
                      }`}>
                        {data.caseStrengthScore}
                      </span>
                    </div>
                    <p className="text-[10px] uppercase tracking-widest text-cream/35">Case Strength</p>
                    <p className="text-[10px] mt-0.5 text-cream/20">
                      {data.caseStrengthScore >= 75 ? 'Strong' : data.caseStrengthScore >= 50 ? 'Moderate' : 'Developing'}
                    </p>
                  </div>
                )}
                {data.compCount > 0 && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                    <div className="w-14 h-14 mx-auto mb-2 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <span className="text-xl font-bold text-blue-400">{data.compCount}</span>
                    </div>
                    <p className="text-[10px] uppercase tracking-widest text-cream/35">Comparable Sales</p>
                    <p className="text-[10px] mt-0.5 text-cream/20">Market evidence</p>
                  </div>
                )}
                {data.photoCount > 0 && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                    <div className="w-14 h-14 mx-auto mb-2 rounded-xl bg-gold/10 flex items-center justify-center">
                      <span className="text-xl font-bold text-gold">{data.photoCount}</span>
                    </div>
                    <p className="text-[10px] uppercase tracking-widest text-cream/35">Photos Analyzed</p>
                    <p className="text-[10px] mt-0.5 text-cream/20">AI-inspected evidence</p>
                  </div>
                )}
                {data.photoDefectCount != null && data.photoDefectCount > 0 && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                    <div className="w-14 h-14 mx-auto mb-2 rounded-xl bg-amber-500/10 flex items-center justify-center">
                      <span className="text-xl font-bold text-amber-400">{data.photoDefectCount}</span>
                    </div>
                    <p className="text-[10px] uppercase tracking-widest text-cream/35">Issues Documented</p>
                    <p className="text-[10px] mt-0.5 text-cream/20">Condition evidence</p>
                  </div>
                )}
              </div>
            )}

            {/* Download CTA */}
            <div className="card-elevated rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-cream font-semibold">Your Full Report (PDF)</p>
                <p className="text-xs text-cream/40 mt-0.5">
                  Comparable sales grid, adjustment analysis, condition narrative, and county-specific filing instructions.
                </p>
              </div>
              <a
                href={`/api/reports/${reportId}/download`}
                className="flex items-center gap-2 text-sm font-semibold text-navy-deep bg-gradient-to-r from-gold-light via-gold to-gold-dark px-5 py-2.5 rounded-lg hover:shadow-gold hover:brightness-110 transition-all flex-shrink-0 w-full sm:w-auto justify-center"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download PDF
              </a>
            </div>

            {/* ── Comparable Sales Grid ──────────────────────────── */}
            {data.comparableSales && data.comparableSales.length > 0 && (
              <div className="card-premium rounded-xl overflow-hidden">
                <div className="border-b border-gold/10 px-6 py-4 bg-gold/5">
                  <p className="text-xs uppercase tracking-widest text-gold/70">Comparable Sales Analysis</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-cream/40 font-medium">#</th>
                        <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-cream/40 font-medium">Address</th>
                        <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-cream/40 font-medium">Sale Price</th>
                        <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-cream/40 font-medium hidden md:table-cell">Date</th>
                        <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-cream/40 font-medium hidden md:table-cell">Sq Ft</th>
                        <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-cream/40 font-medium">Adj $/SF</th>
                        <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-cream/40 font-medium hidden sm:table-cell">Net Adj</th>
                        <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-cream/40 font-medium hidden sm:table-cell">Distance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.comparableSales.map((comp, i) => (
                        <tr key={i} className={`border-b border-white/[0.03] ${comp.isWeakComparable ? 'opacity-50' : ''}`}>
                          <td className="px-4 py-3 text-cream/50">{i + 1}</td>
                          <td className="px-4 py-3 text-cream max-w-[200px] truncate">
                            {comp.address || 'Address withheld'}
                            {comp.isDistressedSale && (
                              <span className="ml-1.5 text-[9px] uppercase bg-amber-500/15 text-amber-400/70 px-1.5 py-0.5 rounded">Distressed</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-cream font-medium">
                            {comp.salePrice ? formatDollar(comp.salePrice) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-cream/50 hidden md:table-cell">
                            {comp.saleDate ? new Date(comp.saleDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-cream/50 hidden md:table-cell">
                            {comp.buildingSqft ? comp.buildingSqft.toLocaleString() : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gold">
                            {comp.adjustedPricePerSqft ? `$${comp.adjustedPricePerSqft.toFixed(0)}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-right hidden sm:table-cell">
                            {comp.netAdjustmentPct != null ? (
                              <span className={`${Math.abs(comp.netAdjustmentPct) > 25 ? 'text-amber-400/70' : 'text-cream/50'}`}>
                                {comp.netAdjustmentPct > 0 ? '+' : ''}{comp.netAdjustmentPct.toFixed(1)}%
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-cream/40 hidden sm:table-cell">
                            {comp.distanceMiles != null ? `${comp.distanceMiles.toFixed(1)} mi` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Key Narrative Sections ─────────────────────────── */}
            {data.narratives && data.narratives.length > 0 && (() => {
              const priority = data.narratives.filter(n => PRIORITY_NARRATIVES.includes(n.sectionName));
              const other = data.narratives.filter(n => !PRIORITY_NARRATIVES.includes(n.sectionName));
              if (priority.length === 0 && other.length === 0) return null;
              return (
                <div className="space-y-4">
                  {/* Priority narratives shown expanded */}
                  {priority.map(n => (
                    <div key={n.sectionName} className="card-premium rounded-xl overflow-hidden">
                      <div className="border-b border-gold/10 px-6 py-4 bg-gold/5">
                        <p className="text-xs uppercase tracking-widest text-gold/70">
                          {NARRATIVE_DISPLAY_NAMES[n.sectionName] ?? n.sectionName.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <div className="px-6 py-5 text-sm text-cream/70 leading-relaxed whitespace-pre-wrap">
                        {n.content}
                      </div>
                    </div>
                  ))}

                  {/* Other narratives as collapsible sections */}
                  {other.length > 0 && (
                    <details className="card-premium rounded-xl overflow-hidden group">
                      <summary className="border-b border-white/[0.04] px-6 py-4 bg-white/[0.02] cursor-pointer flex items-center justify-between list-none">
                        <p className="text-xs uppercase tracking-widest text-cream/40">
                          {other.length} Additional Analysis Section{other.length !== 1 ? 's' : ''}
                        </p>
                        <svg className="w-4 h-4 text-cream/30 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="divide-y divide-white/[0.04]">
                        {other.map(n => (
                          <div key={n.sectionName} className="px-6 py-5">
                            <p className="text-xs uppercase tracking-widest text-cream/35 mb-3">
                              {NARRATIVE_DISPLAY_NAMES[n.sectionName] ?? n.sectionName.replace(/_/g, ' ')}
                            </p>
                            <div className="text-sm text-cream/60 leading-relaxed whitespace-pre-wrap">
                              {n.content}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              );
            })()}

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
                <div className="prose-legal text-sm text-cream/60 leading-relaxed" style={{ maxWidth: 'none' }}>
                  {data.filingGuide.split('\n').map((line, i) => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('### ')) {
                      return <h3 key={i} className="text-base font-medium text-cream/80 mt-6 mb-2">{trimmed.slice(4)}</h3>;
                    }
                    if (trimmed.startsWith('## ')) {
                      return <h2 key={i} className="text-lg font-semibold text-cream mt-8 mb-3">{trimmed.slice(3)}</h2>;
                    }
                    if (trimmed.startsWith('# ')) {
                      return <h1 key={i} className="text-xl font-bold text-cream mt-2 mb-1">{trimmed.slice(2)}</h1>;
                    }
                    if (trimmed === '---') {
                      return <hr key={i} className="border-cream/10 my-6" />;
                    }
                    if (!trimmed) return <br key={i} />;
                    // Render bold (**text**) safely via React
                    const parts = trimmed.split(/\*\*(.+?)\*\*/g);
                    return (
                      <p key={i} className="mb-2">
                        {parts.map((part, j) =>
                          j % 2 === 1
                            ? <strong key={j} className="text-cream/80">{part}</strong>
                            : <span key={j}>{part}</span>
                        )}
                      </p>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="card-premium rounded-xl p-8 text-center">
                <p className="text-cream/40">Filing guide is being generated. Check back shortly.</p>
              </div>
            )}
          </div>
        )}

        {/* ─── OUTCOME COLLECTION ────────────────────────────────── */}
        {isTaxAppeal && data.deliveredAt && !data.outcomeReportedAt && !outcomeSubmitted && (() => {
          const deliveredDate = new Date(data.deliveredAt!);
          const daysSinceDelivery = Math.floor((Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysSinceDelivery >= 30;
        })() && (
          <div className="mt-10 animate-fade-in">
            {!showOutcomeForm ? (
              <div className="card-premium rounded-xl p-6 border border-gold/10">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-cream font-medium">How Did Your Appeal Go?</h3>
                    <p className="text-sm text-cream/40 mt-1">
                      Your feedback helps us improve our analysis for future homeowners in your area. It takes less than 30 seconds.
                    </p>
                    <button
                      onClick={() => setShowOutcomeForm(true)}
                      className="mt-3 text-sm font-medium text-gold border border-gold/20 px-4 py-2 rounded-lg hover:bg-gold/10 transition-all"
                    >
                      Share Your Result
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card-premium rounded-xl overflow-hidden border border-gold/10">
                <div className="border-b border-gold/10 px-6 py-4 bg-gold/5">
                  <p className="text-xs uppercase tracking-widest text-gold/70">Appeal Outcome</p>
                </div>
                <div className="p-6 space-y-5">
                  {outcomeError && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                      <p className="text-sm text-red-400">{outcomeError}</p>
                    </div>
                  )}

                  {/* Outcome selection */}
                  <div className="space-y-2">
                    <p className="text-sm text-cream/60">What happened with your appeal?</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {[
                        { value: 'won', label: 'Won', icon: '&#10003;', color: 'emerald' },
                        { value: 'lost', label: 'Lost', icon: '&#10007;', color: 'red' },
                        { value: 'pending', label: 'Still Pending', icon: '&#8987;', color: 'amber' },
                        { value: 'withdrew', label: 'Withdrew', icon: '&#8592;', color: 'gray' },
                        { value: 'didnt_file', label: "Didn\u0027t File", icon: '&#8212;', color: 'gray' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setOutcomeValue(opt.value)}
                          className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                            outcomeValue === opt.value
                              ? opt.color === 'emerald' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                              : opt.color === 'red' ? 'bg-red-500/15 border-red-500/30 text-red-400'
                              : opt.color === 'amber' ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                              : 'bg-cream/10 border-cream/20 text-cream/70'
                              : 'border-cream/10 text-cream/40 hover:border-cream/20 hover:text-cream/60'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* New assessed value (only if won) */}
                  {outcomeValue === 'won' && (
                    <div>
                      <label className="block text-sm text-cream/60 mb-1">New Assessed Value (if known)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/30">$</span>
                        <input
                          type="text"
                          value={newAssessedValue}
                          onChange={(e) => setNewAssessedValue(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="e.g. 265000"
                          className="w-full bg-navy-light/50 border border-cream/10 rounded-lg px-3 pl-7 py-2.5 text-sm text-cream placeholder:text-cream/20 focus:border-gold/30 focus:outline-none transition-colors"
                        />
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="block text-sm text-cream/60 mb-1">Anything else you want to share? (optional)</label>
                    <textarea
                      value={outcomeNotes}
                      onChange={(e) => setOutcomeNotes(e.target.value)}
                      rows={2}
                      placeholder="e.g. The board reduced it by more than we asked for..."
                      className="w-full bg-navy-light/50 border border-cream/10 rounded-lg px-3 py-2.5 text-sm text-cream placeholder:text-cream/20 focus:border-gold/30 focus:outline-none transition-colors resize-none"
                    />
                  </div>

                  {/* Submit */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={async () => {
                        if (!outcomeValue) {
                          setOutcomeError('Please select an outcome.');
                          return;
                        }
                        setOutcomeSubmitting(true);
                        setOutcomeError('');
                        try {
                          // Check for token in URL params
                          const urlParams = new URLSearchParams(window.location.search);
                          const token = urlParams.get('token');

                          const res = await fetch(`/api/reports/${reportId}/outcome`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              outcome: outcomeValue,
                              new_assessed_value: newAssessedValue ? Number(newAssessedValue) : undefined,
                              notes: outcomeNotes || undefined,
                              token: token || undefined,
                            }),
                          });
                          if (!res.ok) {
                            const errData = await res.json();
                            throw new Error(errData.error || 'Failed to submit');
                          }
                          setOutcomeSubmitted(true);
                        } catch (err) {
                          setOutcomeError(err instanceof Error ? err.message : 'Failed to submit outcome.');
                        } finally {
                          setOutcomeSubmitting(false);
                        }
                      }}
                      disabled={outcomeSubmitting || !outcomeValue}
                      className="flex items-center gap-2 text-sm font-medium bg-gold/10 text-gold border border-gold/20 px-5 py-2.5 rounded-lg hover:bg-gold/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {outcomeSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit'
                      )}
                    </button>
                    <button
                      onClick={() => setShowOutcomeForm(false)}
                      className="text-sm text-cream/30 hover:text-cream/50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Outcome submitted thank-you */}
        {outcomeSubmitted && (
          <div className="mt-10 card-premium rounded-xl p-6 border border-emerald-500/20 animate-fade-in">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-cream font-medium">Thank You for Sharing!</h3>
                <p className="text-sm text-cream/40 mt-1">
                  Your feedback helps us build more accurate reports for homeowners across the country.
                  {outcomeValue === 'won' && ' Congratulations on your successful appeal!'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Referral CTA — shown for delivered reports */}
        {data.status === 'delivered' && data.potentialSavings > 0 && (
          <div className="mt-10 card-premium rounded-xl p-6 border border-gold/20 animate-fade-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-cream font-medium">Know someone who&apos;s overpaying on property taxes?</h3>
                <p className="text-sm text-cream/40 mt-1">
                  Share Resourceful with a neighbor or friend. They&apos;ll get 10% off their report, and you&apos;ll earn a $5 credit toward your next analysis.
                </p>
              </div>
              <Link
                href="/start"
                className="text-sm font-medium bg-gold/10 text-gold border border-gold/20 px-5 py-2.5 rounded-lg hover:bg-gold/20 transition-all whitespace-nowrap"
              >
                Share &amp; Earn
              </Link>
            </div>
          </div>
        )}

        {/* Upsell CTA — auto-tier tax appeal users who might want guided/full-rep */}
        {data.serviceType === 'tax_appeal' && data.reviewTier === 'auto' && data.status === 'delivered' && (
          <div className="mt-6 card-premium rounded-xl p-6 border border-gold/10 animate-fade-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-cream font-medium">Want help filing your appeal?</h3>
                <p className="text-sm text-cream/40 mt-1">
                  Upgrade to <strong className="text-cream/60">Guided Filing</strong> for a live coaching session, or let us handle everything with <strong className="text-cream/60">Full Representation</strong>.
                </p>
              </div>
              <Link
                href={`/start?service=tax_appeal&tier=guided-filing`}
                className="text-sm font-medium bg-gold/10 text-gold border border-gold/20 px-5 py-2.5 rounded-lg hover:bg-gold/20 transition-all whitespace-nowrap"
              >
                Explore Options
              </Link>
            </div>
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
