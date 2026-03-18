// ─── Tax Bill Data Deletion ─────────────────────────────────────────────────
// Allows a user to request deletion of their uploaded tax bill data.
// Clears the tax bill fields from the report but preserves the report itself.
// Requires the client_email query param to match the report's owner.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyRateLimit } from '@/lib/rate-limit';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reportId } = await params;

  try {
    // ── Rate limit: 10 deletions per 15 minutes per IP ──────────────────
    const rateLimited = await applyRateLimit(request, { prefix: 'tax-bill-delete', limit: 10, windowSeconds: 900 });
    if (rateLimited) return rateLimited;

    const supabase = createAdminClient();

    // ── Verify the report exists and check ownership ────────────────────
    const { data: report, error: fetchError } = await supabase
      .from('reports')
      .select('id, has_tax_bill, client_email')
      .eq('id', reportId)
      .single();

    if (fetchError || !report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // Ownership check: the email param must match the report's client_email
    const email = request.nextUrl.searchParams.get('email');
    if (!email || email.toLowerCase() !== (report as { client_email: string }).client_email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Clear tax bill data fields
    const { error: updateError } = await supabase
      .from('reports')
      .update({
        has_tax_bill: false,
        tax_bill_assessed_value: null,
        tax_bill_tax_amount: null,
        tax_bill_tax_year: null,
      })
      .eq('id', reportId);

    if (updateError) {
      console.error(`[api/reports/${reportId}/tax-bill-data] Update error:`, updateError.message);
      return NextResponse.json(
        { error: 'Failed to delete tax bill data' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api/reports/${reportId}/tax-bill-data] Error:`, message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
