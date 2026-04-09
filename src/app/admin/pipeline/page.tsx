// ─── Admin Pipeline Health Dashboard ─────────────────────────────────────────
// Shows reports stuck in 'paid' or 'processing' status with inline actions
// to force-fail or rerun the pipeline. Complements the stale-pipeline cron
// for cases requiring manual admin intervention.

import { createClient } from '@/lib/supabase/server';
import PipelineActions from './PipelineActions';

export const dynamic = 'force-dynamic';

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours}h ${remaining}m`;
}

const STAGE_LABELS: Record<string, string> = {
  'stage-1-data': 'Data Collection',
  'stage-2-comps': 'Comparables',
  'stage-3-income': 'Income Analysis',
  'stage-4-photos': 'Photo Analysis',
  'stage-5-narratives': 'Narratives',
  'stage-6-filing': 'Filing Guide',
  'stage-7-pdf': 'PDF Assembly',
};

interface StuckReport {
  id: string;
  property_address: string;
  city: string | null;
  state: string | null;
  client_email: string;
  status: string;
  created_at: string;
  pipeline_started_at: string | null;
  pipeline_last_completed_stage: string | null;
  pipeline_error_log: Record<string, unknown> | null;
}

interface RecentFailure {
  id: string;
  property_address: string;
  city: string | null;
  state: string | null;
  status: string;
  pipeline_last_completed_stage: string | null;
  pipeline_error_log: Record<string, unknown> | null;
  created_at: string;
}

interface CompletedReport {
  pipeline_started_at: string;
  pipeline_completed_at: string;
}

export default async function PipelineHealthPage() {
  const supabase = await createClient();
  const now = Date.now();
  const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: rawStuckPaid },
    { data: rawStuckProcessing },
    { data: rawRecentFailures },
    { data: rawRecentCompleted },
    { data: rawActiveProcessing },
  ] = await Promise.all([
    // Reports stuck in 'paid' for >1 hour
    supabase
      .from('reports')
      .select('id, property_address, city, state, client_email, status, created_at, pipeline_started_at, pipeline_last_completed_stage, pipeline_error_log')
      .eq('status', 'paid')
      .lt('created_at', oneHourAgo)
      .order('created_at', { ascending: true })
      .limit(50),
    // Reports stuck in 'processing' for >2 hours
    supabase
      .from('reports')
      .select('id, property_address, city, state, client_email, status, created_at, pipeline_started_at, pipeline_last_completed_stage, pipeline_error_log')
      .eq('status', 'processing')
      .lt('pipeline_started_at', twoHoursAgo)
      .order('pipeline_started_at', { ascending: true })
      .limit(50),
    // Recent failures (last 7 days)
    supabase
      .from('reports')
      .select('id, property_address, city, state, status, pipeline_last_completed_stage, pipeline_error_log, created_at')
      .eq('status', 'failed')
      .gte('created_at', weekAgo)
      .order('created_at', { ascending: false })
      .limit(20),
    // Recent completed (for timing stats)
    supabase
      .from('reports')
      .select('pipeline_started_at, pipeline_completed_at')
      .not('pipeline_started_at', 'is', null)
      .not('pipeline_completed_at', 'is', null)
      .gte('pipeline_completed_at', weekAgo)
      .limit(100),
    // Currently processing (healthy)
    supabase
      .from('reports')
      .select('id, pipeline_started_at, pipeline_last_completed_stage')
      .eq('status', 'processing')
      .gte('pipeline_started_at', twoHoursAgo)
      .limit(50),
  ]);

  const stuckPaid = (rawStuckPaid ?? []) as StuckReport[];
  const stuckProcessing = (rawStuckProcessing ?? []) as StuckReport[];
  const recentFailures = (rawRecentFailures ?? []) as RecentFailure[];
  const recentCompleted = (rawRecentCompleted ?? []) as CompletedReport[];
  const activeProcessing = (rawActiveProcessing ?? []) as { id: string; pipeline_started_at: string; pipeline_last_completed_stage: string | null }[];

  const totalStuck = stuckPaid.length + stuckProcessing.length;

  // Timing stats
  let avgDurationMs = 0;
  let p95DurationMs = 0;
  if (recentCompleted.length > 0) {
    const durations = recentCompleted
      .map(r => new Date(r.pipeline_completed_at).getTime() - new Date(r.pipeline_started_at).getTime())
      .sort((a, b) => a - b);
    avgDurationMs = durations.reduce((s, d) => s + d, 0) / durations.length;
    p95DurationMs = durations[Math.floor(durations.length * 0.95)] ?? avgDurationMs;
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-100">Pipeline Health</h1>
        <p className="mt-1 text-sm text-gray-500">
          Monitor pipeline performance, detect stuck reports, and take corrective action.
        </p>
      </div>

      {/* Alert Banner */}
      {totalStuck > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-950/20 px-4 py-3">
          <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          <p className="text-sm text-red-300">
            <span className="font-semibold">{totalStuck} report{totalStuck !== 1 ? 's' : ''}</span> stuck in pipeline
          </p>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <MetricCard
          label="Stuck Reports"
          value={totalStuck}
          accent={totalStuck > 0 ? 'red' : 'emerald'}
          subtitle={totalStuck === 0 ? 'All clear' : 'Needs attention'}
        />
        <MetricCard
          label="Active Pipelines"
          value={activeProcessing.length}
          accent="blue"
          subtitle="Currently running"
        />
        <MetricCard
          label="Failed (7d)"
          value={recentFailures.length}
          accent={recentFailures.length > 0 ? 'amber' : 'emerald'}
        />
        <MetricCard
          label="Avg Duration"
          value={recentCompleted.length > 0 ? formatDuration(avgDurationMs) : '--'}
          accent="default"
          subtitle="Last 7 days"
        />
        <MetricCard
          label="P95 Duration"
          value={recentCompleted.length > 0 ? formatDuration(p95DurationMs) : '--'}
          accent="default"
          subtitle="Last 7 days"
        />
      </div>

      {/* Stuck in Paid */}
      <Section
        title="Stuck in &lsquo;Paid&rsquo;"
        subtitle="Pipeline never started — reports waiting >1 hour"
        count={stuckPaid.length}
        accentColor="amber"
      >
        {stuckPaid.length === 0 ? (
          <EmptyState message="No reports stuck in paid status." />
        ) : (
          stuckPaid.map(report => (
            <StuckReportRow key={report.id} report={report} now={now} stageLabels={STAGE_LABELS} />
          ))
        )}
      </Section>

      {/* Stuck in Processing */}
      <Section
        title="Stuck in &lsquo;Processing&rsquo;"
        subtitle="Pipeline started but hasn't completed in >2 hours"
        count={stuckProcessing.length}
        accentColor="red"
      >
        {stuckProcessing.length === 0 ? (
          <EmptyState message="No reports stuck in processing." />
        ) : (
          stuckProcessing.map(report => (
            <StuckReportRow key={report.id} report={report} now={now} stageLabels={STAGE_LABELS} />
          ))
        )}
      </Section>

      {/* Recent Failures */}
      <Section
        title="Recent Failures"
        subtitle="Failed in the last 7 days — click to review and retry"
        count={recentFailures.length}
        accentColor="default"
      >
        {recentFailures.length === 0 ? (
          <EmptyState message="No failures in the last 7 days." />
        ) : (
          recentFailures.map(report => (
            <FailedReportRow key={report.id} report={report} stageLabels={STAGE_LABELS} />
          ))
        )}
      </Section>
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function MetricCard({ label, value, subtitle, accent = 'default' }: {
  label: string;
  value: string | number;
  subtitle?: string;
  accent?: 'amber' | 'emerald' | 'blue' | 'red' | 'default';
}) {
  const accentColors = {
    amber: 'text-amber-300',
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    red: 'text-red-400',
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

function Section({ title, subtitle, count, accentColor, children }: {
  title: string;
  subtitle: string;
  count: number;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-bold text-gray-100" dangerouslySetInnerHTML={{ __html: title }} />
        {count > 0 && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            accentColor === 'red'
              ? 'bg-red-500/10 text-red-400'
              : accentColor === 'amber'
                ? 'bg-amber-500/10 text-amber-400'
                : 'bg-white/[0.06] text-gray-400'
          }`}>
            {count}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-3">{subtitle}</p>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}

function StuckReportRow({ report, now, stageLabels }: {
  report: StuckReport;
  now: number;
  stageLabels: Record<string, string>;
}) {
  const stuckSince = report.pipeline_started_at ?? report.created_at;
  const stuckMs = now - new Date(stuckSince).getTime();

  const errorLog = report.pipeline_error_log;
  const errorMessage = errorLog && typeof errorLog === 'object' && 'error' in errorLog
    ? String(errorLog.error)
    : null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-200 truncate">
            {report.property_address}
            {report.city && `, ${report.city}`}
            {report.state && `, ${report.state}`}
          </p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
            <span className={`font-semibold ${report.status === 'processing' ? 'text-blue-400' : 'text-amber-400'}`}>
              {report.status}
            </span>
            <span>
              Stuck for {formatDuration(stuckMs)}
            </span>
            {report.pipeline_last_completed_stage && (
              <span>
                Last stage: {stageLabels[report.pipeline_last_completed_stage] ?? report.pipeline_last_completed_stage}
              </span>
            )}
          </div>
          {errorMessage && (
            <p className="mt-2 text-xs text-red-400/80 font-mono bg-red-500/5 rounded px-2 py-1 truncate">
              {errorMessage}
            </p>
          )}
        </div>
        <PipelineActions reportId={report.id} reportStatus={report.status} />
      </div>
    </div>
  );
}

function FailedReportRow({ report, stageLabels }: {
  report: RecentFailure;
  stageLabels: Record<string, string>;
}) {
  const errorLog = report.pipeline_error_log;
  const errorMessage = errorLog && typeof errorLog === 'object' && 'error' in errorLog
    ? String(errorLog.error)
    : null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-200 truncate">
            {report.property_address}
            {report.city && `, ${report.city}`}
            {report.state && `, ${report.state}`}
          </p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
            <span className="font-semibold text-red-400">failed</span>
            {report.pipeline_last_completed_stage && (
              <span>
                Failed at: {stageLabels[report.pipeline_last_completed_stage] ?? report.pipeline_last_completed_stage}
              </span>
            )}
          </div>
          {errorMessage && (
            <p className="mt-2 text-xs text-red-400/80 font-mono bg-red-500/5 rounded px-2 py-1 truncate">
              {errorMessage}
            </p>
          )}
        </div>
        <PipelineActions reportId={report.id} reportStatus={report.status} />
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}
