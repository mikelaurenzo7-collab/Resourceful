// ─── Tax Bill Data Deletion ─────────────────────────────────────────────────
// Allows a user to request deletion of their uploaded tax bill data.
// Clears the tax bill fields from the report but preserves the report itself.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyRateLimit } from '@/lib/rate-limit';
import { apiLogger } from '@/lib/logger';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limit: 10 deletions per 15 minutes per IP
  const rateLimitResponse = await applyRateLimit(request, {
    prefix: 'tax-bill-delete',
    limit: 10,
    windowSeconds: 900,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const { id: reportId } = await params;

  try {
    // ── Authenticate user ───────────────────────────────────────────────
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

    const admin = createAdminClient();

    // ── Verify report exists and user owns it ───────────────────────────
    const { data: report, error: fetchError } = await admin
      .from('reports')
      .select('id, user_id, client_email, has_tax_bill')
      .eq('id', reportId)
      .single();

    if (fetchError || !report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    const isOwner = report.user_id
      ? report.user_id === user.id
      : report.client_email?.toLowerCase() === user.email?.toLowerCase();
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Not authorized to modify this report' },
        { status: 403 }
      );
    }

    // ── Clear tax bill data fields ──────────────────────────────────────
    const { error: updateError } = await admin
      .from('reports')
      .update({
        has_tax_bill: false,
        tax_bill_assessed_value: null,
        tax_bill_tax_amount: null,
        tax_bill_tax_year: null,
      })
      .eq('id', reportId);

    if (updateError) {
      apiLogger.error({ err: updateError.message, reportId }, '[api/reports/tax-bill-data] Update error');
      return NextResponse.json(
        { error: 'Failed to delete tax bill data' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    apiLogger.error({ err: message, reportId }, '[api/reports/tax-bill-data] Error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
