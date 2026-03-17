import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Report, ReportStatus } from '@/types/database';
import PipelineProgress from '@/components/dashboard/PipelineProgress';
import ReportDownload from '@/components/dashboard/ReportDownload';

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
    description: 'Our AI is analyzing your property photos for condition assessment and documentation.',
  },
  processing: {
    title: 'Generating Your Report',
    description: 'Your report is being prepared by our analysis engine. This typically takes 2-6 hours.',
  },
  pending_approval: {
    title: 'Under Quality Review',
    description: 'Your report is complete and under final review by our team. You will receive an email within 24 hours.',
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

  // Fetch user's reports from the database
  const { data: reports, error } = await supabase
    .from('reports')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

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

  // Map pipeline_last_completed_stage to a numeric value for the progress component
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
      {/* Header */}
      <header className="border-b border-gold/10 bg-navy-deep/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-light to-gold-dark flex items-center justify-center">
              <span className="text-navy-deep font-bold text-sm">R</span>
            </div>
            <span className="font-display text-lg text-cream">Resourceful</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/start"
              className="text-sm text-gold/70 hover:text-gold transition-colors"
            >
              + New Report
            </a>
            <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-gold/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-10 animate-fade-in">
          <h1 className="font-display text-3xl text-cream mb-2">Your Dashboard</h1>
          <p className="text-cream/50">Track your reports and download completed analyses.</p>
        </div>

        {/* Active report */}
        {activeReport && (
          <div className="space-y-8 mb-16 animate-slide-up">
            {/* Status card */}
            <div className="card-premium rounded-xl p-8">
              <div className="flex items-start gap-5 mb-8">
                {isInProgress ? (
                  <div className="w-12 h-12 rounded-full bg-gold/15 flex items-center justify-center flex-shrink-0">
                    <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
                <div>
                  <h2 className="font-display text-xl text-cream">{statusInfo?.title}</h2>
                  <p className="text-sm text-cream/50 mt-1">{statusInfo?.description}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="text-xs text-cream/30">
                      {SERVICE_LABELS[activeReport.service_type] || activeReport.service_type}
                    </span>
                    <span className="text-xs text-cream/30">&middot;</span>
                    <span className="text-xs text-cream/30">{activeReport.property_address}</span>
                  </div>
                </div>
              </div>

              {/* Pipeline progress */}
              <PipelineProgress
                currentStatus={activeReport.status}
                pipelineLastCompletedStage={getStageNumber(activeReport)}
              />
            </div>

            {/* Download section for delivered reports */}
            {activeReport.status === 'delivered' && (
              <ReportDownload
                pdfUrl={activeReport.report_pdf_storage_path}
                reportType={activeReport.service_type}
                propertyAddress={activeReport.property_address}
                countyName={activeReport.county ?? undefined}
              />
            )}
          </div>
        )}

        {/* Report history */}
        {pastReports.length > 0 && (
          <div>
            <h2 className="font-display text-xl text-cream mb-6">Report History</h2>
            <div className="space-y-4">
              {pastReports.map((report) => {
                const isDelivered = report.status === 'delivered';
                return (
                  <div
                    key={report.id}
                    className="card-premium rounded-xl p-6 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isDelivered
                            ? 'bg-emerald-500/15'
                            : 'bg-gold/10'
                        }`}
                      >
                        {isDelivered ? (
                          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-gold/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="text-cream font-medium">{report.property_address}</p>
                        <p className="text-xs text-cream/40 mt-0.5">
                          {SERVICE_LABELS[report.service_type] || report.service_type} &middot;{' '}
                          {new Date(report.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-medium px-3 py-1 rounded-full ${
                          isDelivered
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-gold/10 text-gold border border-gold/20'
                        }`}
                      >
                        {report.status.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase())}
                      </span>
                      {isDelivered && report.report_pdf_storage_path && (
                        <a
                          href={report.report_pdf_storage_path}
                          className="text-sm text-gold hover:text-gold-light transition-colors flex items-center gap-1.5"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Download
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {userReports.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-gold/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="font-display text-xl text-cream mb-2">No Reports Yet</h2>
            <p className="text-cream/40 mb-6">Get started with your first property analysis.</p>
            <a
              href="/start"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-light via-gold to-gold-dark px-6 py-3 text-sm font-semibold text-navy-deep shadow-gold hover:shadow-gold-lg transition-all duration-300"
            >
              Start Your Report
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
