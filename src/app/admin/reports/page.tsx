import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ReportStatusBadge from '@/components/admin/ReportStatusBadge';
import type { Report, ReportStatus } from '@/types/database';

const tabs: { key: ReportStatus | 'all'; label: string }[] = [
  { key: 'pending_approval', label: 'Pending Approval' },
  { key: 'all', label: 'All Reports' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'failed', label: 'Failed' },
  { key: 'processing', label: 'In Progress' },
];

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
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function ReportsQueuePage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const activeTab = (searchParams.tab as ReportStatus | 'all') || 'pending_approval';
  const supabase = await createClient();

  let query = supabase
    .from('reports')
    .select('*')
    .order(
      activeTab === 'pending_approval' ? 'pipeline_completed_at' : 'created_at',
      { ascending: activeTab === 'pending_approval' }
    );

  if (activeTab !== 'all') {
    query = query.eq('status', activeTab);
  }

  const { data: rawReports, error } = await query.limit(200);
  const reports = rawReports as unknown as Report[] | null;

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
        <h1 className="text-2xl font-bold text-gray-900">Reports Queue</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review and manage property reports through the approval pipeline.
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
                href={`/admin/reports?tab=${tab.key}`}
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
                  Type
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Photos
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Amount Paid
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Pipeline Stage
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Pipeline Completed
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((report) => (
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
                  <td className="px-4 py-3 text-sm capitalize text-gray-700">
                    {report.property_type ?? '--'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {report.photos_skipped ? (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-semibold text-gray-500 ring-1 ring-inset ring-gray-300">
                        No Photos
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        Has Photos
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <ReportStatusBadge status={report.status} />
                      {report.review_tier === 'expert_reviewed' && (
                        <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 ring-1 ring-inset ring-purple-600/20">
                          Expert
                        </span>
                      )}
                      {report.review_tier === 'guided_filing' && (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                          Guided
                        </span>
                      )}
                      {report.review_tier === 'full_representation' && (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
                          We File
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                    {formatCents(report.amount_paid_cents)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {report.pipeline_last_completed_stage != null
                      ? `Stage ${report.pipeline_last_completed_stage}`
                      : '--'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(report.pipeline_completed_at)}
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
              ))}
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
