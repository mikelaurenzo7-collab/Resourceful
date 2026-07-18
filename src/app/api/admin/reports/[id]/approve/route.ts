// ─── Admin Approve Report API ────────────────────────────────────────────────
// POST: Verify admin user, atomically claim a report, verify and deliver the
// approved artifact, then record the approval event.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminWithEmailMatch } from '@/lib/repository/admin';
import { createApprovalEvent } from '@/lib/repository/admin';
import { getReportById } from '@/lib/repository/reports';
import { runDelivery } from '@/lib/pipeline/stages/stage8-delivery';
import { apiLogger } from '@/lib/logger';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;

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

    const adminCheck = await isAdminWithEmailMatch(user.id, user.email);
    if (!adminCheck) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const admin = createAdminClient();
    const { data: claimed, error: claimError } = await admin
      .from('reports')
      .update({ status: 'delivering' as const })
      .eq('id', reportId)
      .eq('status', 'pending_approval')
      .select('id')
      .single();

    if (claimError || !claimed) {
      const report = await getReportById(reportId);
      if (!report) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 });
      }
      return NextResponse.json(
        { error: `Report is '${report.status}' — it may have already been approved by another admin` },
        { status: 409 }
      );
    }

    const deliveryResult = await runDelivery(reportId, user.id, admin);

    if (!deliveryResult.success) {
      const { error: rollbackError } = await admin
        .from('reports')
        .update({ status: 'pending_approval' as const })
        .eq('id', reportId)
        .eq('status', 'delivering');

      if (rollbackError) {
        apiLogger.error(
          { reportId, error: rollbackError.message },
          'Delivery failed and approval claim rollback also failed'
        );
      }

      return NextResponse.json(
        {
          error: [
            `Delivery failed: ${deliveryResult.error}`,
            rollbackError ? `Approval rollback failed: ${rollbackError.message}` : null,
          ].filter(Boolean).join('; '),
        },
        { status: 500 }
      );
    }

    let auditWarning: string | undefined;
    try {
      await createApprovalEvent(
        {
          report_id: reportId,
          admin_user_id: user.id,
          action: 'approved',
          section_name: null,
          notes: 'Report artifact verified, approved, and delivered',
        },
        admin
      );
    } catch (error) {
      auditWarning = error instanceof Error ? error.message : String(error);
      apiLogger.error(
        { reportId, error: auditWarning },
        'Report was delivered but approval audit event could not be recorded'
      );
    }

    return NextResponse.json(
      {
        message: 'Report verified, approved, and delivered',
        reportId,
        status: 'delivered',
        ...(auditWarning
          ? { warning: 'Delivery succeeded, but the approval audit event requires operator review.' }
          : {}),
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    apiLogger.error({ err: message }, 'Unhandled error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
