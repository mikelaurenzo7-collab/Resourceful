import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ReportStatusBadge from '@/components/admin/ReportStatusBadge';
import type { Report, ReportStatus } from '@/types/database';

const tabs: { key: ReportStatus | 'all'; label: string }[] = [
  { key: 'pending_approval', label: 'Pending' },
  { key: 'all', label: 'All' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'failed', label: 'Failed' },
  { key: 'processing', label: 'Processing' },
];

const STAGE_LABELS: Record<string, string> = {
  'stage-1-data': 'Data Collection',
  'stage-2-comps': 'Comparables',
  'stage-3-income': 'Income Analysis',
  'stage-4-photos': 'Photo Analysis',
  'stage-5-narratives': 'Narratives',
  'stage-6-filing': 'Filing Guide',
  'stage-7-pdf': 'PDF Assembly',
};

function formatCents(cents: number | null): string {
  if (cents == null) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function timeAgo(iso: string | null): string {
  if (!iso) return '--';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function ReportsQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const activeTab = (params.tab as ReportStatus | 'all') || 'pending_approval';
  const searchQuery = params.q?.trim() ?? '';
  const currentPage = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const pageSize = 50;
  const offset = (currentPage - 1) * pageSize;

  const supabase = await createClient();

  let query = supabase
    .from('reports')
    .select('*', { count: 'exact' })
    .order(
      activeTab === 'pending_approval' ? 'pipeline_completed_at' : 'created_at',
      { ascending: activeTab === 'pending_approval' }
    );

  if (activeTab !== 'all') {
    query = query.eq('status', activeTab);
  }

  if (searchQuery) {
    query = query.or(
      `property_address.ilike.%${searchQuery}%,client_email.ilike.%${searchQuery}%,county.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%`
    );
  }

  const { data: rawReports, error, count: totalCount } = await query.range(offset, offset + pageSize - 1);
  const totalPages = totalCount ? Math.ceil(totalCount / pageSize) : 1;
  const reports = rawReports as unknown as Report[] | null;

  if (error) {
    return (
      <div className="p-6 lg:p-8">
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
          Error loading reports: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-100">Reports Queue</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review and manage property reports.
        </p>
      </div>

      {/* Search */}
      <div className="mb-5">
        <form method="GET" className="flex gap-2">
          <input type="hidden" name="tab" value={activeTab} />
          <input
            type="text"
            name="q"
            defaultValue={searchQuery}
            placeholder="Search address, email, county..."
            className="flex-1 rounded-lg bg-white/[0.06] border border-white/10 px-4 py-2.5 text-sm text-gray-200 placeholder:text-gray-400 focus:border-amber-400/30 focus:ring-1 focus:ring-amber-400/20 focus:outline-none transition-colors"
          />
          <button
            type="submit"
            className="rounded-lg bg-amber-400/15 px-4 py-2.5 text-sm font-medium text-amber-300 border border-amber-400/20 hover:bg-amber-400/20 transition-colors"
          >
            Search
          </button>
          {searchQuery && (
            <Link
              href={`/admin/reports?tab=${activeTab}`}
              className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-gray-400 hover:bg-white/[0.06] transition-colors"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      {/* Tabs */}
      <div className="mb-6 overflow-x-auto">
        <nav className="flex gap-1 bg-white/[0.03] rounded-lg p-1 min-w-max">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Link
                key={tab.key}
                href={`/admin/reports?tab=${tab.key}`}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-amber-400/15 text-amber-300 shadow-sm'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Reports list */}
      {reports && reports.length > 0 ? (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Property</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Paid</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Stage</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Completed</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium text-gray-200">{report.property_address}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[report.city, report.state].filter(Boolean).join(', ')}
                        {report.county && <span className="text-gray-400"> &middot; {report.county}</span>}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <ReportStatusBadge status={report.status} />
                        {!report.photos_skipped && (
                          <span className="text-[10px] text-emerald-500">+photos</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm font-medium text-gray-300">
                      {formatCents(report.amount_paid_cents)}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-400">
                      {report.pipeline_last_completed_stage
                        ? STAGE_LABELS[report.pipeline_last_completed_stage] ?? report.pipeline_last_completed_stage
                        : '--'}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-500">
                      {timeAgo(report.pipeline_completed_at)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Link
                        href={`/admin/reports/${report.id}/review`}
                        className="inline-flex items-center rounded-lg bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-300 border border-amber-400/15 transition-colors hover:bg-amber-400/20"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="lg:hidden space-y-3">
            {reports.map((report) => (
              <Link
                key={report.id}
                href={`/admin/reports/${report.id}/review`}
                className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-200 truncate">{report.property_address}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {[report.city, report.state, report.county].filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <ReportStatusBadge status={report.status} />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mt-3 pt-3 border-t border-white/[0.04]">
                  <span>{formatCents(report.amount_paid_cents)}</span>
                  <span>
                    {report.pipeline_last_completed_stage
                      ? STAGE_LABELS[report.pipeline_last_completed_stage] ?? report.pipeline_last_completed_stage
                      : '--'}
                  </span>
                  <span>{timeAgo(report.pipeline_completed_at)}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-1">
              <p className="text-xs text-gray-500">
                {offset + 1}–{Math.min(offset + pageSize, totalCount ?? 0)} of {totalCount ?? 0}
              </p>
              <div className="flex gap-1">
                {currentPage > 1 && (
                  <Link
                    href={`/admin/reports?tab=${activeTab}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ''}&page=${currentPage - 1}`}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:bg-white/[0.06] transition-colors"
                  >
                    Prev
                  </Link>
                )}
                {currentPage < totalPages && (
                  <Link
                    href={`/admin/reports?tab=${activeTab}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ''}&page=${currentPage + 1}`}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:bg-white/[0.06] transition-colors"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <p className="text-sm text-gray-500">
            {searchQuery
              ? `No reports matching "${searchQuery}".`
              : 'No reports for this filter.'}
          </p>
        </div>
      )}
    </div>
  );
}
