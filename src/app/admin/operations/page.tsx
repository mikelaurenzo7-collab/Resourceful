import Link from 'next/link';
import {
  createOperationsAdminClient,
  type AutomationRun,
  type OperationsTask,
  type OperationsTaskPriority,
} from '@/lib/operations/types';
import {
  mutateOperationsTaskAction,
  runJurisdictionScanAction,
} from './actions';

export const dynamic = 'force-dynamic';

const priorityOrder: Record<OperationsTaskPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const priorityClasses: Record<OperationsTaskPriority, string> = {
  critical: 'border-red-400/25 bg-red-400/10 text-red-300',
  high: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  medium: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
  low: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
};

const statusClasses: Record<OperationsTask['status'], string> = {
  open: 'text-gray-300',
  in_progress: 'text-blue-300',
  blocked: 'text-red-300',
  snoozed: 'text-violet-300',
  resolved: 'text-emerald-300',
  dismissed: 'text-gray-500',
};

function formatDate(value: string | null): string {
  if (!value) return 'No deadline';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function isOverdue(task: OperationsTask, now: number): boolean {
  if (!task.due_at || task.status === 'snoozed') return false;
  return new Date(task.due_at).getTime() < now;
}

function taskSubjectHref(task: OperationsTask): string | null {
  if (task.county_fips) return `/admin/counties/${task.county_fips}/edit`;
  if (task.report_id) return `/admin/reports/${task.report_id}/review`;
  return null;
}

async function getOperationsData(): Promise<{
  tasks: OperationsTask[];
  latestRun: AutomationRun | null;
}> {
  const supabase = createOperationsAdminClient();
  const [{ data: tasks, error: tasksError }, { data: latestRun, error: runError }] =
    await Promise.all([
      supabase
        .from('operations_tasks')
        .select('*')
        .in('status', ['open', 'in_progress', 'blocked', 'snoozed'])
        .limit(500),
      supabase
        .from('automation_runs')
        .select('*')
        .eq('automation_key', 'jurisdiction_operations_v1')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (tasksError) throw new Error(`Failed to load operations queue: ${tasksError.message}`);
  if (runError) throw new Error(`Failed to load automation history: ${runError.message}`);

  const typedTasks = (tasks ?? []) as OperationsTask[];

  return {
    tasks: typedTasks.sort((a, b) => {
      const priorityDelta = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDelta !== 0) return priorityDelta;
      const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
      return aDue - bDue;
    }),
    latestRun: (latestRun as AutomationRun | null) ?? null,
  };
}

function ActionButton({
  taskId,
  action,
  children,
  emphasized = false,
}: {
  taskId: string;
  action: 'start' | 'block' | 'snooze' | 'resolve' | 'dismiss' | 'reopen';
  children: React.ReactNode;
  emphasized?: boolean;
}) {
  return (
    <form action={mutateOperationsTaskAction}>
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="action" value={action} />
      <button
        type="submit"
        className={
          emphasized
            ? 'rounded-md bg-amber-400 px-2.5 py-1.5 text-xs font-semibold text-[#111827] transition hover:bg-amber-300'
            : 'rounded-md border border-white/10 px-2.5 py-1.5 text-xs font-medium text-gray-300 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white'
        }
      >
        {children}
      </button>
    </form>
  );
}

export default async function OperationsPage() {
  const { tasks, latestRun } = await getOperationsData();
  const now = Date.now();
  const criticalCount = tasks.filter((task) => task.priority === 'critical').length;
  const overdueCount = tasks.filter((task) => isOverdue(task, now)).length;
  const inProgressCount = tasks.filter((task) => task.status === 'in_progress').length;

  return (
    <div className="min-h-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 border-b border-white/[0.07] pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
                Control plane
              </span>
              <span className="text-xs text-gray-500">Idempotent · auditable · fail-closed</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Operations Autopilot
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
              Durable work generated from release blockers and maintenance conditions. The first
              reconciliation protects jurisdiction rules; filing, evidence, and delivery work can
              enter the same queue next.
            </p>
          </div>

          <form action={runJurisdictionScanAction}>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-[#111827] shadow-sm transition hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300/40"
            >
              Run reconciliation
            </button>
          </form>
        </div>

        <div className="grid gap-3 py-6 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Active work', value: tasks.length, detail: 'Open control-plane tasks' },
            { label: 'Critical', value: criticalCount, detail: 'Immediate release or deadline risk' },
            { label: 'Overdue', value: overdueCount, detail: 'Past due and not snoozed' },
            { label: 'In progress', value: inProgressCount, detail: 'Actively owned work' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 shadow-sm"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{stat.label}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{stat.value}</p>
              <p className="mt-1 text-xs text-gray-500">{stat.detail}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 rounded-xl border border-white/[0.07] bg-[#111b2a] px-4 py-3 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Latest jurisdiction run
            </p>
            <p className="mt-1 text-sm text-gray-300">
              {latestRun
                ? `${latestRun.status} · ${formatDate(latestRun.started_at)}`
                : 'No reconciliation has run yet.'}
            </p>
          </div>
          {latestRun && (
            <p className="mt-2 text-xs text-gray-500 sm:mt-0">
              {latestRun.scanned_count} counties scanned · {latestRun.created_count} created ·{' '}
              {latestRun.resolved_count} auto-resolved
            </p>
          )}
        </div>

        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="m5 12 4 4L19 6" />
              </svg>
            </div>
            <h2 className="mt-4 text-base font-semibold text-white">No active operations work</h2>
            <p className="mt-2 text-sm text-gray-500">
              Run reconciliation to verify the queue against current jurisdiction records.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const overdue = isOverdue(task, now);
              const subjectHref = taskSubjectHref(task);
              const eligibilityCode =
                typeof task.metadata.eligibility_code === 'string'
                  ? task.metadata.eligibility_code
                  : null;

              return (
                <article
                  key={task.id}
                  className="rounded-xl border border-white/[0.08] bg-[#111b2a] p-4 shadow-sm transition hover:border-white/[0.13] sm:p-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${priorityClasses[task.priority]}`}
                        >
                          {task.priority}
                        </span>
                        <span className={`text-xs font-medium ${statusClasses[task.status]}`}>
                          {task.status.replace('_', ' ')}
                        </span>
                        {overdue && (
                          <span className="text-xs font-semibold text-red-300">Overdue</span>
                        )}
                        {eligibilityCode && (
                          <span className="font-mono text-[10px] text-gray-600">{eligibilityCode}</span>
                        )}
                      </div>

                      <h2 className="mt-3 text-base font-semibold text-white">{task.title}</h2>
                      <p className="mt-1.5 max-w-4xl text-sm leading-6 text-gray-400">
                        {task.description}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500">
                        <span>
                          Due{' '}
                          <strong className={overdue ? 'font-semibold text-red-300' : 'font-medium text-gray-300'}>
                            {formatDate(task.due_at)}
                          </strong>
                        </span>
                        <span>Detected {formatDate(task.first_detected_at)}</span>
                        <span className="font-mono">{task.subject_key}</span>
                        {subjectHref && (
                          <Link
                            href={subjectHref}
                            className="font-semibold text-amber-300 transition hover:text-amber-200"
                          >
                            Open source record →
                          </Link>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 xl:max-w-[270px] xl:justify-end">
                      {task.status === 'open' && (
                        <ActionButton taskId={task.id} action="start" emphasized>
                          Start
                        </ActionButton>
                      )}
                      {(task.status === 'blocked' || task.status === 'snoozed') && (
                        <ActionButton taskId={task.id} action="reopen" emphasized>
                          Reopen
                        </ActionButton>
                      )}
                      {task.status !== 'blocked' && (
                        <ActionButton taskId={task.id} action="block">
                          Block
                        </ActionButton>
                      )}
                      {task.status !== 'snoozed' && (
                        <ActionButton taskId={task.id} action="snooze">
                          Snooze 7d
                        </ActionButton>
                      )}
                      <ActionButton taskId={task.id} action="resolve">
                        Resolve
                      </ActionButton>
                      <ActionButton taskId={task.id} action="dismiss">
                        Dismiss
                      </ActionButton>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
