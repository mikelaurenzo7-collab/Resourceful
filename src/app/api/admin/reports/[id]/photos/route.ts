// ─── Admin: Update Photo AI Analysis ─────────────────────────────────────────
// PATCH /api/admin/reports/[id]/photos
// Allows admin to override the AI-generated analysis for one or more photos
// before final approval. Changes are written to photos.ai_analysis (JSONB).
// The pipeline has already run — this is the human-in-the-loop review step.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { PhotoAiAnalysis } from '@/types/database';

interface PhotoUpdatePayload {
  photo_id: string;
  condition_rating?: string;
  defects?: PhotoAiAnalysis['defects'];
  professional_caption?: string;
  comparable_adjustment_note?: string;
  admin_override_note?: string;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const reportId = params.id;

  // ── Auth: admin only ───────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Parse body ─────────────────────────────────────────────────────────
  let updates: PhotoUpdatePayload[];
  try {
    const body = await req.json();
    updates = Array.isArray(body) ? body : [body];
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!updates.length) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
  }

  // ── Verify all photos belong to this report ────────────────────────────
  const photoIds = updates.map((u) => u.photo_id);
  const { data: existingPhotos, error: fetchError } = await supabase
    .from('photos')
    .select('id, ai_analysis, report_id')
    .in('id', photoIds)
    .eq('report_id', reportId);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const existingMap = new Map(
    (existingPhotos ?? []).map((p) => [p.id, p])
  );

  // ── Apply updates ──────────────────────────────────────────────────────
  const results: Array<{ photo_id: string; success: boolean; error?: string }> = [];

  for (const update of updates) {
    const existing = existingMap.get(update.photo_id);
    if (!existing) {
      results.push({ photo_id: update.photo_id, success: false, error: 'Photo not found on this report' });
      continue;
    }

    // Merge new fields on top of existing AI analysis
    const currentAnalysis = (existing.ai_analysis as unknown as PhotoAiAnalysis | null) ?? {};
    const mergedAnalysis: PhotoAiAnalysis & { admin_override_note?: string; admin_reviewed_at?: string } = {
      ...currentAnalysis,
      ...(update.condition_rating !== undefined && { condition_rating: update.condition_rating as PhotoAiAnalysis['condition_rating'] }),
      ...(update.defects !== undefined && { defects: update.defects }),
      ...(update.professional_caption !== undefined && { professional_caption: update.professional_caption }),
      ...(update.comparable_adjustment_note !== undefined && { comparable_adjustment_note: update.comparable_adjustment_note }),
      ...(update.admin_override_note !== undefined && { admin_override_note: update.admin_override_note }),
      admin_reviewed_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('photos')
      .update({ ai_analysis: mergedAnalysis as unknown as Record<string, unknown> })
      .eq('id', update.photo_id)
      .eq('report_id', reportId);

    if (updateError) {
      results.push({ photo_id: update.photo_id, success: false, error: updateError.message });
    } else {
      results.push({ photo_id: update.photo_id, success: true });
    }
  }

  const allSucceeded = results.every((r) => r.success);

  // ── Log approval event ─────────────────────────────────────────────────
  if (results.some((r) => r.success)) {
    await supabase.from('approval_events').insert({
      report_id: reportId,
      admin_user_id: user.id,
      action: 'edit_section',
      section_name: 'photo_analysis',
      notes: `Admin adjusted photo analysis for ${results.filter((r) => r.success).length} photo(s)`,
    });
  }

  return NextResponse.json(
    { results },
    { status: allSucceeded ? 200 : 207 }
  );
}
