// ─── Get Report Details API ─────────────────────────────────────────────────
// GET: Return report with property_data, photos, narratives, comparable_sales,
// income_analysis, and measurements. Requires authenticated user who owns the report.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getReportWithDetails } from '@/lib/repository/reports';

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
    // Reports store user_id as client_email (no auth account required at creation).
    // Check both: email match (primary) and UUID match (future auth integration).
    const ownsReport =
      report.user_id === user.id ||
      report.client_email === user.email;
    if (!ownsReport) {
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
