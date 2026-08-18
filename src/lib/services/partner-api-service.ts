// ─── Partner API Service ─────────────────────────────────────────────────────
// Manages API key lifecycle, durable request idempotency, and usage tracking
// for the white-label Partner API.

import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiLogger } from '@/lib/logger';

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

export type PartnerReportRequest = {
  id: string;
  partner_id: string;
  idempotency_key: string;
  request_fingerprint: string;
  report_id: string | null;
  created_at: string;
  updated_at: string;
};

export class PartnerIdempotencyConflictError extends Error {
  constructor() {
    super('This Idempotency-Key is already bound to a different request body.');
    this.name = 'PartnerIdempotencyConflictError';
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function hashKey(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

export function fingerprintPartnerRequest(value: unknown): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex');
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

  // Fast preflight. The durable usage ledger remains the billing idempotency
  // boundary; this prevents obviously over-limit requests before expensive
  // jurisdiction screening.
  if (
    partner.monthly_report_limit !== null &&
    partner.reports_this_month >= partner.monthly_report_limit
  ) {
    return { partner: null, error: 'Monthly report limit exceeded' };
  }

  if (partner.per_report_fee_cents <= 0) {
    return { partner: null, error: 'Partner billing not configured — contact support' };
  }

  return { partner, error: null };
}

// ─── Durable Partner Request Idempotency ────────────────────────────────────

export async function claimPartnerReportRequest(input: {
  partnerId: string;
  idempotencyKey: string;
  requestFingerprint: string;
}): Promise<{ request: PartnerReportRequest; created: boolean }> {
  const supabase = createAdminClient();
  const { data: inserted, error: insertError } = await supabase
    .from('partner_report_requests' as never)
    .insert({
      partner_id: input.partnerId,
      idempotency_key: input.idempotencyKey,
      request_fingerprint: input.requestFingerprint,
    } as never)
    .select('*')
    .maybeSingle();

  if (!insertError && inserted) {
    return {
      request: inserted as unknown as PartnerReportRequest,
      created: true,
    };
  }

  // A concurrent/replayed request should resolve the canonical ledger row.
  // PostgREST reports Postgres unique violations as 23505.
  if (insertError && insertError.code !== '23505') {
    throw new Error(
      `Failed to claim Partner API request: ${insertError.message}`
    );
  }

  const { data: existing, error: existingError } = await supabase
    .from('partner_report_requests' as never)
    .select('*')
    .eq('partner_id', input.partnerId)
    .eq('idempotency_key', input.idempotencyKey)
    .single();

  if (existingError || !existing) {
    throw new Error(
      `Failed to recover Partner API request: ${
        existingError?.message ?? 'request not found'
      }`
    );
  }

  const request = existing as unknown as PartnerReportRequest;
  if (request.request_fingerprint !== input.requestFingerprint) {
    throw new PartnerIdempotencyConflictError();
  }

  return { request, created: false };
}

export async function bindPartnerReportRequest(input: {
  requestId: string;
  reportId: string;
  partnerId: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc(
    'bind_partner_report_request' as never,
    {
      p_request_id: input.requestId,
      p_report_id: input.reportId,
      p_partner_id: input.partnerId,
    } as never
  );

  if (error) {
    throw new Error(`Failed to bind Partner API request: ${error.message}`);
  }
}

export async function getPartnerReportByRequestId(
  partnerId: string,
  requestId: string
): Promise<{
  id: string;
  status: string;
  pipeline_last_completed_stage: string | null;
  county_fips: string | null;
} | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('reports' as never)
    .select('id,status,pipeline_last_completed_stage,county_fips')
    .eq('api_partner_id', partnerId)
    .eq('partner_request_id', requestId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to recover Partner API report: ${error.message}`);
  }

  return data as unknown as {
    id: string;
    status: string;
    pipeline_last_completed_stage: string | null;
    county_fips: string | null;
  } | null;
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
// Exactly one immutable usage row exists per report. Replays are no-ops when
// the same partner/fee tuple was already recorded.

export async function trackApiUsage(
  partnerId: string,
  reportId: string,
  feeCents: number
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc(
    'record_partner_report_usage' as never,
    {
      p_partner_id: partnerId,
      p_report_id: reportId,
      p_fee_cents: feeCents,
    } as never
  );

  if (error) {
    apiLogger.error(
      { partnerId, reportId, message: error.message },
      '[partner-api] Failed to record idempotent partner usage'
    );
    throw new Error(`Partner usage tracking failed: ${error.message}`);
  }
}

// ─── Get Partner Stats ──────────────────────────────────────────────────────

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
