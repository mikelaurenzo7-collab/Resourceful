import { cronLogger } from '@/lib/logger';
import type { CountyRule } from '@/types/database';
import {
  JURISDICTION_OPERATIONS_SOURCE,
  planJurisdictionTasks,
  type PlannedJurisdictionTask,
} from './jurisdiction-task-planner';
import {
  createOperationsAdminClient,
  type OperationsTask,
  type OperationsTaskInsert,
  type OperationsTaskStatus,
} from './types';

const PAGE_SIZE = 1000;
const WRITE_BATCH_SIZE = 200;

export const JURISDICTION_AUTOMATION_KEY = 'jurisdiction_operations_v1';

export type JurisdictionOperationsResult = {
  runId: string;
  scannedCount: number;
  plannedCount: number;
  createdCount: number;
  reopenedCount: number;
  updatedCount: number;
  resolvedCount: number;
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fetchAllCountyRules(): Promise<CountyRule[]> {
  const supabase = createOperationsAdminClient();
  const rules: CountyRule[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('county_rules')
      .select('*')
      .order('county_fips', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to load county rules: ${error.message}`);
    const page = data ?? [];
    rules.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rules;
}

async function fetchExistingTasks(): Promise<OperationsTask[]> {
  const supabase = createOperationsAdminClient();
  const tasks: OperationsTask[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('operations_tasks')
      .select('*')
      .eq('source', JURISDICTION_OPERATIONS_SOURCE)
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to load operations tasks: ${error.message}`);
    const page = data ?? [];
    tasks.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return tasks;
}

function nextDetectedStatus(existing: OperationsTask | undefined, now: Date): OperationsTaskStatus {
  if (!existing || existing.status === 'resolved') return 'open';

  if (
    existing.status === 'snoozed' &&
    (!existing.snoozed_until || new Date(existing.snoozed_until).getTime() <= now.getTime())
  ) {
    return 'open';
  }

  return existing.status;
}

function taskTypeCounts(tasks: PlannedJurisdictionTask[]): Record<string, number> {
  return tasks.reduce<Record<string, number>>((counts, task) => {
    counts[task.task_type] = (counts[task.task_type] ?? 0) + 1;
    return counts;
  }, {});
}

/**
 * Reconciles deterministic jurisdiction conditions into durable operations
 * tasks. Safe to retry: each condition has one stable idempotency key.
 */
export async function runJurisdictionOperationsReconciliation(options?: {
  now?: Date;
}): Promise<JurisdictionOperationsResult> {
  const now = options?.now ?? new Date();
  const nowIso = now.toISOString();
  const supabase = createOperationsAdminClient();
  let runId: string | null = null;

  try {
    const { data: run, error: runError } = await supabase
      .from('automation_runs')
      .insert({
        automation_key: JURISDICTION_AUTOMATION_KEY,
        status: 'running',
        started_at: nowIso,
        details: { source: JURISDICTION_OPERATIONS_SOURCE },
      })
      .select('id')
      .single();

    if (runError || !run) {
      throw new Error(`Failed to create automation run: ${runError?.message ?? 'unknown error'}`);
    }
    const currentRunId = run.id;
    runId = currentRunId;

    const [rules, existingTasks] = await Promise.all([
      fetchAllCountyRules(),
      fetchExistingTasks(),
    ]);

    const plannedTasks = rules.flatMap((rule) => planJurisdictionTasks(rule, now));
    const existingByKey = new Map(existingTasks.map((task) => [task.idempotency_key, task]));
    const plannedKeys = new Set(plannedTasks.map((task) => task.idempotency_key));

    let createdCount = 0;
    let reopenedCount = 0;
    let updatedCount = 0;

    const upsertRows: OperationsTaskInsert[] = plannedTasks.map((task) => {
      const existing = existingByKey.get(task.idempotency_key);
      const status = nextDetectedStatus(existing, now);
      const reopened = Boolean(existing && existing.status !== status);

      if (!existing) createdCount += 1;
      else if (reopened) reopenedCount += 1;
      else updatedCount += 1;

      const remainsResolved = status === 'resolved' || status === 'dismissed';
      const remainsSnoozed = status === 'snoozed';

      return {
        ...task,
        status,
        assigned_to: existing?.assigned_to ?? null,
        snoozed_until: remainsSnoozed ? existing?.snoozed_until ?? null : null,
        first_detected_at: existing?.first_detected_at ?? nowIso,
        last_detected_at: nowIso,
        resolved_at: remainsResolved ? existing?.resolved_at ?? nowIso : null,
        resolution_code: remainsResolved ? existing?.resolution_code ?? null : null,
        resolution_notes: remainsResolved ? existing?.resolution_notes ?? null : null,
        automation_run_id: currentRunId,
        last_actor_type: 'automation',
        last_actor_id: null,
        last_actor_email: null,
      };
    });

    for (const batch of chunk(upsertRows, WRITE_BATCH_SIZE)) {
      const { error } = await supabase
        .from('operations_tasks')
        .upsert(batch, { onConflict: 'idempotency_key' });
      if (error) throw new Error(`Failed to reconcile operations tasks: ${error.message}`);
    }

    const obsoleteTaskIds = existingTasks
      .filter(
        (task) =>
          !plannedKeys.has(task.idempotency_key) &&
          task.status !== 'resolved'
      )
      .map((task) => task.id);

    for (const ids of chunk(obsoleteTaskIds, WRITE_BATCH_SIZE)) {
      const { error } = await supabase
        .from('operations_tasks')
        .update({
          status: 'resolved',
          resolved_at: nowIso,
          resolution_code: 'condition_cleared',
          resolution_notes:
            'Automatically resolved because the underlying jurisdiction condition no longer exists.',
          snoozed_until: null,
          automation_run_id: currentRunId,
          last_actor_type: 'automation',
          last_actor_id: null,
          last_actor_email: null,
        })
        .in('id', ids);
      if (error) throw new Error(`Failed to auto-resolve cleared tasks: ${error.message}`);
    }

    const resolvedCount = obsoleteTaskIds.length;
    const result: JurisdictionOperationsResult = {
      runId: currentRunId,
      scannedCount: rules.length,
      plannedCount: plannedTasks.length,
      createdCount,
      reopenedCount,
      updatedCount,
      resolvedCount,
    };

    const { error: completeError } = await supabase
      .from('automation_runs')
      .update({
        status: 'succeeded',
        completed_at: new Date().toISOString(),
        scanned_count: result.scannedCount,
        planned_count: result.plannedCount,
        created_count: result.createdCount,
        reopened_count: result.reopenedCount,
        updated_count: result.updatedCount,
        resolved_count: result.resolvedCount,
        details: {
          source: JURISDICTION_OPERATIONS_SOURCE,
          task_type_counts: taskTypeCounts(plannedTasks),
        },
        error_message: null,
      })
      .eq('id', currentRunId);

    if (completeError) {
      throw new Error(`Failed to complete automation run: ${completeError.message}`);
    }

    cronLogger.info(result, 'Jurisdiction operations reconciliation completed');
    return result;
  } catch (error) {
    if (runId) {
      const failedAt = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('automation_runs')
        .update({
          status: 'failed',
          completed_at: failedAt,
          error_message: errorMessage(error).slice(0, 4000),
        })
        .eq('id', runId);

      if (updateError) {
        cronLogger.error(
          { err: updateError, runId },
          'Failed to persist jurisdiction automation failure state'
        );
      }
    }

    cronLogger.error({ err: error, runId }, 'Jurisdiction operations reconciliation failed');
    throw error;
  }
}
