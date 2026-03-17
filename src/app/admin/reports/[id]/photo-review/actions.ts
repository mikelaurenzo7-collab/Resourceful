'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { runPipeline } from '@/lib/pipeline/orchestrator';
import { photoReviewSubmissionSchema } from '@/lib/validations/report';
import type {
  AdminUser,
  PhotoAiAnalysis,
  ReportStatus,
} from '@/types/database';

async function getAdminUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: rawAdminUser } = await supabase
    .from('admin_users')
    .select('id')
    .eq('user_id', user.id)
    .single();

  const adminUser = rawAdminUser as unknown as Pick<AdminUser, 'id'> | null;
  if (!adminUser) throw new Error('Not an admin user');
  return adminUser.id;
}

/**
 * Submit photo annotations from admin review.
 * Stores each annotation in the photo's ai_analysis JSONB field
 * using the same PhotoAiAnalysis shape that the AI previously generated.
 */
export async function submitPhotoAnnotations(
  reportId: string,
  rawAnnotations: { annotations: Array<{
    photo_id: string;
    condition_rating: string;
    defects: Array<{
      type: string;
      description: string;
      severity: string;
      value_impact: string;
      report_language: string;
    }>;
    inferred_direction: string;
    professional_caption: string;
    comparable_adjustment_note: string;
  }> }
) {
  const adminUserId = await getAdminUserId();
  const supabase = createAdminClient();

  // Validate input
  const parsed = photoReviewSubmissionSchema.safeParse(rawAnnotations);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.issues.map(i => i.message).join(', ')}`);
  }

  const { annotations } = parsed.data;

  // Verify report exists and is in photo_review status
  const { data: reportData } = await supabase
    .from('reports')
    .select('status')
    .eq('id', reportId)
    .single();

  if (!reportData) throw new Error('Report not found');
  if ((reportData as { status: ReportStatus }).status !== 'photo_review') {
    throw new Error(`Report status is '${(reportData as { status: string }).status}' — must be 'photo_review' to submit annotations`);
  }

  // Store each annotation
  for (const annotation of annotations) {
    const analysis: PhotoAiAnalysis = {
      condition_rating: annotation.condition_rating,
      defects: annotation.defects,
      inferred_direction: annotation.inferred_direction,
      professional_caption: annotation.professional_caption,
      comparable_adjustment_note: annotation.comparable_adjustment_note,
    };

    const { error } = await supabase
      .from('photos')
      .update({
        ai_analysis: analysis as any,
        caption: annotation.professional_caption,
      })
      .eq('id', annotation.photo_id)
      .eq('report_id', reportId);

    if (error) {
      throw new Error(`Failed to save annotation for photo ${annotation.photo_id}: ${error.message}`);
    }
  }

  // Record approval event
  await supabase.from('approval_events').insert({
    report_id: reportId,
    admin_user_id: adminUserId,
    action: 'edit_section',
    section_name: 'photo_review',
    notes: `Admin reviewed and annotated ${annotations.length} photos`,
  } as never);

  console.log(
    `[photo-review] Admin ${adminUserId} annotated ${annotations.length} photos for report ${reportId}`
  );

  revalidatePath(`/admin/reports/${reportId}/photo-review`);
}

/**
 * Complete photo review and resume the pipeline from stage 4.
 * Stage 4 will see that all photos now have annotations and proceed
 * to apply condition adjustments, then continue through stages 5-7.
 */
export async function completePhotoReviewAndResume(reportId: string) {
  const adminUserId = await getAdminUserId();
  const supabase = createAdminClient();

  // Verify report is in photo_review status
  const { data: reportData } = await supabase
    .from('reports')
    .select('status')
    .eq('id', reportId)
    .single();

  if (!reportData) throw new Error('Report not found');
  if ((reportData as { status: ReportStatus }).status !== 'photo_review') {
    throw new Error(`Report status is '${(reportData as { status: string }).status}' — must be 'photo_review' to resume`);
  }

  // Verify all photos have been annotated
  const { data: photos } = await supabase
    .from('photos')
    .select('id, ai_analysis')
    .eq('report_id', reportId);

  const unannotated = (photos ?? []).filter((p: any) => p.ai_analysis == null);
  if (unannotated.length > 0) {
    throw new Error(`${unannotated.length} photo(s) still need annotation before resuming`);
  }

  // Record event
  await supabase.from('approval_events').insert({
    report_id: reportId,
    admin_user_id: adminUserId,
    action: 'edit_section',
    section_name: 'photo_review_complete',
    notes: `Photo review completed. Resuming pipeline from stage 4 (condition adjustments).`,
  } as never);

  // Set status back to processing and resume from stage 4
  // Stage 4 will now find all photos annotated and apply adjustments
  await supabase
    .from('reports')
    .update({
      status: 'processing' as ReportStatus,
      pipeline_last_completed_stage: 'stage-3-income',
      pipeline_error_log: null,
    } as never)
    .eq('id', reportId);

  console.log(
    `[photo-review] Admin ${adminUserId} completed photo review for report ${reportId}. Resuming pipeline.`
  );

  // Fire-and-forget pipeline resume from stage 4
  runPipeline(reportId, 4).catch((err) => {
    console.error(`[photo-review] Pipeline resume failed for report ${reportId}:`, err);
  });

  revalidatePath('/admin/reports');
  revalidatePath(`/admin/reports/${reportId}/photo-review`);
  revalidatePath(`/admin/reports/${reportId}/review`);
}
