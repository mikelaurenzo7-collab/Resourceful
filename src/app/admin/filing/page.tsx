import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ReportStatusBadge from '@/components/admin/ReportStatusBadge';
import type { Report, FormSubmission } from '@/types/database';

const tabs: { key: string; label: string }[] = [
  { key: 'not_started', label: 'Not Filed' },
  { key: 'filed', label: 'Filed' },
  { key: 'hearing_scheduled', label: 'Hearing Scheduled' },
  { key: 'resolved', label: 'Resolved' },
];

const filingStatusConfig: Record<string, { label: string; className: string }> = {
  not_started: { label: 'Not Started', className: 'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-300' },
  filed: { label: 'Filed', className: 'bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-600/20' },
  hearing_scheduled: { label: 'Hearing Scheduled', className: 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-600/20' },
  resolved_win: { label: 'Resolved (Win)', className: 'bg-green-100 text-green-800 ring-1 ring-inset ring-green-600/20' },
  resolved_loss: { label: 'Resolved (Loss)', className: 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-600/20' },
};

function formatCurrency(value: number | null): string {
  if (value == null) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCents(cents: number | null): string {
  if (cents == null) return '--';
  return formatCurrency(cents / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default async function FilingQueuePage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const activeTab = searchParams.tab || 'not_started';
  const supabase = await createClient();

  // Build the reports query — only full_representation tier
  let query = supabase
    .from('reports')
    .select('*')
    .eq('review_tier', 'full_representation')
    .order('created_at', { ascending: false });

  // Filter by filing_status based on active tab
  if (activeTab === 'resolved') {
    query = query.in('filing_status', ['resolved_win', 'resolved_loss']);
  } else {
    query = query.eq('filing_status', activeTab);
  }

  const { data: rawReports, error } = await query.limit(200);
  const reports = rawReports as unknown as Report[] | null;

  // Fetch form_submissions for portal URLs
  const portalUrlMap: Record<string, string> = {};
  if (reports && reports.length > 0) {
    const reportIds = reports.map((r) => r.id);
    const { data: rawSubmissions } = await supabase
      .from('form_submissions')
      .select('report_id, portal_url')
      .in('report_id', reportIds);

    const submissions = rawSubmissions as unknown as Pick<FormSubmission, 'report_id' | 'portal_url'>[] | null;
    if (submissions) {
      for (const sub of submissions) {
        if (sub.portal_url) {
          portalUrlMap[sub.report_id] = sub.portal_url;
        }
      }
    }
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          Error loading reports: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Filing Queue</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track and manage appeal filings for full representation clients.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-6">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Link
                key={tab.key}
                href={`/admin/filing?tab=${tab.key}`}
                className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-[#1a2744] text-[#1a2744]'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Table */}
      {reports && reports.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Address
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Filing Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Hearing Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Portal
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Amount Paid
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((report) => {
                const filingConfig = filingStatusConfig[report.filing_status] ?? {
                  label: report.filing_status,
                  className: 'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-300',
                };
                const portalUrl = portalUrlMap[report.id];

                return (
                  <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {report.property_address}
                      </div>
                      <div className="text-xs text-gray-500">
                        {[report.city, report.state].filter(Boolean).join(', ')}
                        {report.county && <span className="ml-1 text-gray-400">({report.county})</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ReportStatusBadge status={report.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${filingConfig.className}`}
                      >
                        {filingConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDate(report.hearing_date)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {portalUrl ? (
                        <a
                          href={portalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          Portal
                        </a>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                      {formatCents(report.amount_paid_cents)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/admin/reports/${report.id}/review`}
                        className="inline-flex items-center rounded-lg bg-[#1a2744] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[#243356]"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">No reports found for this filter.</p>
        </div>
      )}
    </div>
  );
}
