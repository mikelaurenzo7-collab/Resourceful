import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/types/database';

export type OperationsTaskStatus =
  | 'open'
  | 'in_progress'
  | 'blocked'
  | 'snoozed'
  | 'resolved'
  | 'dismissed';

export type OperationsTaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type OperationsActorType = 'system' | 'automation' | 'admin';
export type AutomationRunStatus = 'running' | 'succeeded' | 'failed';

export type AutomationRun = {
  id: string;
  automation_key: string;
  status: AutomationRunStatus;
  started_at: string;
  completed_at: string | null;
  scanned_count: number;
  planned_count: number;
  created_count: number;
  reopened_count: number;
  updated_count: number;
  resolved_count: number;
  details: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
};

export type AutomationRunInsert = {
  id?: string;
  automation_key: string;
  status?: AutomationRunStatus;
  started_at?: string;
  completed_at?: string | null;
  scanned_count?: number;
  planned_count?: number;
  created_count?: number;
  reopened_count?: number;
  updated_count?: number;
  resolved_count?: number;
  details?: Record<string, unknown>;
  error_message?: string | null;
  created_at?: string;
};

export type OperationsTask = {
  id: string;
  idempotency_key: string;
  source: string;
  category: string;
  task_type: string;
  subject_type: string;
  subject_key: string;
  county_fips: string | null;
  report_id: string | null;
  title: string;
  description: string;
  status: OperationsTaskStatus;
  priority: OperationsTaskPriority;
  due_at: string | null;
  snoozed_until: string | null;
  assigned_to: string | null;
  first_detected_at: string;
  last_detected_at: string;
  resolved_at: string | null;
  resolution_code: string | null;
  resolution_notes: string | null;
  metadata: Record<string, unknown>;
  automation_run_id: string | null;
  last_actor_type: OperationsActorType;
  last_actor_id: string | null;
  last_actor_email: string | null;
  created_at: string;
  updated_at: string;
};

export type OperationsTaskInsert = {
  id?: string;
  idempotency_key: string;
  source: string;
  category: string;
  task_type: string;
  subject_type: string;
  subject_key: string;
  county_fips?: string | null;
  report_id?: string | null;
  title: string;
  description: string;
  status?: OperationsTaskStatus;
  priority?: OperationsTaskPriority;
  due_at?: string | null;
  snoozed_until?: string | null;
  assigned_to?: string | null;
  first_detected_at?: string;
  last_detected_at?: string;
  resolved_at?: string | null;
  resolution_code?: string | null;
  resolution_notes?: string | null;
  metadata?: Record<string, unknown>;
  automation_run_id?: string | null;
  last_actor_type?: OperationsActorType;
  last_actor_id?: string | null;
  last_actor_email?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type OperationsTaskEvent = {
  id: string;
  task_id: string;
  event_type: 'created' | 'status_changed' | 'priority_changed' | 'auto_resolved';
  from_status: string | null;
  to_status: string | null;
  from_priority: string | null;
  to_priority: string | null;
  actor_type: OperationsActorType;
  actor_id: string | null;
  actor_email: string | null;
  automation_run_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type JurisdictionRuleVersion = {
  id: string;
  county_fips: string;
  rule_version: number;
  content_sha256: string;
  snapshot: Record<string, unknown>;
  verified_on: string | null;
  verified_by: string | null;
  source_references: Record<string, unknown>;
  created_at: string;
};

type TableDefinition<Row, Insert, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type OperationsDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Database['public']['Tables'] & {
      automation_runs: TableDefinition<AutomationRun, AutomationRunInsert>;
      operations_tasks: TableDefinition<OperationsTask, OperationsTaskInsert>;
      operations_task_events: TableDefinition<
        OperationsTaskEvent,
        Omit<OperationsTaskEvent, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        }
      >;
      jurisdiction_rule_versions: TableDefinition<
        JurisdictionRuleVersion,
        Omit<JurisdictionRuleVersion, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        }
      >;
    };
  };
};

/**
 * The canonical database type intentionally tracks released migrations. This
 * narrow extension keeps the new control-plane tables strongly typed without
 * forcing a high-risk rewrite of the generated application-wide definition.
 */
export function createOperationsAdminClient(): SupabaseClient<OperationsDatabase> {
  return createAdminClient() as unknown as SupabaseClient<OperationsDatabase>;
}
