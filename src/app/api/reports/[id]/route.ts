// ─── Report Details API ─────────────────────────────────────────────────────
// GET: Return report with property_data, photos, narratives, comparable_sales,
// income_analysis, and measurements. Requires authenticated user who owns the report.
// PATCH: Update user-editable report fields (e.g. email_delivery_preference).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getReportWithDetails } from '@/lib/repository/reports';
import { applyRateLimit } from '@/lib/rate-limit';
import type { Report } from '@/types/database';
import { apiLogger } from '@/lib/logger';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // ── Authenticate user ──────────────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // ── Fetch report with all related data ─────────────────────────────────
    const report = await getReportWithDetails(id);

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // ── Verify ownership ───────────────────────────────────────────────────
    // For auth-based reports: match user_id. For email-only reports (user_id is null): match email.
    const isOwner = report.user_id
      ? report.user_id === user.id
      : report.client_email === user.email;

    if (!isOwner) {
      return NextResponse.json(
        { error: 'Not authorized to view this report' },
        { status: 403 }
      );
    }

    return NextResponse.json({ report }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    apiLogger.error({ err: message }, '[api/reports/[id]] Unhandled error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

const VALID_FILING_STATUSES = ['not_started', 'ready_to_file', 'guided_ready', 'filed', 'hearing_scheduled', 'decision_pending', 'closed'] as const;
const VALID_FILING_METHODS = ['online', 'email', 'mail', 'in_person'] as const;

/**
 * PATCH /api/reports/[id]
 * Update user-editable report fields. Supports:
 * - email_delivery_preference (boolean)
 * - filing_status (string — user-settable post-delivery values: filed, hearing_scheduled, decision_pending, closed)
 * - filed_at (ISO date string or null)
 * - filing_method ('online' | 'email' | 'mail' | 'in_person' | null)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limit: 20 updates per 15 minutes per IP
  const rateLimitResponse = await applyRateLimit(request, {
    prefix: 'report-update',
    limit: 20,
    windowSeconds: 900,
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { id } = await params;

    // ── Authenticate user ──────────────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    // email_delivery_preference: boolean
    if ('email_delivery_preference' in body) {
      if (typeof body.email_delivery_preference !== 'boolean') {
        return NextResponse.json({ error: 'email_delivery_preference must be a boolean' }, { status: 400 });
      }
      updates.email_delivery_preference = body.email_delivery_preference;
    }

    // filing_status: validated enum
    if ('filing_status' in body) {
      if (!VALID_FILING_STATUSES.includes(body.filing_status)) {
        return NextResponse.json(
          { error: `Invalid filing_status. Must be one of: ${VALID_FILING_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }
      updates.filing_status = body.filing_status;
    }

    // filed_at: ISO date string or null
    if ('filed_at' in body) {
      if (body.filed_at !== null && (typeof body.filed_at !== 'string' || isNaN(Date.parse(body.filed_at)))) {
        return NextResponse.json({ error: 'filed_at must be a valid ISO date string or null' }, { status: 400 });
      }
      updates.filed_at = body.filed_at;
    }

    // filing_method: validated enum or null
    if ('filing_method' in body) {
      if (body.filing_method !== null && !VALID_FILING_METHODS.includes(body.filing_method)) {
        return NextResponse.json(
          { error: `Invalid filing_method. Must be one of: ${VALID_FILING_METHODS.join(', ')}` },
          { status: 400 }
        );
      }
      updates.filing_method = body.filing_method;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Verify ownership before allowing mutation
    const adminSupabase = createAdminClient();
    const { data: report } = await adminSupabase
      .from('reports')
      .select('user_id, client_email')
      .eq('id', id)
      .single();

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const isOwner = report.user_id
      ? report.user_id === user.id
      : report.client_email === user.email;

    if (!isOwner) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { error: updateError } = await adminSupabase
      .from('reports')
      .update(updates)
      .eq('id', id);

    if (updateError) {
      apiLogger.error({ err: updateError.message }, '[api/reports/[id]] PATCH error');
      return NextResponse.json(
        { error: 'Failed to update report' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    apiLogger.error({ err: message }, '[api/reports/[id]] PATCH unhandled error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
