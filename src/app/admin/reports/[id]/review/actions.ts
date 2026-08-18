'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getAdminUser } from '@/lib/repository/admin';
import { enqueuePipelineRun } from '@/lib/pipeline/queue';
import { runDelivery } from '@/lib/pipeline/stages/stage8-delivery';
import { sendReportRejectionAlert } from '@/lib/services/resend-email';
import { fileAppeal, isFilingEligible } from '@/lib/services/filing-service';
import { subscribeToReminders } from '@/lib/services/reminder-service';
import type {
  ApprovalAction,
  ReportStatus,
  ReportNarrative,
  Report,
} from '@/types/database';
import { adminLogger } from '@/lib/logger';

async function getAdminUserId(): Promise<string> {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user?.email) throw new Error('Not authenticated');

  const adminClient = createAdminClient();
  const adminUser = await getAdminUser(user.id, adminClient);
  if (!adminUser) throw new Error('Not an admin user');
  if (adminUser.email?.toLowerCase().trim() !== user.email.toLowerCase().trim()) {
    throw new Error('Admin identity mismatch');
  }

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

async function requirePendingApprovalReport(
  supabase: ReturnType<typeof createAdminClient>,
  reportId: string
): Promise<Report> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .single();

  const report = data as unknown as Report | null;
  if (error || !report) throw new Error('Report not found');
  if (report.status !== 'pending_approval') {
    throw new Error(
      `Report must be pending approval before review content can be changed (current status: ${report.status}).`
    );
  }
  return report;
}

export async function approveReport(reportId: string) {
  const adminUserId = await getAdminUserId();
  const supabase = createAdminClient();

  // Stage 8 deliberately refuses pending_approval. Atomically claim the report
  // as delivering first so two admins cannot deliver the same artifact.
  const { data: claimed, error: claimError } = await supabase
    .from('reports')
    .update({ status: 'delivering' as ReportStatus } as never)
    .eq('id', reportId)
    .eq('status', 'pending_approval')
    .select('id')
    .maybeSingle();

  if (claimError || !claimed) {
    throw new Error(
      claimError
        ? `Failed to claim report for delivery: ${claimError.message}`
        : 'Report is no longer pending approval; another admin may have acted on it.'
    );
  }

  const result = await runDelivery(reportId, adminUserId, supabase as never);

  if (!result.success) {
    const { error: rollbackError } = await supabase
      .from('reports')
      .update({ status: 'pending_approval' as ReportStatus } as never)
      .eq('id', reportId)
      .eq('status', 'delivering');

    if (rollbackError) {
      adminLogger.error(
        { reportId, err: rollbackError.message },
        '[approve] Delivery failed and approval claim rollback failed'
      );
    }

    throw new Error(
      [
        `Delivery failed: ${result.error}`,
        rollbackError ? `Approval rollback failed: ${rollbackError.message}` : null,
      ]
        .filter(Boolean)
        .join('; ')
    );
  }

  const approvalEventError = await insertApprovalEvent(supabase, {
    report_id: reportId,
    admin_user_id: adminUserId,
    action: 'approved',
    notes: 'Report artifact verified, approved, and delivered',
  });
  if (approvalEventError) {
    // Delivery is already durable; never misrepresent this as a delivery failure.
    adminLogger.error(
      { reportId, err: approvalEventError.message },
      '[approve] Report delivered but approval audit event failed'
    );
  }

  try {
    const { data: reportData } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single();
    const report = reportData as unknown as Report | null;

    const tasks: Array<{ name: string; promise: Promise<unknown> }> = [
      {
        // Stage 8 also attempts this. Retrying here is intentional because the
        // reminder write is idempotent and Stage 8 treats reminder failure as
        // non-fatal delivery work.
        name: 'reminder subscription',
        promise: subscribeToReminders(reportId),
      },
    ];

    if (report && isFilingEligible(report)) {
      adminLogger.info(
        { reportId, tier: report.review_tier },
        '[approve] Preparing filing workflow'
      );
      tasks.push({
        name: 'filing preparation',
        promise: fileAppeal(reportId).then((filingResult) => {
          if (!filingResult.success) {
            throw new Error(filingResult.error ?? 'Filing preparation failed');
          }
          return filingResult;
        }),
      });
    }

    const settled = await Promise.allSettled(tasks.map((task) => task.promise));
    settled.forEach((taskResult, index) => {
      if (taskResult.status === 'rejected') {
        adminLogger.error(
          {
            reportId,
            task: tasks[index].name,
            err: String(taskResult.reason),
          },
          '[approve] Post-delivery task failed'
        );
      }
    });
  } catch (err) {
    adminLogger.warn(
      { reportId, err: String(err) },
      '[approve] Post-delivery tasks failed (non-fatal)'
    );
  }

  revalidatePath('/admin/reports');
  revalidatePath(`/admin/reports/${reportId}/review`);
}

export async function rejectReport(reportId: string, notes: string) {
  const adminUserId = await getAdminUserId();
  const supabase = createAdminClient();
  await requirePendingApprovalReport(supabase, reportId);

  const eventError = await insertApprovalEvent(supabase, {
    report_id: reportId,
    admin_user_id: adminUserId,
    action: 'rejected',
    notes,
  });

  if (eventError) throw new Error(`Failed to record rejection: ${eventError.message}`);

  const { error: rejectError } = await supabase
    .from('reports')
    .update({
      status: 'rejected' as ReportStatus,
      admin_notes: notes,
    } as never)
    .eq('id', reportId)
    .eq('status', 'pending_approval');

  if (rejectError) throw new Error(`Failed to reject report: ${rejectError.message}`);

  const { data: reportData } = await supabase
    .from('reports')
    .select('property_address')
    .eq('id', reportId)
    .single();

  try {
    const alert = await sendReportRejectionAlert({
      reportId,
      propertyAddress:
        (reportData as { property_address: string } | null)?.property_address ??
        'Unknown',
      notes,
    });
    if (alert.error) {
      adminLogger.error(
        { reportId, err: alert.error },
        '[admin] Failed to send rejection alert email'
      );
    }
  } catch (err) {
    adminLogger.error(
      { reportId, err: String(err) },
      '[admin] Failed to send rejection alert email'
    );
  }

  revalidatePath('/admin/reports');
  revalidatePath(`/admin/reports/${reportId}/review`);
}

export async function holdReport(reportId: string, notes: string) {
  const adminUserId = await getAdminUserId();
  const supabase = createAdminClient();
  await requirePendingApprovalReport(supabase, reportId);

  const eventError = await insertApprovalEvent(supabase, {
    report_id: reportId,
    admin_user_id: adminUserId,
    action: 'hold_for_review',
    notes,
  });

  if (eventError) throw new Error(`Failed to record hold: ${eventError.message}`);

  const { error: updateError } = await supabase
    .from('reports')
    .update({
      admin_notes: notes,
    } as never)
    .eq('id', reportId)
    .eq('status', 'pending_approval');

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
  await requirePendingApprovalReport(supabase, reportId);

  const normalizedContent = content.trim();
  if (!normalizedContent) throw new Error('Section content cannot be empty.');

  const { data: rawNarrative, error: narrativeError } = await supabase
    .from('report_narratives')
    .select('content, section_name')
    .eq('id', sectionId)
    .eq('report_id', reportId)
    .single();

  const currentNarrative = rawNarrative as unknown as Pick<
    ReportNarrative,
    'content' | 'section_name'
  > | null;
  if (narrativeError || !currentNarrative) {
    throw new Error('Narrative section not found for this report.');
  }

  const { error: updateError } = await supabase
    .from('report_narratives')
    .update({
      admin_edited: true,
      admin_edited_content: normalizedContent,
    } as never)
    .eq('id', sectionId)
    .eq('report_id', reportId);

  if (updateError) throw new Error(`Failed to update section: ${updateError.message}`);

  const operationId = randomUUID();
  const eventError = await insertApprovalEvent(supabase, {
    report_id: reportId,
    admin_user_id: adminUserId,
    action: 'edit_section',
    section_name: currentNarrative.section_name ?? null,
    notes: `Section content edited by admin; durable PDF rebuild ${operationId}`,
  });
  if (eventError) throw new Error(`Failed to record section edit: ${eventError.message}`);

  const { error: reportUpdateError } = await supabase
    .from('reports')
    .update({
      status: 'processing' as ReportStatus,
      pipeline_last_completed_stage: 'stage-6-filing',
      pipeline_error_log: null,
      pipeline_completed_at: null,
    } as never)
    .eq('id', reportId)
    .eq('status', 'pending_approval');

  if (reportUpdateError) {
    throw new Error(`Failed to prepare PDF rebuild: ${reportUpdateError.message}`);
  }

  const run = await enqueuePipelineRun({
    reportId,
    source: 'admin',
    idempotencyKey: `admin:edit-section:${reportId}:${operationId}`,
    startStage: 7,
    metadata: {
      admin_user_id: adminUserId,
      action: 'edit_section',
      section_id: sectionId,
      section_name: currentNarrative.section_name,
      operation_id: operationId,
    },
  });

  adminLogger.info(
    { reportId, runId: run.id, operationId, sectionId },
    '[admin] Edited section durably queued for PDF rebuild'
  );

  revalidatePath(`/admin/reports/${reportId}/review`);
}

export async function regenerateSection(reportId: string, sectionName: string) {
  const adminUserId = await getAdminUserId();
  const supabase = createAdminClient();
  await requirePendingApprovalReport(supabase, reportId);

  const operationId = randomUUID();
  const eventError = await insertApprovalEvent(supabase, {
    report_id: reportId,
    admin_user_id: adminUserId,
    action: 'regenerate_section',
    section_name: sectionName,
    notes: `Narrative regeneration requested by admin; durable run ${operationId}`,
  });
  if (eventError) throw new Error(`Failed to record regeneration request: ${eventError.message}`);

  const { error: updateError } = await supabase
    .from('reports')
    .update({
      status: 'processing' as ReportStatus,
      pipeline_last_completed_stage: 'stage-4-photos',
      pipeline_error_log: null,
      pipeline_completed_at: null,
    } as never)
    .eq('id', reportId)
    .eq('status', 'pending_approval');

  if (updateError) throw new Error(`Failed to prepare narrative regeneration: ${updateError.message}`);

  const run = await enqueuePipelineRun({
    reportId,
    source: 'admin',
    idempotencyKey: `admin:regenerate:${reportId}:${operationId}`,
    startStage: 5,
    metadata: {
      admin_user_id: adminUserId,
      action: 'regenerate_section',
      requested_section_name: sectionName,
      operation_id: operationId,
    },
  });

  adminLogger.info(
    { reportId, runId: run.id, operationId, sectionName },
    '[admin] Narrative regeneration durably queued'
  );

  revalidatePath(`/admin/reports/${reportId}/review`);
}

export async function rerunPipeline(reportId: string) {
  const adminUserId = await getAdminUserId();
  const supabase = createAdminClient();
  const operationId = randomUUID();

  const eventError = await insertApprovalEvent(supabase, {
    report_id: reportId,
    admin_user_id: adminUserId,
    action: 'rerun_pipeline',
    notes: `Full durable pipeline rerun requested by admin; operation ${operationId}`,
  });
  if (eventError) throw new Error(`Failed to record pipeline rerun: ${eventError.message}`);

  const run = await enqueuePipelineRun({
    reportId,
    source: 'admin',
    idempotencyKey: `admin:full-rerun:${reportId}:${operationId}`,
    startStage: 1,
    replaceActive: true,
    metadata: {
      admin_user_id: adminUserId,
      action: 'full_rerun',
      operation_id: operationId,
    },
  });

  adminLogger.info(
    { reportId, runId: run.id, operationId },
    '[admin] Full pipeline rerun durably queued'
  );

  revalidatePath('/admin/reports');
  revalidatePath(`/admin/reports/${reportId}/review`);
}
