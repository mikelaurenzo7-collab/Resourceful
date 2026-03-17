// ─── Admin Repository ────────────────────────────────────────────────────────
// Typed data access for admin_users and approval_events tables.

import { createAdminClient } from '@/lib/supabase/admin';
import type {
  AdminUser,
  ApprovalEvent,
  ApprovalEventInsert,
} from '@/types/database';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

function getClient(supabase?: SupabaseAdmin): SupabaseAdmin {
  return supabase ?? createAdminClient();
}

export async function getAdminUser(
  userId: string,
  supabase?: SupabaseAdmin
): Promise<AdminUser | null> {
  const client = getClient(supabase);
  const { data, error } = await client
    .from('admin_users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch admin user: ${error.message}`);
  }
  return data as unknown as AdminUser;
}

export async function isAdmin(
  userId: string,
  supabase?: SupabaseAdmin
): Promise<boolean> {
  const admin = await getAdminUser(userId, supabase);
  return admin !== null;
}

export async function getApprovalEvents(
  reportId: string,
  supabase?: SupabaseAdmin
): Promise<ApprovalEvent[]> {
  const client = getClient(supabase);
  const { data, error } = await client
    .from('approval_events')
    .select('*')
    .eq('report_id', reportId)
    .order('created_at', { ascending: false });

  if (error)
    throw new Error(`Failed to fetch approval events: ${error.message}`);
  return (data ?? []) as unknown as ApprovalEvent[];
}

export async function createApprovalEvent(
  data: ApprovalEventInsert,
  supabase?: SupabaseAdmin
): Promise<ApprovalEvent> {
  const client = getClient(supabase);
  const { data: event, error } = await client
    .from('approval_events')
    .insert(data)
    .select()
    .single();

  if (error)
    throw new Error(`Failed to create approval event: ${error.message}`);
  return event as unknown as ApprovalEvent;
}
