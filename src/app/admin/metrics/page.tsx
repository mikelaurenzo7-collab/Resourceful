import { createClient } from '@/lib/supabase/server';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatHours(ms: number): string {
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${hours.toFixed(1)}h`;
}

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

function StatCard({ label, value, subtitle, color = 'text-gray-900' }: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}

export default async function MetricsPage() {
  const supabase = await createClient();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Run all queries in parallel
  const [
    { data: rawPending },
    { data: rawDeliveredToday },
    { data: rawDeliveredWeek },
    { data: rawCompleted },
    { data: rawFailed },
    { data: rawAll },
    { data: rawPaidToday },
    { data: rawPaidMonth },
    { data: rawApprovalEvents },
  ] = await Promise.all([
    supabase
      .from('reports')
      .select('id, pipeline_completed_at')
      .eq('status', 'pending_approval'),
    supabase
      .from('reports')
      .select('id')
      .eq('status', 'delivered')
      .gte('delivered_at', todayStart),
    supabase
      .from('reports')
      .select('id')
      .eq('status', 'delivered')
      .gte('delivered_at', weekStart),
    supabase
      .from('reports')
      .select('pipeline_started_at, pipeline_completed_at')
      .not('pipeline_started_at', 'is', null)
      .not('pipeline_completed_at', 'is', null),
    supabase
      .from('reports')
      .select('id, pipeline_last_completed_stage')
      .eq('status', 'failed'),
    supabase
      .from('reports')
      .select('id')
      .not('pipeline_started_at', 'is', null),
    supabase
      .from('reports')
      .select('amount_paid_cents')
      .not('amount_paid_cents', 'is', null)
      .gte('created_at', todayStart),
    supabase
      .from('reports')
      .select('amount_paid_cents')
      .not('amount_paid_cents', 'is', null)
      .gte('created_at', monthStart),
    supabase
      .from('approval_events')
      .select('created_at, action, report_id')
      .eq('action', 'approved')
      .gte('created_at', monthStart),
  ]);

  // Cast results
  const pendingReports = rawPending as unknown as { id: string; pipeline_completed_at: string | null }[] | null;
  const deliveredToday = rawDeliveredToday as unknown as { id: string }[] | null;
  const deliveredThisWeek = rawDeliveredWeek as unknown as { id: string }[] | null;
  const allCompleted = rawCompleted as unknown as { pipeline_started_at: string; pipeline_completed_at: string }[] | null;
  const failedReports = rawFailed as unknown as { id: string; pipeline_last_completed_stage: string | null }[] | null;
  const allReports = rawAll as unknown as { id: string }[] | null;
  const paidToday = rawPaidToday as unknown as { amount_paid_cents: number }[] | null;
  const paidThisMonth = rawPaidMonth as unknown as { amount_paid_cents: number }[] | null;
  const approvalEvents = rawApprovalEvents as unknown as { created_at: string; action: string; report_id: string }[] | null;

  // Compute pending count and avg age
  const pendingCount = pendingReports?.length ?? 0;
  let avgPendingAge = '--';
  if (pendingReports && pendingReports.length > 0) {
    const totalMs = pendingReports.reduce((sum, r) => {
      if (!r.pipeline_completed_at) return sum;
      return sum + (now.getTime() - new Date(r.pipeline_completed_at).getTime());
    }, 0);
    const validCount = pendingReports.filter((r) => r.pipeline_completed_at).length;
    if (validCount > 0) {
      avgPendingAge = formatHours(totalMs / validCount);
    }
  }

  // Pipeline durations
  let avgPipelineDuration = '--';
  if (allCompleted && allCompleted.length > 0) {
    const totalMs = allCompleted.reduce((sum, r) => {
      const started = new Date(r.pipeline_started_at).getTime();
      const completed = new Date(r.pipeline_completed_at).getTime();
      return sum + (completed - started);
    }, 0);
    avgPipelineDuration = formatHours(totalMs / allCompleted.length);
  }

  // Failure rate
  const totalPipeline = allReports?.length ?? 0;
  const failedCount = failedReports?.length ?? 0;
  const failureRate = totalPipeline > 0 ? `${((failedCount / totalPipeline) * 100).toFixed(1)}%` : '0%';

  // Failure by stage
  const failureByStage: Record<string, number> = {};
  if (failedReports) {
    for (const r of failedReports) {
      const stage = r.pipeline_last_completed_stage ?? 'Unknown';
      failureByStage[stage] = (failureByStage[stage] ?? 0) + 1;
    }
  }

  // Revenue
  const revenueToday = paidToday?.reduce((sum, r) => sum + (r.amount_paid_cents ?? 0), 0) ?? 0;
  const revenueMonth = paidThisMonth?.reduce((sum, r) => sum + (r.amount_paid_cents ?? 0), 0) ?? 0;

  // Approvals this month
  const approvalCount = approvalEvents?.length ?? 0;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Metrics Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of pipeline performance, approvals, and revenue.
        </p>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <StatCard
          label="Pending Approval"
          value={pendingCount}
          subtitle={`Avg age: ${avgPendingAge}`}
          color={pendingCount > 10 ? 'text-amber-600' : 'text-[#1a2744]'}
        />
        <StatCard
          label="Delivered Today"
          value={deliveredToday?.length ?? 0}
          subtitle={`${deliveredThisWeek?.length ?? 0} this week`}
        />
        <StatCard
          label="Avg Pipeline Duration"
          value={avgPipelineDuration}
          subtitle={`${allCompleted?.length ?? 0} completed total`}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <StatCard
          label="Pipeline Failure Rate"
          value={failureRate}
          subtitle={`${failedCount} of ${totalPipeline} pipelines`}
          color={failedCount > 0 ? 'text-[#b71c1c]' : 'text-green-700'}
        />
        <StatCard
          label="Revenue Today"
          value={formatCurrency(revenueToday)}
          subtitle={`${formatCurrency(revenueMonth)} this month`}
          color="text-[#1a2744]"
        />
        <StatCard
          label="Approvals This Month"
          value={approvalCount}
          subtitle="Reports approved"
        />
      </div>

      {/* Failure Breakdown */}
      {Object.keys(failureByStage).length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-gray-900">Pipeline Failures by Stage</h2>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Stage
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Count
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    % of Failures
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(failureByStage)
                  .sort((a, b) => b[1] - a[1])
                  .map(([stage, count]) => (
                    <tr key={stage} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {stage}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-[#b71c1c]">
                        {count}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        {failedCount > 0 ? ((count / failedCount) * 100).toFixed(0) : 0}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
