import type { ReportStatus } from '@/types/database';
import PipelineProgress from '@/components/dashboard/PipelineProgress';
import ReportDownload from '@/components/dashboard/ReportDownload';

// In production, this would fetch from Supabase using the authenticated user's ID.
// For now, we use mock data to demonstrate the UI.
interface MockReport {
  id: string;
  status: ReportStatus;
  pipelineLastCompletedStage: number | null;
  serviceType: string;
  propertyAddress: string;
  propertyCounty: string;
  pdfUrl: string | null;
  createdAt: string;
  amountPaidCents: number;
}

async function getReports(): Promise<MockReport[]> {
  // Simulated server-side data fetch
  return [
    {
      id: 'rpt_001',
      status: 'processing',
      pipelineLastCompletedStage: 4,
      serviceType: 'tax_appeal',
      propertyAddress: '1234 W Example St, Chicago, IL 60614',
      propertyCounty: 'Cook',
      pdfUrl: null,
      createdAt: '2026-03-15T10:30:00Z',
      amountPaidCents: 3900,
    },
    {
      id: 'rpt_002',
      status: 'delivered',
      pipelineLastCompletedStage: 7,
      serviceType: 'tax_appeal',
      propertyAddress: '5678 N Sample Ave, Evanston, IL 60201',
      propertyCounty: 'Cook',
      pdfUrl: '/reports/sample-report.pdf',
      createdAt: '2026-02-20T14:00:00Z',
      amountPaidCents: 3900,
    },
  ];
}

const STATUS_MESSAGES: Partial<Record<ReportStatus, { title: string; description: string }>> = {
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
};

const SERVICE_LABELS: Record<string, string> = {
  tax_appeal: 'Tax Appeal Report',
  pre_purchase: 'Pre-Purchase Analysis',
  pre_listing: 'Pre-Listing Report',
};

export default async function DashboardPage() {
  const reports = await getReports();
  const activeReport = reports[0];
  const pastReports = reports.slice(1);

  const statusInfo = activeReport
    ? STATUS_MESSAGES[activeReport.status] || { title: 'Processing', description: 'Your report is being processed.' }
    : null;

  const isInProgress = activeReport && !['delivered', 'failed', 'rejected'].includes(activeReport.status);

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
                      {SERVICE_LABELS[activeReport.serviceType] || activeReport.serviceType}
                    </span>
                    <span className="text-xs text-cream/30">&middot;</span>
                    <span className="text-xs text-cream/30">{activeReport.propertyAddress}</span>
                  </div>
                </div>
              </div>

              {/* Pipeline progress */}
              <PipelineProgress
                currentStatus={activeReport.status}
                pipelineLastCompletedStage={activeReport.pipelineLastCompletedStage}
              />
            </div>

            {/* Download section for delivered reports */}
            {activeReport.status === 'delivered' && (
              <ReportDownload
                pdfUrl={activeReport.pdfUrl}
                reportType={activeReport.serviceType}
                propertyAddress={activeReport.propertyAddress}
                countyName={activeReport.propertyCounty}
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
                        <p className="text-cream font-medium">{report.propertyAddress}</p>
                        <p className="text-xs text-cream/40 mt-0.5">
                          {SERVICE_LABELS[report.serviceType] || report.serviceType} &middot;{' '}
                          {new Date(report.createdAt).toLocaleDateString('en-US', {
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
                      {isDelivered && report.pdfUrl && (
                        <a
                          href={report.pdfUrl}
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
        {reports.length === 0 && (
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
