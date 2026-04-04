import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Report, ReportStatus } from '@/types/database';

export const dynamic = 'force-dynamic';
import PipelineProgress from '@/components/dashboard/PipelineProgress';
import ReportDownload from '@/components/dashboard/ReportDownload';
import { ScrollAnimations } from '@/components/ui/ScrollAnimations';

const STATUS_MESSAGES: Partial<Record<ReportStatus, { title: string; description: string }>> = {
  intake: {
    title: 'Intake In Progress',
    description: 'Complete the intake steps (photos, measurements, payment) to start your report.',
  },
  paid: {
    title: 'Payment Received',
    description: 'Your payment has been confirmed. Data collection will begin shortly.',
  },
  data_pull: {
    title: 'Collecting Data',
    description: 'We are pulling property records, comparable sales, and assessment data for your report.',
  },
  photo_pending: {
    title: 'Analyzing Photos',
    description: 'Your property photos are being analyzed for condition assessment and documentation.',
  },
  processing: {
    title: 'Generating Your Report',
    description: 'Your report is being prepared by our analysis engine. This typically takes 2-6 hours.',
  },
  pending_approval: {
    title: 'Under Quality Review',
    description: 'Your report is complete and under final review by our team. You\'ll be notified when it\'s ready.',
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
    description: 'We encountered an issue generating your report. Our team has been notified and will resolve it shortly.',
  },
};

const SERVICE_LABELS: Record<string, string> = {
  tax_appeal: 'Tax Appeal Report',
  pre_purchase: 'Pre-Purchase Analysis',
  pre_listing: 'Pre-Listing Report',
};

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

  // Fetch user's reports
  const { data: reports, error } = await supabase
    .from('reports')
    .select('id, status, service_type, property_type, property_address, city, state, county, pipeline_last_completed_stage, report_pdf_storage_path, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const userReports = (reports ?? []) as Report[];

  if (error) {
    console.error('[dashboard] Failed to fetch reports:', error.message);
  }

  // Split into active (most recent non-delivered) and past
  const activeReport = userReports.find(
    (r) => !['delivered', 'failed', 'rejected'].includes(r.status)
  ) ?? (userReports.length > 0 ? userReports[0] : null);

  const pastReports = userReports.filter((r) => r.id !== activeReport?.id);

  const statusInfo = activeReport
    ? STATUS_MESSAGES[activeReport.status] || { title: 'Processing', description: 'Your report is being processed.' }
    : null;

  const isInProgress = activeReport && !['delivered', 'failed', 'rejected'].includes(activeReport.status);

  const stageMap: Record<string, number> = {
    'stage-1-data': 1,
    'stage-2-comps': 2,
    'stage-3-income': 3,
    'stage-4-photos': 4,
    'stage-5-narratives': 5,
    'stage-6-filing': 6,
    'stage-7-pdf': 7,
  };

  const getStageNumber = (r: Report): number | null => {
    if (!r.pipeline_last_completed_stage) return null;
    return stageMap[r.pipeline_last_completed_stage] ?? null;
  };

  return (
    <div className="min-h-screen bg-pattern">
      <ScrollAnimations />

      {/* ─── Header ────────────────────────────────────────────────── */}
      <header className="bg-navy-deep/80 backdrop-blur-xl nav-shadow sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-light to-gold-dark flex items-center justify-center">
              <span className="text-navy-deep font-bold text-sm">R</span>
            </div>
            <span className="font-display text-lg text-cream group-hover:text-gold transition-colors">Resourceful</span>
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
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gold/5 transition-colors focus:outline-none focus:ring-2 focus:ring-gold/30 rounded-full"
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

      {/* ─── Main Content ──���───────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-10 animate-fade-in">
          <h1 className="font-display text-3xl text-cream mb-2">Your Dashboard</h1>
          <p className="text-cream/50">Track your reports and download completed analyses.</p>
        </div>

        {/* ─── Active Report ───────────────────────────────────────── */}
        {activeReport && (
          <div className="space-y-6 mb-16 animate-slide-up">
            <div className="card-premium rounded-xl p-6 md:p-8">
              <div className="flex flex-col sm:flex-row items-start gap-5 mb-8">
                {isInProgress ? (
                  <div className="w-12 h-12 rounded-full bg-gold/15 flex items-center justify-center flex-shrink-0">
                    <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
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
                  <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-3">
                    <span className="text-xs text-cream/30">
                      {SERVICE_LABELS[activeReport.service_type] || activeReport.service_type}
                    </span>
                    <span className="text-xs text-cream/20 hidden sm:inline">&middot;</span>
                    <span className="text-xs text-cream/30 truncate">{activeReport.property_address}</span>
                  </div>
                </div>
              </div>

              <PipelineProgress
                currentStatus={activeReport.status}
                pipelineLastCompletedStage={getStageNumber(activeReport)}
              />
            </div>

            {/* Delivered: View + Download */}
            {activeReport.status === 'delivered' && (
              <>
                <div className="card-premium rounded-xl p-5 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" data-animate>
                  <div className="min-w-0">
                    <p className="text-cream font-medium">View Your Full Report</p>
                    <p className="text-xs text-cream/40 mt-0.5">
                      Comparable sales, filing instructions, and everything you need.
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

        {/* ─── Report History ──────────────────────────────────────── */}
        {pastReports.length > 0 && (
          <div data-animate>
            <h2 className="font-display text-xl text-cream mb-6">Report History</h2>
            <div className="space-y-3">
              {pastReports.map((report, i) => {
                const isDelivered = report.status === 'delivered';
                return (
                  <div
                    key={report.id}
                    data-animate
                    data-delay={String((i + 1) * 80)}
                    className="card-premium rounded-xl p-4 md:p-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: icon + info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isDelivered ? 'bg-emerald-500/15' : 'bg-gold/10'
                          }`}
                        >
                          {isDelivered ? (
                            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
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
                            {SERVICE_LABELS[report.service_type] || report.service_type} &middot;{' '}
                            {new Date(report.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>

                      {/* Right: status + actions */}
                      <div className="flex items-center gap-3 pl-12 sm:pl-0">
                        <span
                          className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${
                            isDelivered
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : report.status === 'failed'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-gold/10 text-gold border border-gold/20'
                          }`}
                        >
                          {report.status.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase())}
                        </span>
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

        {/* ─── Empty State ───────��──────────────────────────��──────── */}
        {userReports.length === 0 && (
          <div className="text-center py-24 animate-fade-in">
            <div className="w-20 h-20 rounded-2xl bg-gold/[0.08] border border-gold/[0.12] flex items-center justify-center mx-auto mb-8"
                 style={{ boxShadow: '0 0 30px rgba(212, 168, 71, 0.06)' }}>
              <svg className="w-10 h-10 text-gold/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="font-display text-2xl text-cream mb-3">No Reports Yet</h2>
            <p className="text-cream/40 mb-8 max-w-sm mx-auto">
              Get started with your first property analysis. We compare your home to recent sales and build your evidence package.
            </p>
            <Link
              href="/start"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-light via-gold to-gold-dark px-8 py-4 text-base font-semibold text-navy-deep shadow-gold hover:shadow-gold-lg transition-all duration-300 hover:scale-[1.02]"
            >
              Start Your Report
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        )}

        {/* ─── Error State ─────────────────────────────────────────── */}
        {error && userReports.length === 0 && (
          <div className="card-premium rounded-xl p-8 text-center mt-8">
            <p className="text-cream/50 mb-4">We had trouble loading your reports. Please try refreshing the page.</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm font-medium text-gold border border-gold/20 px-4 py-2 rounded-lg hover:bg-gold/10 transition-all"
            >
              Refresh
            </button>
          </div>
        )}
      </main>

      {/* ─── Dashboard Footer ────────���─────────────────────────────── */}
      <footer className="max-w-5xl mx-auto px-6 pb-12">
        <div className="border-t border-gold/[0.06] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs text-cream/20">
            <Link href="/" className="hover:text-cream/40 transition-colors">Home</Link>
            <span>&middot;</span>
            <Link href="/start" className="hover:text-cream/40 transition-colors">New Report</Link>
            <span>&middot;</span>
            <a href="mailto:support@resourceful.app" className="hover:text-cream/40 transition-colors">
              Support
            </a>
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
