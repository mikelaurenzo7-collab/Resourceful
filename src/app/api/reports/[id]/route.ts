// ─── Report Details API ─────────────────────────────────────────────────────
// GET: Return report with property_data, photos, narratives, comparable_sales,
// income_analysis, and measurements. Requires authenticated user who owns the report.
// PATCH: Update user-editable report fields through deterministic lifecycle rules.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getReportWithDetails } from '@/lib/repository/reports';
import { applyRateLimit } from '@/lib/rate-limit';
import { apiLogger } from '@/lib/logger';
import { validateFilingUpdate } from '@/lib/outcomes/lifecycle';
import type { ReportStatus, ServiceType } from '@/types/database';

function normalizeEmail(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    const report = await getReportWithDetails(id);

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    const isOwner = report.user_id
      ? report.user_id === user.id
      : normalizeEmail(report.client_email) === normalizeEmail(user.email);

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

/**
 * PATCH /api/reports/[id]
 * Update user-editable report fields. Supports:
 * - email_delivery_preference (boolean)
 * - filing_status (deterministic appeal lifecycle state)
 * - filed_at (ISO date string or null)
 * - filing_method ('online' | 'email' | 'mail' | 'in_person' | null)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await applyRateLimit(request, {
    prefix: 'report-update',
    limit: 20,
    windowSeconds: 900,
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { id } = await params;

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

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json({ error: 'A valid JSON request body is required.' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const { data: report, error: reportError } = await adminSupabase
      .from('reports')
      .select('user_id, client_email, status, service_type, filing_status, filed_at, filing_method, appeal_outcome')
      .eq('id', id)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const isOwner = report.user_id
      ? report.user_id === user.id
      : normalizeEmail(report.client_email) === normalizeEmail(user.email);

    if (!isOwner) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};

    if ('email_delivery_preference' in body) {
      if (typeof body.email_delivery_preference !== 'boolean') {
        return NextResponse.json(
          { error: 'email_delivery_preference must be a boolean' },
          { status: 400 }
        );
      }
      updates.email_delivery_preference = body.email_delivery_preference;
    }

    const hasFilingUpdate =
      'filing_status' in body ||
      'filed_at' in body ||
      'filing_method' in body;

    if (hasFilingUpdate) {
      const lifecycleValidation = validateFilingUpdate({
        reportStatus: report.status as ReportStatus,
        serviceType: report.service_type as ServiceType,
        currentFilingStatus: report.filing_status,
        currentFiledAt: report.filed_at,
        currentFilingMethod: report.filing_method,
        currentOutcome: report.appeal_outcome,
        requestedFilingStatus: 'filing_status' in body ? body.filing_status : undefined,
        requestedFiledAt: 'filed_at' in body ? body.filed_at : undefined,
        requestedFilingMethod: 'filing_method' in body ? body.filing_method : undefined,
      });

      if (!lifecycleValidation.valid) {
        return NextResponse.json(
          { error: lifecycleValidation.error ?? 'Invalid filing progress update.' },
          { status: 409 }
        );
      }

      if ('filing_status' in body) updates.filing_status = body.filing_status;
      if ('filed_at' in body) updates.filed_at = body.filed_at;
      if ('filing_method' in body) updates.filing_method = body.filing_method;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { error: updateError } = await adminSupabase
      .from('reports')
      .update(updates)
      .eq('id', id);

    if (updateError) {
      apiLogger.error({ err: updateError.message, reportId: id }, '[api/reports/[id]] PATCH error');
      return NextResponse.json(
        { error: 'Failed to update report' },
        { status: 500 }
      );
    }

    apiLogger.info(
      {
        reportId: id,
        userId: user.id,
        fields: Object.keys(updates),
      },
      '[api/reports/[id]] Customer report state updated'
    );

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
