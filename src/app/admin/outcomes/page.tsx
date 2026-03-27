import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Report } from '@/types/database';

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

function formatOutcome(outcome: string | null): string {
  if (!outcome) return '--';
  const labels: Record<string, string> = {
    won_full: 'Won (Full)',
    won_partial: 'Won (Partial)',
    lost: 'Lost',
    withdrawn: 'Withdrawn',
    pending_hearing: 'Pending Hearing',
    settled_informal: 'Settled (Informal)',
  };
  return labels[outcome] ?? outcome;
}

function outcomeColor(outcome: string | null): string {
  if (!outcome) return 'bg-gray-100 text-gray-700';
  switch (outcome) {
    case 'won_full':
    case 'won_partial':
    case 'settled_informal':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20';
    case 'lost':
      return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20';
    case 'withdrawn':
      return 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-300';
    case 'pending_hearing':
      return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

const tabs = [
  { key: 'pending', label: 'Pending Outcomes' },
  { key: 'history', label: 'Outcome History' },
] as const;

export default async function OutcomesPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const activeTab = (searchParams.tab as 'pending' | 'history') || 'pending';
  const supabase = await createClient();

  // Fetch pending outcomes: delivered reports with no outcome recorded
  const { data: rawPending, error: pendingError } = await supabase
    .from('reports')
    .select('*')
    .eq('status', 'delivered')
    .is('outcome_reported_at', null)
    .order('delivered_at', { ascending: true })
    .limit(200);

  const pendingReports = rawPending as unknown as Report[] | null;

  // Fetch history: reports that have outcomes recorded
  const { data: rawHistory, error: historyError } = await supabase
    .from('reports')
    .select('*')
    .not('outcome_reported_at', 'is', null)
    .order('outcome_reported_at', { ascending: false })
    .limit(200);

  const historyReports = rawHistory as unknown as Report[] | null;

  const error = pendingError || historyError;

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          Error loading outcomes: {error.message}
        </div>
      </div>
    );
  }

  // Compute summary stats from history
  const allWithOutcome = (historyReports ?? []).filter(
    (r) => r.appeal_outcome && r.appeal_outcome !== 'pending_hearing'
  );
  const wins = allWithOutcome.filter((r) =>
    ['won_full', 'won_partial', 'settled_informal'].includes(r.appeal_outcome!)
  );
  const winRate =
    allWithOutcome.length > 0
      ? ((wins.length / allWithOutcome.length) * 100).toFixed(1)
      : '0.0';

  const reportsWithSavings = (historyReports ?? []).filter(
    (r) => r.actual_savings_cents != null && r.actual_savings_cents > 0
  );
  const avgSavings =
    reportsWithSavings.length > 0
      ? reportsWithSavings.reduce((sum, r) => sum + (r.actual_savings_cents ?? 0), 0) /
        reportsWithSavings.length
      : 0;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Appeal Outcomes</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track appeal results and measure success rates across counties.
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
                href={`/admin/outcomes?tab=${tab.key}`}
                className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-[#1a2744] text-[#1a2744]'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tab.key === 'pending' && pendingReports && pendingReports.length > 0 && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-[#1a2744] px-2 py-0.5 text-[10px] font-semibold text-white">
                    {pendingReports.length}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Pending Outcomes Tab */}
      {activeTab === 'pending' && (
        <>
          {pendingReports && pendingReports.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Property
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      County
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Client
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Delivered
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
                  {pendingReports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {report.property_address}
                        </div>
                        <div className="text-xs text-gray-500">
                          {[report.city, report.state].filter(Boolean).join(', ')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {report.county ?? '--'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900">
                          {report.client_name ?? '--'}
                        </div>
                        <div className="text-xs text-gray-500">{report.client_email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(report.delivered_at)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                        {formatCents(report.amount_paid_cents)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/admin/outcomes/${report.id}`}
                          className="inline-flex items-center rounded-lg bg-[#1a2744] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[#243356]"
                        >
                          Record Outcome
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
              <p className="text-sm text-gray-500">
                No delivered reports are awaiting outcome recording.
              </p>
            </div>
          )}
        </>
      )}

      {/* Outcome History Tab */}
      {activeTab === 'history' && (
        <>
          {/* Summary Stats */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Total Appeals Tracked
              </p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {(historyReports ?? []).length}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Win Rate
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{winRate}%</p>
              <p className="text-xs text-gray-400">
                {wins.length} of {allWithOutcome.length} resolved appeals
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Average Savings
              </p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {formatCents(avgSavings > 0 ? Math.round(avgSavings) : null)}
              </p>
              <p className="text-xs text-gray-400">
                {reportsWithSavings.length} reports with savings
              </p>
            </div>
          </div>

          {historyReports && historyReports.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Property
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      County
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Outcome
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Savings
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historyReports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {report.property_address}
                        </div>
                        <div className="text-xs text-gray-500">
                          {[report.city, report.state].filter(Boolean).join(', ')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {report.county ?? '--'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${outcomeColor(report.appeal_outcome)}`}
                        >
                          {formatOutcome(report.appeal_outcome)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                        {formatCents(report.actual_savings_cents)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(report.outcome_reported_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
              <p className="text-sm text-gray-500">No outcomes recorded yet.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
