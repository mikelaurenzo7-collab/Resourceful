import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Report, ReportStatus } from '@/types/database';

export const dynamic = 'force-dynamic';
import PipelineProgress from '@/components/dashboard/PipelineProgress';
import ReportDownload from '@/components/dashboard/ReportDownload';
import AppealJourney from '@/components/dashboard/AppealJourney';
import DashboardAutoRefresh from '@/components/dashboard/DashboardAutoRefresh';
import { ScrollAnimations } from '@/components/ui/ScrollAnimations';
import Wordmark from '@/components/ui/Wordmark';

// ── Static maps ──────────────────────────────────────────────────────────────

const STATUS_MESSAGES: Partial<Record<ReportStatus, { title: string; description: string }>> = {
  intake: {
    title: 'Intake In Progress',
    description: 'Complete the intake steps — photos, measurements, and payment — to start your report.',
  },
  paid: {
    title: 'Payment Received',
    description: 'Your payment has been confirmed. Data collection will begin shortly.',
  },
  data_pull: {
    title: 'Collecting Data',
    description: 'Pulling property records, comparable sales, and assessment data for your address.',
  },
  photo_pending: {
    title: 'Analyzing Photos',
    description: 'Your property photos are being analyzed for condition assessment and documentation.',
  },
  processing: {
    title: 'Generating Your Report',
    description: 'Our analysis engine is building your report. Most are delivered within 48 hours.',
  },
  pending_approval: {
    title: 'Under Quality Review',
    description: "Your report is complete and under final review by our team. You'll be notified when it's ready.",
  },
  approved: {
    title: 'Report Approved',
    description: 'Your report has been approved and is being finalized for delivery.',
  },
  delivered: {
    title: 'Report Delivered',
    description: 'Your report is ready. Download it below and follow the filing guide to submit your appeal.',
  },
  failed: {
    title: 'Processing Error',
    description:
      'We encountered an issue generating your report. Our team has been notified and will resolve it shortly.',
  },
};

const SERVICE_LABELS: Record<string, string> = {
  tax_appeal: 'Tax Appeal Report',
  pre_purchase: 'Pre-Purchase Analysis',
  pre_listing: 'Pre-Listing Report',
};

const TERMINAL_STATUSES = new Set(['delivered', 'failed', 'rejected']);

const OUTCOME_DISPLAY: Record<string, { label: string; classes: string }> = {
  won:        { label: 'Won',         classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  lost:       { label: 'Lost',        classes: 'bg-red-500/10 text-red-400 border-red-500/20' },
  pending:    { label: 'Pending',     classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  withdrew:   { label: 'Withdrew',    classes: 'bg-cream/5 text-cream/30 border-cream/10' },
  didnt_file: { label: "Didn't File", classes: 'bg-cream/5 text-cream/30 border-cream/10' },
};

const stageMap: Record<string, number> = {
  'stage-1-data': 1,
  'stage-2-comps': 2,
  'stage-3-income': 3,
  'stage-4-photos': 4,
  'stage-5-narratives': 5,
  'stage-6-filing': 6,
  'stage-7-pdf': 7,
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/dashboard');
  }

  const userEmail = user.email ?? '';
  const userInitial = userEmail[0]?.toUpperCase() ?? 'U';

  // Link any unclaimed reports to this user (email-only → authenticated)
  if (userEmail) {
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const admin = createAdminClient();
      await admin
        .from('reports')
        .update({ user_id: user.id })
        .eq('client_email', userEmail.toLowerCase())
        .is('user_id', null);
    } catch (linkErr) {
      console.warn('[dashboard] Report linking failed (non-fatal):', linkErr);
    }
  }

  // Fetch user's reports — broader field set so we can drive all UI
  const { data: reports, error } = await supabase
    .from('reports')
    .select(
      'id, status, service_type, property_type, property_address, city, state, county, ' +
      'pipeline_last_completed_stage, report_pdf_storage_path, created_at, client_email, ' +
      'delivered_at, filing_status, filed_at, filing_method, ' +
      'appeal_outcome, actual_savings_cents, outcome_reported_at, case_value_at_stake'
    )
    .or(`user_id.eq.${user.id},client_email.eq.${userEmail.toLowerCase()}`)
    .order('created_at', { ascending: false })
    .limit(50);

  const userReports = (reports ?? []) as unknown as Report[];

  if (error) {
    console.error('[dashboard] Failed to fetch reports:', error.message);
  }

  // ── Split active / past ──────────────────────────────────────────────────
  const activeReport =
    userReports.find((r) => !TERMINAL_STATUSES.has(r.status)) ??
    (userReports.length > 0 ? userReports[0] : null);

  const pastReports = userReports.filter((r) => r.id !== activeReport?.id);

  const statusInfo = activeReport
    ? STATUS_MESSAGES[activeReport.status] ?? { title: 'Processing', description: 'Your report is being processed.' }
    : null;

  const isInProgress = activeReport && !TERMINAL_STATUSES.has(activeReport.status);

  const getStageNumber = (r: Report): number | null => {
    if (!r.pipeline_last_completed_stage) return null;
    return stageMap[r.pipeline_last_completed_stage] ?? null;
  };

  // ── Lifetime savings summary ─────────────────────────────────────────────
  const wonReports = userReports.filter((r) => r.appeal_outcome === 'won');
  const totalSavingsCents = wonReports.reduce((s, r) => s + (r.actual_savings_cents ?? 0), 0);
  const showSavingsBanner = wonReports.length > 0 && totalSavingsCents > 0;

  // ── Days since delivery (for active delivered report) ────────────────────
  const daysSinceDelivery = activeReport?.delivered_at
    ? Math.floor((Date.now() - new Date(activeReport.delivered_at).getTime()) / 86_400_000)
    : 0;

  return (
    <div className="min-h-screen bg-pattern">
      <ScrollAnimations />

      {/* ─── Header ───────────────────────────────────────────────────── */}
      <header className="bg-navy-deep/80 backdrop-blur-xl nav-shadow sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-light to-gold-dark flex items-center justify-center">
              <span className="text-navy-deep font-bold text-sm">R</span>
            </div>
            <Wordmark className="font-display text-lg text-cream group-hover:text-gold-light transition-colors" />
          </Link>
          <div className="flex items-center gap-3 md:gap-5">
            <Link
              href="/start"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-navy-deep bg-gradient-to-r from-gold-light via-gold to-gold-dark px-4 py-2 rounded-lg hover:shadow-gold hover:brightness-110 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Report
            </Link>
            <Link
              href="/start"
              className="sm:hidden w-9 h-9 rounded-lg bg-gradient-to-br from-gold-light to-gold-dark flex items-center justify-center"
              aria-label="New Report"
            >
              <svg className="w-5 h-5 text-navy-deep" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </Link>

            {/* Account menu */}
            <div className="relative group">
              <button
                className="flex items-center gap-2 rounded-full px-2 py-1.5 hover:bg-gold/5 transition-colors focus:outline-none focus:ring-2 focus:ring-gold/30"
                aria-label="Account menu"
                aria-haspopup="true"
              >
                <div className="w-8 h-8 rounded-full bg-gold/15 border border-gold/25 flex items-center justify-center">
                  <span className="text-sm font-semibold text-gold">{userInitial}</span>
                </div>
                <svg className="w-3.5 h-3.5 text-cream/30 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown */}
              <div className="absolute right-0 top-full mt-2 w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 z-50">
                <div className="card-premium rounded-xl p-1 shadow-lg border border-gold/10">
                  <div className="px-4 py-3 border-b border-gold/[0.06]">
                    <p className="text-sm font-medium text-cream truncate">{userEmail}</p>
                    <p className="text-xs text-cream/30 mt-0.5">Personal Account</p>
                  </div>
                  <div className="py-1">
                    <Link href="/dashboard" className="flex items-center gap-3 px-4 py-2.5 text-sm text-cream/60 hover:text-cream hover:bg-gold/5 rounded-lg transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      Dashboard
                    </Link>
                    <Link href="/start" className="flex items-center gap-3 px-4 py-2.5 text-sm text-cream/60 hover:text-cream hover:bg-gold/5 rounded-lg transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                      </svg>
                      New Report
                    </Link>
                  </div>
                  <div className="border-t border-gold/[0.06] py-1">
                    <form action="/auth/signout" method="post">
                      <button
                        type="submit"
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-colors text-left"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Main Content ─────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-6 py-12">

        {/* ── Page heading ──────────────────────────────────────────── */}
        <div className="mb-10 animate-fade-in">
          <div className="flex items-baseline gap-4 flex-wrap">
            <div>
              <span className="text-[11px] font-semibold tracking-[0.2em] text-gold/60 uppercase block mb-2">Your Reports</span>
              <h1 className="font-display text-3xl text-cream">Dashboard</h1>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
            <p className="text-cream/40 text-sm">Track your reports, download completed analyses, and file your appeal.</p>
            <DashboardAutoRefresh hasActiveReport={!!isInProgress} />
          </div>
        </div>

        {/* ── Lifetime savings banner ───────────────────────────────── */}
        {showSavingsBanner && (
          <div className="mb-8 rounded-xl border border-emerald-500/20 bg-emerald-950/10 px-5 py-4 flex items-center gap-4 animate-fade-in">
            <div className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-emerald-300">
                ${(totalSavingsCents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })} saved
                {wonReports.length > 1 && ` across ${wonReports.length} appeals`}
              </p>
              <p className="text-xs text-emerald-400/50 mt-0.5">
                Based on outcomes you reported
              </p>
            </div>
          </div>
        )}

        {/* ── Active report ─────────────────────────────────────────── */}
        {activeReport && (
          <div className="space-y-4 mb-14 animate-slide-up">

            {/* Status card */}
            <div className="card-premium rounded-xl p-6 md:p-8">
              <div className="flex flex-col sm:flex-row items-start gap-5 mb-8">
                {isInProgress ? (
                  <div className="w-12 h-12 rounded-full bg-gold/15 flex items-center justify-center flex-shrink-0">
                    <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : activeReport.status === 'failed' || activeReport.status === 'rejected' ? (
                  <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="font-display text-xl text-cream">{statusInfo?.title}</h2>
                  <p className="text-sm text-cream/50 mt-1">{statusInfo?.description}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3">
                    <span className="text-xs text-cream/30">
                      {SERVICE_LABELS[activeReport.service_type] || activeReport.service_type}
                    </span>
                    <span className="text-xs text-cream/20 hidden sm:inline">&middot;</span>
                    <span className="text-xs text-cream/30 truncate">{activeReport.property_address}</span>
                    {activeReport.county && (
                      <>
                        <span className="text-xs text-cream/20 hidden sm:inline">&middot;</span>
                        <span className="text-xs text-cream/20">{activeReport.county}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <PipelineProgress
                currentStatus={activeReport.status}
                pipelineLastCompletedStage={getStageNumber(activeReport)}
              />
            </div>

            {/* Failed report: contact prompt */}
            {(activeReport.status === 'failed' || activeReport.status === 'rejected') && (
              <div className="rounded-xl border border-red-500/15 bg-red-950/10 px-5 py-4 flex items-start gap-3" data-animate>
                <svg className="w-4 h-4 text-red-400/70 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm text-red-400/80">Our team has been notified and will reach out within 24 hours. You can also email us directly at{' '}
                    <a href="mailto:support@resourceful.app" className="underline hover:text-red-300 transition-colors">support@resourceful.app</a>.
                  </p>
                </div>
              </div>
            )}

            {/* Delivered: view + appeal journey */}
            {activeReport.status === 'delivered' && (
              <>
                {/* View report CTA */}
                <div className="card-premium rounded-xl p-5 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" data-animate>
                  <div className="min-w-0">
                    <p className="text-cream font-medium">View Your Full Report</p>
                    <p className="text-xs text-cream/40 mt-0.5">
                      Comparable sales, adjustment analysis, condition narrative, and county-specific filing instructions.
                    </p>
                  </div>
                  <Link
                    href={`/report/${activeReport.id}`}
                    className="flex items-center gap-2 text-sm font-medium bg-gradient-to-r from-gold-light via-gold to-gold-dark text-navy-deep px-5 py-2.5 rounded-lg shadow-gold hover:shadow-gold-lg transition-all flex-shrink-0 w-full sm:w-auto justify-center"
                  >
                    View Report
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                </div>

                {/* Appeal journey tracker (tax appeals only) */}
                {activeReport.service_type === 'tax_appeal' && (
                  <div data-animate data-delay="50">
                    <AppealJourney
                      reportId={activeReport.id}
                      filingStatus={activeReport.filing_status ?? 'not_started'}
                      filedAt={activeReport.filed_at ?? null}
                      filingMethod={activeReport.filing_method ?? null}
                      appealOutcome={activeReport.appeal_outcome ?? null}
                      outcomeReportedAt={activeReport.outcome_reported_at ?? null}
                      deliveredAt={activeReport.delivered_at ?? null}
                      daysSinceDelivery={daysSinceDelivery}
                    />
                  </div>
                )}

                {/* PDF download card */}
                <div data-animate data-delay="100">
                  <ReportDownload
                    pdfUrl={`/api/reports/${activeReport.id}/download`}
                    reportType={activeReport.service_type}
                    propertyAddress={activeReport.property_address}
                    countyName={activeReport.county ?? undefined}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Report History ────────────────────────────────────────── */}
        {pastReports.length > 0 && (
          <div data-animate>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl text-cream">Report History</h2>
              <span className="text-xs text-cream/20">{pastReports.length} report{pastReports.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-3">
              {pastReports.map((report, i) => {
                const isDelivered = report.status === 'delivered';
                const isFailed = report.status === 'failed' || report.status === 'rejected';
                const outcomeDisplay = report.appeal_outcome ? OUTCOME_DISPLAY[report.appeal_outcome] : null;
                const hasSavings = report.actual_savings_cents && report.actual_savings_cents > 0;

                return (
                  <div
                    key={report.id}
                    data-animate
                    data-delay={String((i + 1) * 70)}
                    className="card-premium rounded-xl p-4 md:p-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: icon + info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isDelivered ? 'bg-emerald-500/15'
                            : isFailed ? 'bg-red-500/10'
                            : 'bg-gold/10'
                          }`}
                        >
                          {isDelivered ? (
                            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                            </svg>
                          ) : isFailed ? (
                            <svg className="w-4 h-4 text-red-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-gold/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-cream font-medium truncate">{report.property_address}</p>
                          <p className="text-xs text-cream/35 mt-0.5">
                            {SERVICE_LABELS[report.service_type] || report.service_type}
                            {' '}&middot;{' '}
                            {new Date(report.created_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                            {report.county && ` · ${report.county}`}
                          </p>
                        </div>
                      </div>

                      {/* Right: badges + actions */}
                      <div className="flex items-center gap-2.5 pl-12 sm:pl-0 flex-wrap">
                        {/* Appeal outcome badge */}
                        {outcomeDisplay && (
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border whitespace-nowrap ${outcomeDisplay.classes}`}>
                            {outcomeDisplay.label}
                          </span>
                        )}

                        {/* Savings chip — only when won */}
                        {hasSavings && report.appeal_outcome === 'won' && (
                          <span className="text-xs font-medium text-emerald-400/80 bg-emerald-500/[0.07] border border-emerald-500/15 px-2.5 py-1 rounded-full whitespace-nowrap">
                            ${((report.actual_savings_cents ?? 0) / 100).toLocaleString('en-US')} saved
                          </span>
                        )}

                        {/* Status badge (only if no outcome yet) */}
                        {!outcomeDisplay && (
                          <span
                            className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${
                              isDelivered
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : isFailed
                                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                  : 'bg-gold/10 text-gold border border-gold/20'
                            }`}
                          >
                            {report.status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}
                          </span>
                        )}

                        {/* Actions */}
                        {isDelivered && (
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/report/${report.id}`}
                              className="text-xs font-medium text-gold hover:text-gold-light transition-colors"
                            >
                              View
                            </Link>
                            {report.report_pdf_storage_path && (
                              <a
                                href={`/api/reports/${report.id}/download`}
                                className="text-xs text-cream/30 hover:text-cream/50 transition-colors flex items-center gap-1"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                PDF
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────── */}
        {userReports.length === 0 && !error && (
          <div className="text-center py-24 animate-fade-in">
            <div className="relative w-24 h-24 mx-auto mb-10">
              <div className="absolute -inset-4 rounded-full bg-gold/[0.04] blur-xl" />
              <div
                className="relative w-24 h-24 rounded-2xl bg-gold/[0.08] border border-gold/[0.12] flex items-center justify-center"
                style={{ boxShadow: '0 0 30px rgba(212, 168, 71, 0.06)' }}
              >
                <svg className="w-11 h-11 text-gold/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <h2 className="font-display text-2xl text-cream mb-3">No Reports Yet</h2>
            <p className="text-cream/40 mb-2 max-w-sm mx-auto">
              Get your first property analysis in minutes.
            </p>
            <p className="text-cream/25 text-sm mb-10 max-w-xs mx-auto">
              We compare your home against recent sales, document property conditions, and build a professional evidence package.
            </p>
            <Link
              href="/start"
              className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-gold-light via-gold to-gold-dark px-8 py-4 text-base font-semibold text-navy-deep shadow-gold hover:shadow-gold-lg transition-all duration-300 hover:scale-[1.02] btn-glow"
            >
              Run the Numbers
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <p className="text-xs text-cream/20 mt-4">Takes about 5 minutes to complete</p>
          </div>
        )}

        {/* ── Error state ───────────────────────────────────────────── */}
        {error && userReports.length === 0 && (
          <div className="card-premium rounded-xl p-8 text-center mt-8 animate-fade-in">
            <svg className="w-8 h-8 text-red-400/50 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-cream/50 mb-4">We had trouble loading your reports. Please refresh the page.</p>
            <a
              href="/dashboard"
              className="text-sm font-medium text-gold border border-gold/20 px-4 py-2 rounded-lg hover:bg-gold/10 transition-all inline-block"
            >
              Refresh
            </a>
          </div>
        )}
      </main>

      {/* ─── Footer ───────────────────────────────────────────────────── */}
      <footer className="max-w-5xl mx-auto px-6 pb-12">
        <div className="border-t border-gold/[0.06] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs text-cream/20">
            <Link href="/" className="hover:text-cream/40 transition-colors">Home</Link>
            <span>&middot;</span>
            <Link href="/start" className="hover:text-cream/40 transition-colors">New Report</Link>
            <span>&middot;</span>
            <a href="mailto:support@resourceful.app" className="hover:text-cream/40 transition-colors">Support</a>
          </div>
          <div className="flex items-center gap-4 text-xs text-cream/15">
            <Link href="/terms" className="hover:text-cream/30 transition-colors">Terms</Link>
            <span>&middot;</span>
            <Link href="/privacy" className="hover:text-cream/30 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
