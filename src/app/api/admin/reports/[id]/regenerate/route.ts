// ─── Admin Regenerate Section API ────────────────────────────────────────────
// POST: Accept section_name, re-run just that section's AI generation,
// regenerate PDF, record approval_event.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin, createApprovalEvent } from '@/lib/repository/admin';
import { getReportById } from '@/lib/repository/reports';
import { adminRegenerateSchema } from '@/lib/validations/report';
import { runNarratives } from '@/lib/pipeline/stages/stage5-narratives';
import { runPdfAssembly } from '@/lib/pipeline/stages/stage7-pdf-assembly';
import { applyRateLimit } from '@/lib/rate-limit';
import type { ReportNarrative } from '@/types/database';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimited = await applyRateLimit(request, { prefix: 'admin-regenerate', limit: 10, windowSeconds: 60 });
    if (rateLimited) return rateLimited;

    const { id: reportId } = await params;

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

    // ── Verify admin ───────────────────────────────────────────────────────
    const adminCheck = await isAdmin(user.id);
    if (!adminCheck) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // ── Parse and validate input ───────────────────────────────────────────
    const body = await request.json();
    const parsed = adminRegenerateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // ── Verify report exists ───────────────────────────────────────────────
    const report = await getReportById(reportId);
    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // ── Guard: only allow regeneration for reports that have pipeline data ─
    const regenerateAllowedStatuses = ['pending_approval', 'approved', 'delivered', 'rejected'];
    if (!regenerateAllowedStatuses.includes(report.status)) {
      return NextResponse.json(
        {
          error: `Report status is '${report.status}' — must be pending_approval, approved, delivered, or rejected to regenerate`,
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // ── Snapshot admin-edited sections (except target) so we can restore them ─
    // runNarratives() does a full delete + regenerate of ALL sections.
    // We preserve any sections that were manually edited by an admin.
    const { data: adminEditedRows } = await admin
      .from('report_narratives')
      .select('section_name, content, admin_edited_content')
      .eq('report_id', reportId)
      .eq('admin_edited', true)
      .neq('section_name', parsed.data.section_name);
    const preservedSections = (adminEditedRows ?? []) as Pick<ReportNarrative, 'section_name' | 'content' | 'admin_edited_content'>[];

    // ── Re-run narrative generation (stage 5) — regenerates all sections ──
    const narrativeResult = await runNarratives(reportId, admin);

    if (!narrativeResult.success) {
      return NextResponse.json(
        { error: `Narrative regeneration failed: ${narrativeResult.error}` },
        { status: 500 }
      );
    }

    // ── Restore admin-edited sections that should not have been overwritten ──
    for (const preserved of preservedSections) {
      await admin
        .from('report_narratives')
        .update({
          content: preserved.admin_edited_content ?? preserved.content,
          admin_edited: true,
          admin_edited_content: preserved.admin_edited_content,
        })
        .eq('report_id', reportId)
        .eq('section_name', preserved.section_name);
    }

    // ── Regenerate PDF (stage 7) ─────────────────────────────────────────
    const pdfResult = await runPdfAssembly(reportId, admin);

    if (!pdfResult.success) {
      return NextResponse.json(
        { error: `PDF regeneration failed: ${pdfResult.error}` },
        { status: 500 }
      );
    }

    // ── Record approval event ────────────────────────────────────────────
    await createApprovalEvent({
      report_id: reportId,
      admin_user_id: user.id,
      action: 'regenerate_section',
      section_name: parsed.data.section_name,
      notes: `Regenerated section: ${parsed.data.section_name}${preservedSections.length > 0 ? ` (preserved ${preservedSections.length} admin-edited section${preservedSections.length > 1 ? 's' : ''})` : ''}`,
    });

    return NextResponse.json(
      {
        message: `Section '${parsed.data.section_name}' regenerated and PDF rebuilt`,
        reportId,
        section: parsed.data.section_name,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/regenerate] Unhandled error:', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
