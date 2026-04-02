// ─── Partner API Service ─────────────────────────────────────────────────────
// Manages API key lifecycle, partner authentication, and usage tracking
// for the white-label Partner API.

import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ApiPartner = {
  id: string;
  firm_name: string;
  contact_email: string;
  contact_name: string | null;
  api_key: string;
  api_key_prefix: string;
  is_active: boolean;
  revenue_share_pct: number;
  per_report_fee_cents: number;
  white_label_name: string | null;
  white_label_logo_url: string | null;
  monthly_report_limit: number | null;
  reports_this_month: number;
  total_reports_generated: number;
  total_revenue_cents: number;
  created_at: string;
  updated_at: string;
};

export type PartnerStats = {
  firm_name: string;
  reports_this_month: number;
  total_reports_generated: number;
  total_revenue_cents: number;
  monthly_report_limit: number | null;
  per_report_fee_cents: number;
  revenue_share_pct: number;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function hashKey(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

// ─── Validate API Key ───────────────────────────────────────────────────────
// Looks up partner by hashed key, checks active status and monthly limits.
// Returns the partner record on success, null on failure.

export async function validateApiKey(
  key: string
): Promise<{ partner: ApiPartner | null; error: string | null }> {
  if (!key || !key.startsWith('rfl_')) {
    return { partner: null, error: 'Invalid API key format' };
  }

  const hashed = hashKey(key);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('api_partners' as never)
    .select('*')
    .eq('api_key', hashed)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return { partner: null, error: 'Invalid or inactive API key' };
  }

  const partner = data as unknown as ApiPartner;

  // Check monthly limit
  if (
    partner.monthly_report_limit !== null &&
    partner.reports_this_month >= partner.monthly_report_limit
  ) {
    return { partner: null, error: 'Monthly report limit exceeded' };
  }

  return { partner, error: null };
}

// ─── Generate API Key ───────────────────────────────────────────────────────
// Creates a secure API key with rfl_ prefix.
// Stores SHA-256 hash in DB, returns plaintext ONCE.

export async function generateApiKey(
  partnerId: string
): Promise<{ plaintextKey: string; prefix: string }> {
  const randomPart = crypto.randomBytes(32).toString('hex');
  const plaintextKey = `rfl_${randomPart}`;
  const prefix = plaintextKey.slice(0, 8);
  const hashed = hashKey(plaintextKey);

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('api_partners' as never)
    .update({
      api_key: hashed,  
      api_key_prefix: prefix,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', partnerId);

  if (error) {
    throw new Error(`Failed to store API key: ${error.message}`);
  }

  return { plaintextKey, prefix };
}

// ─── Track API Usage ────────────────────────────────────────────────────────
// Increments counters when a report is created via the Partner API.

export async function trackApiUsage(
  partnerId: string,
  reportId: string,
  feeCents: number
): Promise<void> {
  const supabase = createAdminClient();

  // Atomic counter increment via DB function (migration 016).
  // No fallback — if the RPC fails, we log and throw rather than
  // risk a non-atomic read-modify-write race condition.
  const { error: partnerError } = await supabase.rpc('increment_partner_usage' as never, {
    partner_id: partnerId,
    fee_cents: feeCents,
  } as never);

  if (partnerError) {
    console.error(`[partner-api] Failed to track usage for partner ${partnerId}: ${partnerError.message}`);
    throw new Error(`Partner usage tracking failed: ${partnerError.message}`);
  }

  // Tag the report with partner info (new columns from migration 013)
  await supabase
    .from('reports')
    .update({
      api_partner_id: partnerId,  
      is_white_label: true,
    } as never)
    .eq('id', reportId);
}

// ─── Get Partner Stats ──────────────────────────────────────────────────────
// Returns usage statistics for a partner.

export async function getPartnerStats(
  partnerId: string
): Promise<PartnerStats | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('api_partners' as never)
    .select(
      'firm_name, reports_this_month, total_reports_generated, total_revenue_cents, monthly_report_limit, per_report_fee_cents, revenue_share_pct'
    )
    .eq('id', partnerId)
    .single();

  if (error || !data) return null;

  return data as unknown as PartnerStats;
}

// ─── Create Partner (admin use) ─────────────────────────────────────────────
// Creates a new partner record with a placeholder key, then generates the real key.

export async function createPartner(input: {
  firm_name: string;
  contact_email: string;
  contact_name?: string;
  revenue_share_pct?: number;
  per_report_fee_cents?: number;
  monthly_report_limit?: number | null;
  white_label_name?: string;
}): Promise<{ partner: ApiPartner; plaintextKey: string }> {
  const supabase = createAdminClient();

  // Generate key upfront so we can store the hash at creation time
  const randomPart = crypto.randomBytes(32).toString('hex');
  const plaintextKey = `rfl_${randomPart}`;
  const prefix = plaintextKey.slice(0, 8);
  const hashed = hashKey(plaintextKey);

  const { data, error } = await supabase
    .from('api_partners' as never)
    .insert({
      firm_name: input.firm_name,
      contact_email: input.contact_email,
      contact_name: input.contact_name ?? null,
      api_key: hashed,
      api_key_prefix: prefix,
      revenue_share_pct: input.revenue_share_pct ?? 30,
      per_report_fee_cents: input.per_report_fee_cents ?? 2500,
      monthly_report_limit: input.monthly_report_limit ?? null,
      white_label_name: input.white_label_name ?? null,
    } as never)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create partner: ${error?.message ?? 'Unknown error'}`);
  }

  return { partner: data as unknown as ApiPartner, plaintextKey };
}

// ─── List All Partners (admin use) ──────────────────────────────────────────

export async function listPartners(): Promise<ApiPartner[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('api_partners' as never)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list partners: ${error.message}`);
  }

  return (data ?? []) as unknown as ApiPartner[];
}
