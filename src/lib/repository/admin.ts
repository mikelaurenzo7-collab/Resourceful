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

/**
 * Stricter admin check: requires BOTH an admin_users row AND a matching email
 * on the authenticated user record. Protects against stale admin_users rows
 * (e.g. after a user was deleted and their UUID reassigned) and against an
 * accidental admin_users insert with a mismatched user_id.
 */
export async function isAdminWithEmailMatch(
  userId: string,
  authEmail: string | null | undefined,
  supabase?: SupabaseAdmin
): Promise<boolean> {
  if (!authEmail) return false;
  const admin = await getAdminUser(userId, supabase);
  if (!admin) return false;
  return admin.email?.toLowerCase().trim() === authEmail.toLowerCase().trim();
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
