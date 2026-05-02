// ─── Admin Command Center ────────────────────────────────────────────────────
// The operational nerve center of REsourceful. Replaces the old redirect with
// a real-time dashboard: pipeline health, revenue, outcomes, and quick actions.

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function fmt$(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents / 100);
}

function fmtHours(ms: number): string {
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${hours.toFixed(1)}h`;
}

export default async function AdminCommandCenter() {
  const supabase = await createClient();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // ── All queries in parallel ──────────────────────────────────────────
  const [
    { data: rawPending },
    { data: rawProcessing },
    { data: rawDeliveredToday },
    { data: rawDeliveredWeek },
    { data: rawFailed },
    { data: rawPaidToday },
    { data: rawPaidMonth },
    { data: rawOutcomes },
    { data: rawCounties },
    { data: rawRecentReports },
    { data: rawCompleted },
  ] = await Promise.all([
    supabase.from('reports').select('id, pipeline_completed_at, property_address, city, state').eq('status', 'pending_approval').limit(100),
    supabase.from('reports').select('id, pipeline_last_completed_stage').eq('status', 'processing').limit(100),
    supabase.from('reports').select('id').eq('status', 'delivered').gte('delivered_at', todayStart).limit(500),
    supabase.from('reports').select('id').eq('status', 'delivered').gte('delivered_at', weekStart).limit(500),
    supabase.from('reports').select('id, pipeline_last_completed_stage, property_address, city, state').eq('status', 'failed').gte('created_at', monthStart).limit(100),
    supabase.from('reports').select('amount_paid_cents').not('amount_paid_cents', 'is', null).gte('created_at', todayStart).limit(500),
    supabase.from('reports').select('amount_paid_cents').not('amount_paid_cents', 'is', null).gte('created_at', monthStart).limit(5000),
    supabase.from('reports').select('appeal_outcome').not('appeal_outcome', 'is', null).limit(5000),
    supabase.from('county_rules').select('county_fips').limit(10000),
    supabase.from('reports').select('id, property_address, city, state, status, service_type, created_at, pipeline_last_completed_stage').order('created_at', { ascending: false }).limit(8),
    supabase.from('reports').select('pipeline_started_at, pipeline_completed_at').not('pipeline_started_at', 'is', null).not('pipeline_completed_at', 'is', null).limit(5000),
  ]);

  type PendingRow = { id: string; pipeline_completed_at: string | null; property_address: string; city: string; state: string };
  type FailedRow = { id: string; pipeline_last_completed_stage: string | null; property_address: string; city: string; state: string };
  type AmountRow = { amount_paid_cents: number };
  type OutcomeRow = { appeal_outcome: string };
  type CountyRow = { county_fips: string };
  type RecentRow = { id: string; property_address: string; city: string; state: string; status: string; service_type: string; created_at: string; pipeline_last_completed_stage: string | null };
  type DurationRow = { pipeline_started_at: string; pipeline_completed_at: string };

  const pending = (rawPending ?? []) as PendingRow[];
  const processing = (rawProcessing ?? []) as { id: string; pipeline_last_completed_stage: string | null }[];
  const deliveredToday = (rawDeliveredToday ?? []) as { id: string }[];
  const deliveredWeek = (rawDeliveredWeek ?? []) as { id: string }[];
  const failed = (rawFailed ?? []) as FailedRow[];
  const paidToday = (rawPaidToday ?? []) as AmountRow[];
  const paidMonth = (rawPaidMonth ?? []) as AmountRow[];
  const outcomes = (rawOutcomes ?? []) as OutcomeRow[];
  const counties = (rawCounties ?? []) as CountyRow[];
  const recentReports = (rawRecentReports ?? []) as RecentRow[];
  const completed = (rawCompleted ?? []) as DurationRow[];

  // ── Compute metrics ──────────────────────────────────────────────────
  const pendingCount = pending.length;
  const processingCount = processing.length;
  const deliveredTodayCount = deliveredToday.length;
  const deliveredWeekCount = deliveredWeek.length;
  const failedCount = failed.length;
  const countyCount = counties.length;

  const revenueToday = paidToday.reduce((s, r) => s + (r.amount_paid_cents ?? 0), 0);
  const revenueMonth = paidMonth.reduce((s, r) => s + (r.amount_paid_cents ?? 0), 0);

  // Win rate from outcomes
  const wonOutcomes = outcomes.filter(o => ['won', 'won_full', 'won_partial', 'settled_informal'].includes(o.appeal_outcome));
  const resolvedOutcomes = outcomes.filter(o => !['pending', 'didnt_file'].includes(o.appeal_outcome));
  const winRate = resolvedOutcomes.length > 0 ? Math.round((wonOutcomes.length / resolvedOutcomes.length) * 100) : null;

  // Avg pipeline duration
  let avgDuration = '--';
  if (completed.length > 0) {
    const totalMs = completed.reduce((s, r) => s + (new Date(r.pipeline_completed_at).getTime() - new Date(r.pipeline_started_at).getTime()), 0);
    avgDuration = fmtHours(totalMs / completed.length);
  }

  // Oldest pending report age
  let oldestPendingAge: string | null = null;
  if (pending.length > 0) {
    const ages = pending
      .filter(r => r.pipeline_completed_at)
      .map(r => now.getTime() - new Date(r.pipeline_completed_at!).getTime());
    if (ages.length > 0) {
      oldestPendingAge = fmtHours(Math.max(...ages));
    }
  }

  // Status helpers
  const statusColor: Record<string, string> = {
    delivered: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    pending_approval: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    processing: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    failed: 'bg-red-500/15 text-red-400 border-red-500/20',
    paid: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
    intake: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  };

  const stageLabels: Record<string, string> = {
    '1': 'Data Collection',
    '2': 'Comparables',
    '3': 'Income',
    '4': 'Photos',
    '5': 'Narratives',
    '6': 'Filing Guide',
    '7': 'PDF Assembly',
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-100">Command Center</h1>
        <p className="mt-1 text-sm text-gray-500">
          {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* ── Critical Alerts ──────────────────────────────────────────── */}
      {(pendingCount > 5 || failedCount > 0 || (oldestPendingAge && parseFloat(oldestPendingAge) > 4)) && (
        <div className="mb-6 space-y-2">
          {pendingCount > 5 && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-950/20 px-4 py-3">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <p className="text-sm text-amber-300">
                <span className="font-semibold">{pendingCount} reports</span> waiting for approval
                {oldestPendingAge && <span className="text-amber-400/60"> &middot; oldest: {oldestPendingAge}</span>}
              </p>
              <Link href="/admin/reports?status=pending_approval" className="ml-auto text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors">
                Review Now &rarr;
              </Link>
            </div>
          )}
          {failedCount > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-950/20 px-4 py-3">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <p className="text-sm text-red-300">
                <span className="font-semibold">{failedCount} pipeline failure{failedCount !== 1 ? 's' : ''}</span> this month
              </p>
              <Link href="/admin/reports?status=failed" className="ml-auto text-xs font-medium text-red-400 hover:text-red-300 transition-colors">
                Investigate &rarr;
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Primary Metrics ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Pending Approval"
          value={pendingCount}
          accent={pendingCount > 0 ? 'amber' : 'default'}
          subtitle={pendingCount > 0 ? 'Awaiting review' : 'Queue clear'}
        />
        <MetricCard
          label="In Pipeline"
          value={processingCount}
          accent="blue"
          subtitle={processingCount > 0 ? 'Currently processing' : 'Idle'}
        />
        <MetricCard
          label="Delivered Today"
          value={deliveredTodayCount}
          accent="emerald"
          subtitle={`${deliveredWeekCount} this week`}
        />
        <MetricCard
          label="Revenue Today"
          value={fmt$(revenueToday)}
          accent="gold"
          subtitle={`${fmt$(revenueMonth)} this month`}
        />
      </div>

      {/* ── Operations + Intelligence ────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Pipeline Health */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-4">Pipeline Health</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Avg Duration</span>
              <span className="text-sm font-semibold text-gray-200">{avgDuration}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Completed Total</span>
              <span className="text-sm font-semibold text-gray-200">{completed.length.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Failed This Month</span>
              <span className={`text-sm font-semibold ${failedCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{failedCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Success Rate</span>
              <span className="text-sm font-semibold text-emerald-400">
                {completed.length > 0 ? `${(((completed.length - failedCount) / completed.length) * 100).toFixed(1)}%` : '--'}
              </span>
            </div>
          </div>
        </div>

        {/* Outcome Intelligence */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-4">Outcome Intelligence</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Appeal Win Rate</span>
              <span className={`text-sm font-semibold ${winRate && winRate > 50 ? 'text-emerald-400' : 'text-gray-200'}`}>
                {winRate != null ? `${winRate}%` : 'No data yet'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Outcomes Recorded</span>
              <span className="text-sm font-semibold text-gray-200">{outcomes.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Appeals Won</span>
              <span className="text-sm font-semibold text-gray-200">{wonOutcomes.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Pending Feedback</span>
              <span className="text-sm font-semibold text-gray-200">
                {outcomes.filter(o => o.appeal_outcome === 'pending').length}
              </span>
            </div>
          </div>
        </div>

        {/* Coverage */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-4">Coverage</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Counties in Database</span>
              <span className="text-sm font-semibold text-gray-200">{countyCount.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Reports Generated</span>
              <span className="text-sm font-semibold text-gray-200">{(completed.length + processingCount + pendingCount).toLocaleString()}</span>
            </div>
          </div>
          <Link
            href="/admin/counties"
            className="mt-4 flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
          >
            Manage Counties
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </Link>
        </div>
      </div>

      {/* ── Recent Reports ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Recent Reports</h3>
          <Link href="/admin/reports" className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors">
            View All &rarr;
          </Link>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {recentReports.map((r) => (
            <Link
              key={r.id}
              href={`/admin/reports/${r.id}/review`}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.03] transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-200 truncate">
                  {r.property_address}{r.city ? `, ${r.city}` : ''}{r.state ? `, ${r.state}` : ''}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {r.service_type === 'tax_appeal' ? 'Tax Appeal' : r.service_type === 'pre_purchase' ? 'Pre-Purchase' : 'Pre-Listing'}
                  {r.pipeline_last_completed_stage && r.status === 'processing' ? ` · Stage ${r.pipeline_last_completed_stage}: ${stageLabels[r.pipeline_last_completed_stage] ?? ''}` : ''}
                </p>
              </div>
              <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusColor[r.status] ?? statusColor.intake}`}>
                {r.status === 'pending_approval' ? 'Review' : r.status.replace(/_/g, ' ')}
              </span>
              <span className="text-[11px] text-gray-500 whitespace-nowrap">
                {timeAgo(new Date(r.created_at), now)}
              </span>
            </Link>
          ))}
          {recentReports.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-gray-500">No reports yet</div>
          )}
        </div>
      </div>

      {/* ── Quick Actions ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
        <QuickAction href="/admin/reports?status=pending_approval" label="Review Queue" count={pendingCount > 0 ? pendingCount : undefined} />
        <QuickAction href="/admin/metrics" label="Full Metrics" />
        <QuickAction href="/admin/outcomes" label="Outcomes" count={winRate != null ? `${winRate}% win` : undefined} />
        <QuickAction href="/admin/counties" label="Counties" count={countyCount > 0 ? countyCount : undefined} />
      </div>
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function MetricCard({ label, value, subtitle, accent = 'default' }: {
  label: string;
  value: string | number;
  subtitle?: string;
  accent?: 'amber' | 'emerald' | 'blue' | 'gold' | 'default';
}) {
  const accentColors = {
    amber: 'text-amber-300',
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    gold: 'text-amber-300',
    default: 'text-gray-100',
  };
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold ${accentColors[accent]}`}>{value}</p>
      {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
}

function QuickAction({ href, label, count }: { href: string; label: string; count?: number | string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 hover:border-amber-400/20 hover:bg-amber-400/[0.03] transition-all"
    >
      <span className="text-sm font-medium text-gray-300 group-hover:text-gray-100 transition-colors">{label}</span>
      {count != null && (
        <span className="text-xs font-semibold text-amber-400/80 bg-amber-400/10 px-2 py-0.5 rounded-full">{count}</span>
      )}
    </Link>
  );
}

function timeAgo(date: Date, now: Date): string {
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
