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
import type { ReportNarrative } from '@/types/database';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const admin = createAdminClient();

    // ── Snapshot the current narrative for the approval event notes ───────
    const { data: existingNarrativeData } = await admin
      .from('report_narratives')
      .select('*')
      .eq('report_id', reportId)
      .eq('section_name', parsed.data.section_name)
      .single();
    const existingNarrative = existingNarrativeData as ReportNarrative | null;

    // ── Delete the existing narrative section so it gets regenerated ──────
    if (existingNarrative) {
      await admin
        .from('report_narratives')
        .delete()
        .eq('report_id', reportId)
        .eq('section_name', parsed.data.section_name);
    }

    // ── Re-run narrative generation (stage 5) ────────────────────────────
    const narrativeResult = await runNarratives(reportId, admin);

    if (!narrativeResult.success) {
      return NextResponse.json(
        { error: `Narrative regeneration failed: ${narrativeResult.error}` },
        { status: 500 }
      );
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
      notes: `Regenerated section: ${parsed.data.section_name}`,
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
