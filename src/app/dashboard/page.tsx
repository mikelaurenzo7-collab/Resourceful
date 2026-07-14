import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import type { Report } from '@/types/database';
import { logger } from '@/lib/logger';
import {
  getCustomerServiceLabel,
  getCustomerStatusMessage,
  isEvidenceInsufficient,
} from '@/lib/dashboard/report-status';
import PipelineProgress from '@/components/dashboard/PipelineProgress';
import ReportDownload from '@/components/dashboard/ReportDownload';
import AppealJourney from '@/components/dashboard/AppealJourney';
import DashboardAutoRefresh from '@/components/dashboard/DashboardAutoRefresh';
import ValueInsights from '@/components/dashboard/ValueInsights';
import OutcomeReporter from '@/components/dashboard/OutcomeReporter';
import AccountMenu from '@/components/dashboard/AccountMenu';
import Wordmark from '@/components/ui/Wordmark';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Track property analyses, review evidence status, and access completed reports.',
  robots: { index: false, follow: false },
};

export const revalidate = 0;

const TERMINAL_STATUSES = new Set(['delivered', 'failed', 'rejected']);

const STAGE_MAP: Record<string, number> = {
  'stage-1-data': 1,
  'stage-2-comps': 2,
  'stage-3-income': 3,
  'stage-4-photos': 4,
  'stage-5-narratives': 5,
  'stage-6-filing': 6,
  'stage-7-pdf': 7,
};

const OUTCOME_DISPLAY: Record<string, { label: string; classes: string }> = {
  won: { label: 'Won', classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  lost: { label: 'Lost', classes: 'bg-red-500/10 text-red-400 border-red-500/20' },
  pending: { label: 'Pending', classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  withdrew: { label: 'Withdrew', classes: 'bg-cream/5 text-cream/40 border-cream/10' },
  didnt_file: { label: "Didn't File", classes: 'bg-cream/5 text-cream/40 border-cream/10' },
};

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`;
}

function statusTone(category: ReturnType<typeof getCustomerStatusMessage>['category']) {
  if (category === 'evidence_required') {
    return {
      card: 'border-amber-400/25 bg-amber-400/[0.06]',
      icon: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
      eyebrow: 'text-amber-300/80',
    };
  }
  if (category === 'technical_error' || category === 'revision_required') {
    return {
      card: 'border-red-400/20 bg-red-500/[0.05]',
      icon: 'border-red-400/25 bg-red-500/10 text-red-300',
      eyebrow: 'text-red-300/80',
    };
  }
  if (category === 'ready') {
    return {
      card: 'border-emerald-400/20 bg-emerald-500/[0.04]',
      icon: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300',
      eyebrow: 'text-emerald-300/80',
    };
  }
  return {
    card: 'border-gold/15 bg-gold/[0.035]',
    icon: 'border-gold/20 bg-gold/10 text-gold',
    eyebrow: 'text-gold/70',
  };
}

function getStageNumber(report: Report): number | null {
  if (!report.pipeline_last_completed_stage) return null;
  return STAGE_MAP[report.pipeline_last_completed_stage] ?? null;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?redirect=/dashboard');

  const userEmail = user.email ?? '';
  const normalizedEmail = userEmail.toLowerCase();
  const userInitial = userEmail[0]?.toUpperCase() ?? 'U';

  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    await admin
      .from('reports')
      .update({ user_id: user.id })
      .eq('client_email', normalizedEmail)
      .is('user_id', null);
  } catch (linkError) {
    logger.warn({ error: String(linkError) }, '[dashboard] Report linking failed');
  }

  const { data: reportRows, error: reportsError } = await supabase
    .from('reports')
    .select(
      'id, status, service_type, property_type, property_address, city, state, county, county_fips, ' +
      'pipeline_last_completed_stage, pipeline_error_log, desired_outcome, report_pdf_storage_path, created_at, client_email, ' +
      'delivered_at, filing_status, filed_at, filing_method, appeal_outcome, actual_savings_cents, ' +
      'outcome_reported_at, case_value_at_stake, case_strength_score'
    )
    .or(`user_id.eq.${user.id},client_email.eq.${normalizedEmail}`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (reportsError) {
    logger.error({ error: reportsError.message }, '[dashboard] Failed to fetch reports');
  }

  const reports = (reportRows ?? []) as unknown as Report[];
  const activeReport =
    reports.find((report) => !TERMINAL_STATUSES.has(report.status)) ?? reports[0] ?? null;
  const pastReports = reports.filter((report) => report.id !== activeReport?.id);
  const isInProgress = Boolean(activeReport && !TERMINAL_STATUSES.has(activeReport.status));

  const statusInfo = activeReport
    ? getCustomerStatusMessage(activeReport.status, activeReport.pipeline_error_log)
    : null;
  const tone = statusInfo ? statusTone(statusInfo.category) : null;
  const evidenceRequired = Boolean(
    activeReport?.status === 'failed' && isEvidenceInsufficient(activeReport.pipeline_error_log)
  );

  let assessedValue: number | null = null;
  let concludedValue: number | null = null;
  let potentialSavings: number | null = null;
  let filingDeadlineDate: string | null = null;
  let filingDeadlineRule: string | null = null;

  if (activeReport?.status === 'delivered') {
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const admin = createAdminClient();
      const [{ data: property }, { data: countyRules }] = await Promise.all([
        admin
          .from('property_data')
          .select('assessed_value, concluded_value')
          .eq('report_id', activeReport.id)
          .maybeSingle(),
        activeReport.county_fips
          ? admin
              .from('county_rules')
              .select('next_appeal_deadline, appeal_deadline_rule')
              .eq('county_fips', activeReport.county_fips)
              .limit(1)
          : Promise.resolve({ data: null }),
      ]);

      assessedValue = property?.assessed_value ?? null;
      concludedValue = property?.concluded_value ?? null;
      if (assessedValue && concludedValue && assessedValue > concludedValue) {
        potentialSavings = Math.round((assessedValue - concludedValue) * 0.011);
      }

      const countyRule = countyRules?.[0] as
        | { next_appeal_deadline: string | null; appeal_deadline_rule: string | null }
        | undefined;
      filingDeadlineDate = countyRule?.next_appeal_deadline ?? null;
      filingDeadlineRule = countyRule?.appeal_deadline_rule ?? null;
    } catch (detailError) {
      logger.warn({ error: String(detailError) }, '[dashboard] Supplemental report data unavailable');
    }
  }

  const wonReports = reports.filter((report) => report.appeal_outcome === 'won');
  const totalSavingsCents = wonReports.reduce(
    (total, report) => total + (report.actual_savings_cents ?? 0),
    0
  );
  const daysSinceDelivery = activeReport?.delivered_at
    ? Math.max(0, Math.floor((Date.now() - new Date(activeReport.delivered_at).getTime()) / 86_400_000))
    : 0;

  return (
    <div className="min-h-screen bg-pattern relative overflow-hidden">
      <DashboardAutoRefresh hasActiveReport={isInProgress} />
      <div className="absolute inset-0 bg-aurora opacity-30 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-navy-deep/75 via-navy-deep/90 to-navy-deep pointer-events-none" />

      <div className="relative z-10">
        <header className="sticky top-0 z-50 border-b border-gold/[0.08] bg-navy-deep/85 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-5 sm:px-6 py-4 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-light to-gold-dark flex items-center justify-center shadow-gold">
                <span className="text-navy-deep font-bold text-sm">R</span>
              </div>
              <Wordmark className="font-display text-lg text-cream group-hover:text-gold-light transition-colors" />
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/start"
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-navy-deep bg-gradient-to-r from-gold-light via-gold to-gold-dark hover:brightness-110 transition"
              >
                <span className="text-lg leading-none">+</span>
                <span className="hidden sm:inline">New Analysis</span>
              </Link>
              <AccountMenu userEmail={userEmail} userInitial={userInitial} />
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-5 sm:px-6 py-10 sm:py-14 space-y-8">
          <section className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div>
              <span className="text-[11px] font-semibold tracking-[0.2em] text-gold/65 uppercase">Property Intelligence</span>
              <h1 className="font-display text-3xl sm:text-4xl text-cream mt-2">Your reports, without the guesswork.</h1>
              <p className="text-cream/45 mt-3 max-w-2xl">
                See what Resourceful is analyzing, what evidence is still needed, and exactly when a report is ready to use.
              </p>
            </div>
            {reports.length > 0 && (
              <div className="flex gap-3">
                <div className="rounded-xl border border-gold/10 bg-navy-light/35 px-4 py-3 text-right">
                  <p className="text-[10px] uppercase tracking-widest text-cream/35">Reports</p>
                  <p className="font-display text-xl text-cream">{reports.length}</p>
                </div>
                <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/[0.04] px-4 py-3 text-right">
                  <p className="text-[10px] uppercase tracking-widest text-emerald-300/55">Documented Savings</p>
                  <p className="font-display text-xl text-emerald-300">{formatDollars(totalSavingsCents)}</p>
                </div>
              </div>
            )}
          </section>

          {reportsError && (
            <section className="rounded-xl border border-red-400/20 bg-red-500/[0.05] p-5 text-sm text-red-200">
              Reports could not be loaded completely. Refresh the page or contact support if the issue continues.
            </section>
          )}

          {!activeReport ? (
            <section className="card-premium rounded-2xl p-8 sm:p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gold/10 border border-gold/15 flex items-center justify-center mx-auto text-gold text-2xl">⌂</div>
              <h2 className="font-display text-2xl text-cream mt-5">Start with a property and a decision.</h2>
              <p className="text-cream/45 mt-3 max-w-xl mx-auto">
                Build a tax-appeal package, evaluate a purchase or listing, or request an independent valuation analysis.
              </p>
              <Link href="/start" className="mt-6 inline-flex rounded-lg px-6 py-3 font-semibold btn-premium-glow">
                Start an Analysis
              </Link>
            </section>
          ) : (
            <>
              <section className={`rounded-2xl border p-6 sm:p-8 ${tone?.card ?? ''}`}>
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className={`w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 ${tone?.icon ?? ''}`}>
                      {statusInfo?.category === 'evidence_required'
                        ? '＋'
                        : statusInfo?.category === 'technical_error' || statusInfo?.category === 'revision_required'
                          ? '!'
                          : statusInfo?.category === 'ready'
                            ? '✓'
                            : '•'}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[10px] uppercase tracking-[0.2em] font-semibold ${tone?.eyebrow ?? ''}`}>Current Assignment</p>
                      <h2 className="font-display text-2xl text-cream mt-1">{statusInfo?.title}</h2>
                      <p className="text-cream/50 mt-2 max-w-2xl leading-relaxed">{statusInfo?.description}</p>
                    </div>
                  </div>
                  <div className="lg:text-right flex-shrink-0">
                    <p className="text-sm font-medium text-cream break-words">{activeReport.property_address}</p>
                    <p className="text-xs text-cream/40 mt-1">
                      {[activeReport.city, activeReport.state].filter(Boolean).join(', ')}
                    </p>
                    <span className="inline-flex mt-3 rounded-full border border-gold/15 bg-gold/[0.06] px-3 py-1 text-[11px] text-gold/80">
                      {getCustomerServiceLabel(activeReport.service_type, activeReport.desired_outcome)}
                    </span>
                  </div>
                </div>

                <div className="mt-8 pt-7 border-t border-cream/[0.07]">
                  <PipelineProgress
                    currentStatus={activeReport.status}
                    pipelineLastCompletedStage={getStageNumber(activeReport)}
                  />
                </div>
              </section>

              {evidenceRequired && (
                <section className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.055] p-6 sm:p-7">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-amber-300/75">Recovery Path</p>
                      <h3 className="font-display text-xl text-cream mt-1">Strengthen the workfile instead of forcing a number.</h3>
                      <p className="text-sm text-cream/50 mt-2 max-w-2xl leading-relaxed">
                        Helpful records can include the current tax bill, a prior appraisal, leases, rent roll, income and expense statements, repair estimates, inspection reports, or a recent closing statement. The review team will identify the smallest useful evidence set.
                      </p>
                    </div>
                    <a
                      href={`mailto:support@resourceful.app?subject=${encodeURIComponent(`Evidence for report ${activeReport.id}`)}`}
                      className="inline-flex items-center justify-center rounded-lg border border-amber-300/25 bg-amber-300/10 px-5 py-3 text-sm font-semibold text-amber-200 hover:bg-amber-300/15 transition"
                    >
                      Send Supporting Records
                    </a>
                  </div>
                </section>
              )}

              {(activeReport.status === 'failed' || activeReport.status === 'rejected') && !evidenceRequired && (
                <section className="rounded-2xl border border-red-400/20 bg-red-500/[0.045] p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="font-display text-lg text-cream">{statusInfo?.title}</h3>
                    <p className="text-sm text-cream/45 mt-1">{statusInfo?.description}</p>
                  </div>
                  <a href="mailto:support@resourceful.app" className="text-sm font-semibold text-red-200 hover:text-red-100">
                    Contact Support →
                  </a>
                </section>
              )}

              {activeReport.status === 'delivered' && (
                <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)] gap-6 items-start">
                  <div className="space-y-6">
                    <ReportDownload
                      pdfUrl={activeReport.report_pdf_storage_path ? `/api/reports/${activeReport.id}/download` : null}
                      reportType={activeReport.service_type}
                      propertyAddress={activeReport.property_address}
                      countyName={activeReport.county ?? undefined}
                    />

                    {activeReport.service_type === 'tax_appeal' && (
                      <AppealJourney
                        reportId={activeReport.id}
                        filingStatus={activeReport.filing_status}
                        filedAt={activeReport.filed_at}
                        filingMethod={activeReport.filing_method}
                        appealOutcome={activeReport.appeal_outcome}
                        outcomeReportedAt={activeReport.outcome_reported_at}
                        deliveredAt={activeReport.delivered_at}
                        daysSinceDelivery={daysSinceDelivery}
                      />
                    )}
                  </div>

                  <div className="space-y-6">
                    <ValueInsights
                      assessedValue={assessedValue}
                      concludedValue={concludedValue}
                      potentialSavings={potentialSavings}
                      caseStrength={activeReport.case_strength_score}
                      propertyType={activeReport.property_type}
                      serviceType={activeReport.service_type}
                    />

                    {activeReport.service_type === 'tax_appeal' && (filingDeadlineDate || filingDeadlineRule) && (
                      <section className="card-premium rounded-xl p-5">
                        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-gold/65">Filing Deadline</p>
                        <p className="font-display text-xl text-cream mt-2">{filingDeadlineDate ? formatDate(filingDeadlineDate) : 'Verify with jurisdiction'}</p>
                        {filingDeadlineRule && <p className="text-sm text-cream/45 mt-2 leading-relaxed">{filingDeadlineRule}</p>}
                      </section>
                    )}

                    {activeReport.service_type === 'tax_appeal' && (
                      <OutcomeReporter
                        reportId={activeReport.id}
                        currentOutcome={activeReport.appeal_outcome}
                        assessedValue={assessedValue}
                      />
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {pastReports.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-gold/60">History</p>
                  <h2 className="font-display text-2xl text-cream mt-1">Past reports</h2>
                </div>
                <p className="text-xs text-cream/35">{pastReports.length} archived assignment{pastReports.length === 1 ? '' : 's'}</p>
              </div>

              <div className="grid gap-3">
                {pastReports.map((report) => {
                  const reportStatus = getCustomerStatusMessage(report.status, report.pipeline_error_log);
                  const outcome = report.appeal_outcome ? OUTCOME_DISPLAY[report.appeal_outcome] : null;
                  return (
                    <Link
                      key={report.id}
                      href={`/report/${report.id}`}
                      className="group rounded-xl border border-gold/[0.08] bg-navy-light/25 p-5 hover:border-gold/20 hover:bg-navy-light/40 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-cream group-hover:text-gold-light transition truncate">{report.property_address}</h3>
                            {outcome && (
                              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${outcome.classes}`}>
                                {outcome.label}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-cream/40 mt-1">
                            {getCustomerServiceLabel(report.service_type, report.desired_outcome)} · {formatDate(report.created_at)}
                          </p>
                        </div>
                        <div className="sm:text-right flex-shrink-0">
                          <p className="text-sm text-cream/60">{reportStatus.title}</p>
                          {report.actual_savings_cents != null && report.actual_savings_cents > 0 && (
                            <p className="text-xs text-emerald-300 mt-1">Saved {formatDollars(report.actual_savings_cents)}</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
