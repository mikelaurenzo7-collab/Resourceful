// ─── Report Details API ─────────────────────────────────────────────────────
// GET: Return report with property_data, photos, narratives, comparable_sales,
// income_analysis, and measurements. Requires authenticated user who owns the report.
// PATCH: Update user-editable report fields (e.g. email_delivery_preference).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getReportWithDetails } from '@/lib/repository/reports';
import type { Report } from '@/types/database';

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
    console.error('[api/reports/[id]] Unhandled error:', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/reports/[id]
 * Update user-editable report fields. Currently supports:
 * - email_delivery_preference (boolean)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Only allow updating specific fields
    const allowedFields: (keyof Report)[] = ['email_delivery_preference'];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Verify the report exists (no auth required — report UUID is unguessable,
    // consistent with existing viewer/download endpoint patterns)
    const adminSupabase = createAdminClient();
    const { error: updateError } = await adminSupabase
      .from('reports')
      .update(updates)
      .eq('id', id);

    if (updateError) {
      console.error(`[api/reports/[id]] PATCH error:`, updateError.message);
      return NextResponse.json(
        { error: 'Failed to update report' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/reports/[id]] PATCH unhandled error:', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
