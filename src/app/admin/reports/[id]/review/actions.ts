'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { runPipeline } from '@/lib/pipeline/orchestrator';
import { runDelivery } from '@/lib/pipeline/stages/stage8-delivery';
import { sendReportRejectionAlert } from '@/lib/services/resend-email';
import { fileAppeal, isFilingEligible } from '@/lib/services/filing-service';
import { subscribeToReminders } from '@/lib/services/reminder-service';
import type {
  ApprovalAction,
  ReportStatus,
  AdminUser,
  ReportNarrative,
  Report,
} from '@/types/database';
import { adminLogger } from '@/lib/logger';

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

async function insertApprovalEvent(
  supabase: ReturnType<typeof createAdminClient>,
  event: {
    report_id: string;
    admin_user_id: string;
    action: ApprovalAction;
    notes: string | null;
    section_name?: string | null;
  }
) {
  const { error } = await supabase.from('approval_events').insert({
    report_id: event.report_id,
    admin_user_id: event.admin_user_id,
    action: event.action,
    notes: event.notes,
    section_name: event.section_name ?? null,
  } as never);
  return error;
}

export async function approveReport(reportId: string) {
  const adminUserId = await getAdminUserId();
  const supabase = createAdminClient();

  // Run Stage 8: generates signed PDF URL, emails client, updates status,
  // and records approval event — all in one atomic flow.
  const result = await runDelivery(reportId, adminUserId, supabase as never);

  if (!result.success) {
    throw new Error(`Delivery failed: ${result.error}`);
  }

  // After delivery: auto-file if full_representation, subscribe to reminders
  try {
    // Fetch report to check tier and filing eligibility
    const { data: reportData } = await supabase.from('reports').select('*').eq('id', reportId).single();
    const report = reportData as unknown as Report | null;

    if (report && isFilingEligible(report)) {
      adminLogger.info({ reportId, tier: report.review_tier }, '[approve] Auto-filing for report');
      fileAppeal(reportId).catch(err =>
        adminLogger.error({ reportId, err: String(err) }, '[approve] Filing failed')
      );
    }

    // Subscribe to annual reminders (all delivered reports)
    subscribeToReminders(reportId).catch(err =>
      adminLogger.error({ reportId, err: String(err) }, '[approve] Reminder subscription failed')
    );
  } catch (err) {
    // Non-fatal — delivery already succeeded
    adminLogger.warn({ err: String(err) }, '[approve] Post-delivery tasks failed (non-fatal)');
  }

  revalidatePath('/admin/reports');
  revalidatePath(`/admin/reports/${reportId}/review`);
}

export async function rejectReport(reportId: string, notes: string) {
  const adminUserId = await getAdminUserId();
  const supabase = createAdminClient();

  // Record rejection event
  const eventError = await insertApprovalEvent(supabase, {
    report_id: reportId,
    admin_user_id: adminUserId,
    action: 'rejected',
    notes,
  });

  if (eventError) throw new Error(`Failed to record rejection: ${eventError.message}`);

  // Set status to rejected
  const { error: rejectError } = await supabase
    .from('reports')
    .update({
      status: 'rejected' as ReportStatus,
      admin_notes: notes,
    } as never)
    .eq('id', reportId);

  if (rejectError) throw new Error(`Failed to reject report: ${rejectError.message}`);

  // Fetch report address for notification
  const { data: reportData } = await supabase
    .from('reports')
    .select('property_address')
    .eq('id', reportId)
    .single();

  // Send rejection alert email (non-blocking)
  sendReportRejectionAlert({
    reportId,
    propertyAddress: (reportData as { property_address: string } | null)?.property_address ?? 'Unknown',
    notes,
  }).catch((err) => {
    adminLogger.error({ err: String(err) }, '[admin] Failed to send rejection alert email');
  });

  revalidatePath('/admin/reports');
  revalidatePath(`/admin/reports/${reportId}/review`);
}

export async function holdReport(reportId: string, notes: string) {
  const adminUserId = await getAdminUserId();
  const supabase = createAdminClient();

  // Record hold event -- status stays the same (pending_approval)
  const eventError = await insertApprovalEvent(supabase, {
    report_id: reportId,
    admin_user_id: adminUserId,
    action: 'approved', // closest available action -- logged as hold via notes
    notes: `HOLD FOR REVIEW: ${notes}`,
  });

  if (eventError) throw new Error(`Failed to record hold: ${eventError.message}`);

  // Update admin_notes but keep status unchanged
  const { error: updateError } = await supabase
    .from('reports')
    .update({
      admin_notes: notes,
    } as never)
    .eq('id', reportId);

  if (updateError) throw new Error(`Failed to update report: ${updateError.message}`);

  revalidatePath(`/admin/reports/${reportId}/review`);
}

export async function editSection(
  reportId: string,
  sectionId: string,
  content: string
) {
  const adminUserId = await getAdminUserId();
  const supabase = createAdminClient();

  // Get current content for audit
  const { data: rawNarrative } = await supabase
    .from('report_narratives')
    .select('content, section_name')
    .eq('id', sectionId)
    .single();

  const currentNarrative = rawNarrative as unknown as Pick<ReportNarrative, 'content' | 'section_name'> | null;

  // Update the narrative with admin edit
  const { error: updateError } = await supabase
    .from('report_narratives')
    .update({
      admin_edited: true,
      admin_edited_content: content,
    } as never)
    .eq('id', sectionId);

  if (updateError) throw new Error(`Failed to update section: ${updateError.message}`);

  // Record edit event
  await insertApprovalEvent(supabase, {
    report_id: reportId,
    admin_user_id: adminUserId,
    action: 'edit_section',
    section_name: currentNarrative?.section_name ?? null,
    notes: 'Section content edited by admin',
  });

  // Re-run PDF assembly (stage 7) to pick up the edited content
  // Set resume point to stage 6 (filing) so pipeline runs stage 7 (pdf)
  await supabase
    .from('reports')
    .update({
      status: 'processing' as ReportStatus,
      pipeline_last_completed_stage: 'stage-6-filing',
      pipeline_error_log: null,
    } as never)
    .eq('id', reportId);

  // Fire-and-forget pipeline from stage 7
  runPipeline(reportId, 7).catch((err) => {
    adminLogger.error({ reportId, err: String(err) }, '[admin] PDF regeneration failed');
  });

  revalidatePath(`/admin/reports/${reportId}/review`);
}

export async function regenerateSection(reportId: string, sectionName: string) {
  const adminUserId = await getAdminUserId();
  const supabase = createAdminClient();

  // Record regeneration event
  await insertApprovalEvent(supabase, {
    report_id: reportId,
    admin_user_id: adminUserId,
    action: 'regenerate_section',
    section_name: sectionName,
    notes: `Triggered regeneration of section: ${sectionName}`,
  });

  // Re-run from stage 5 (narratives) which will regenerate all narratives then PDF
  await supabase
    .from('reports')
    .update({
      status: 'processing' as ReportStatus,
      pipeline_last_completed_stage: 'stage-4-photos',
      pipeline_error_log: null,
    } as never)
    .eq('id', reportId);

  // Fire-and-forget pipeline from stage 5
  runPipeline(reportId, 5).catch((err) => {
    adminLogger.error({ reportId, err: String(err) }, '[admin] Section regeneration failed');
  });

  revalidatePath(`/admin/reports/${reportId}/review`);
}

export async function rerunPipeline(reportId: string) {
  const adminUserId = await getAdminUserId();
  const supabase = createAdminClient();

  // Record rerun event
  await insertApprovalEvent(supabase, {
    report_id: reportId,
    admin_user_id: adminUserId,
    action: 'rerun_pipeline',
    notes: 'Full pipeline rerun triggered by admin',
  });

  // Reset report to processing status
  const { error: updateError } = await supabase
    .from('reports')
    .update({
      status: 'processing' as ReportStatus,
      pipeline_started_at: new Date().toISOString(),
      pipeline_completed_at: null,
      pipeline_last_completed_stage: null,
      pipeline_error_log: null,
    } as never)
    .eq('id', reportId);

  if (updateError) throw new Error(`Failed to reset pipeline: ${updateError.message}`);

  // Fire-and-forget full pipeline rerun from stage 1
  runPipeline(reportId, 1).catch((err) => {
    adminLogger.error({ reportId, err: String(err) }, '[admin] Pipeline rerun failed');
  });

  revalidatePath('/admin/reports');
  revalidatePath(`/admin/reports/${reportId}/review`);
}
