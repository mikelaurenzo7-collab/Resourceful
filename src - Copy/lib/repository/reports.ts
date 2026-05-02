// ─── Reports Repository ──────────────────────────────────────────────────────
// Typed data access layer for the reports table and related joins.
// All queries go through this layer — no raw SQL in components or routes.

import { createAdminClient } from '@/lib/supabase/admin';
import { withRetry, isRetryableError } from '@/lib/utils/retry';
import type {
  ComparableSale,
  IncomeAnalysis,
  Measurement,
  Photo,
  PropertyData,
  Report,
  ReportInsert,
  ReportNarrative,
  ReportUpdate,
  ReportStatus,
} from '@/types/database';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

// ─── Report with joined relations ───────────────────────────────────────────

export interface ReportWithDetails extends Report {
  property_data: PropertyData | null;
  photos: Photo[];
  report_narratives: ReportNarrative[];
  comparable_sales: ComparableSale[];
  income_analysis: IncomeAnalysis | null;
  measurements: Measurement[];
}

type JoinedReportWithDetails = Report & {
  property_data: PropertyData | PropertyData[] | null;
  photos: Photo[] | null;
  report_narratives: ReportNarrative[] | null;
  comparable_sales: ComparableSale[] | null;
  income_analysis: IncomeAnalysis | IncomeAnalysis[] | null;
  measurements: Measurement[] | null;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getClient(supabase?: SupabaseAdmin): SupabaseAdmin {
  return supabase ?? createAdminClient();
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function createReport(
  data: ReportInsert,
  supabase?: SupabaseAdmin
) {
  const client = getClient(supabase);
  const reportData = await withRetry(
    async () => {
      const { data: inserted, error } = await client
        .from('reports')
        .insert(data)
        .select()
        .single();

      if (error) throw new Error(`Failed to create report: ${error.message}`);
      return inserted;
    },
    {
      maxAttempts: 3,
      baseDelayMs: 300,
      retryOn: isRetryableError,
    }
  );

  return reportData as unknown as Report;
}

export async function getReportById(
  id: string,
  supabase?: SupabaseAdmin
): Promise<Report | null> {
  const client = getClient(supabase);
  const { data, error } = await client
    .from('reports')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw new Error(`Failed to fetch report: ${error.message}`);
  }
  return data as unknown as Report;
}

export async function getReportWithDetails(
  id: string,
  supabase?: SupabaseAdmin
): Promise<ReportWithDetails | null> {
  const client = getClient(supabase);

  // Fetch report with all related data via Supabase joins
  const { data, error } = await client
    .from('reports')
    .select(`
      *,
      property_data (*),
      photos (*),
      report_narratives (*),
      comparable_sales (*),
      income_analysis (*),
      measurements (*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch report with details: ${error.message}`);
  }

  // Normalize joined data — Supabase returns arrays for one-to-many, objects for one-to-one
  const d = data as JoinedReportWithDetails;
  return {
    ...d,
    property_data: Array.isArray(d.property_data)
      ? d.property_data[0] ?? null
      : d.property_data ?? null,
    photos: Array.isArray(d.photos) ? d.photos : [],
    report_narratives: Array.isArray(d.report_narratives)
      ? d.report_narratives
      : [],
    comparable_sales: Array.isArray(d.comparable_sales)
      ? d.comparable_sales
      : [],
    income_analysis: Array.isArray(d.income_analysis)
      ? d.income_analysis[0] ?? null
      : d.income_analysis ?? null,
    measurements: Array.isArray(d.measurements)
      ? d.measurements
      : [],
  } as ReportWithDetails;
}

export async function updateReportStatus(
  id: string,
  status: ReportStatus,
  supabase?: SupabaseAdmin
) {
  const client = getClient(supabase);
  const { data: statusData, error } = await client
    .from('reports')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update report status: ${error.message}`);
  return statusData as unknown as Report;
}

export async function getReportsByUser(
  userId: string,
  options?: { limit?: number; offset?: number },
  supabase?: SupabaseAdmin
): Promise<Report[]> {
  const client = getClient(supabase);
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const { data, error } = await client
    .from('reports')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to fetch user reports: ${error.message}`);
  return (data ?? []) as unknown as Report[];
}

export async function getPendingApprovalReports(
  options?: { limit?: number; offset?: number },
  supabase?: SupabaseAdmin
): Promise<Report[]> {
  const client = getClient(supabase);
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  const { data, error } = await client
    .from('reports')
    .select('*')
    .eq('status', 'pending_approval')
    .order('pipeline_completed_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error)
    throw new Error(`Failed to fetch pending reports: ${error.message}`);
  return (data ?? []) as unknown as Report[];
}

export async function getReportsByStatus(
  status: ReportStatus,
  options?: { limit?: number; offset?: number },
  supabase?: SupabaseAdmin
): Promise<Report[]> {
  const client = getClient(supabase);
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  const { data, error } = await client
    .from('reports')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error)
    throw new Error(`Failed to fetch reports by status: ${error.message}`);
  return (data ?? []) as unknown as Report[];
}

export async function updateReport(
  id: string,
  data: ReportUpdate,
  supabase?: SupabaseAdmin
) {
  const client = getClient(supabase);
  const { data: reportData, error } = await client
    .from('reports')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update report: ${error.message}`);
  return reportData as unknown as Report;
}
