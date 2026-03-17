'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { runPipeline } from '@/lib/pipeline/orchestrator';
import { sendReportReadyEmail } from '@/lib/services/resend-email';
import { sendReportRejectionAlert } from '@/lib/services/resend-email';
import type {
  ApprovalAction,
  ReportStatus,
  AdminUser,
  ReportNarrative,
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

// ─── Approve Report (Pay-After Model) ────────────────────────────────────────
// Sets status to 'approved' and sends "report ready" email to client.
// Client pays at /report/[id] to unlock full access.
// No longer triggers stage 8 delivery — payment webhook handles that.

export async function approveReport(reportId: string) {
  const adminUserId = await getAdminUserId();
  const supabase = createAdminClient();

  // Fetch report for email
  const { data: reportData } = await supabase
    .from('reports')
    .select('client_email, property_address, city, state, amount_paid_cents')
    .eq('id', reportId)
    .single();

  const report = reportData as {
    client_email: string;
    property_address: string;
    city: string;
    state: string;
    amount_paid_cents: number;
  } | null;

  if (!report?.client_email) {
    throw new Error('Report not found or missing client email');
  }

  // Fetch concluded value from comps
  const { data: propertyRes } = await supabase
    .from('property_data')
    .select('assessed_value, building_sqft_gross')
    .eq('report_id', reportId)
    .single();

  const { data: compsRes } = await supabase
    .from('comparable_sales')
    .select('adjusted_price_per_sqft')
    .eq('report_id', reportId);

  const property = propertyRes as { assessed_value: number | null; building_sqft_gross: number | null } | null;
  const comps = (compsRes ?? []) as { adjusted_price_per_sqft: number | null }[];

  let concludedValue = 0;
  if (comps.length > 0 && property?.building_sqft_gross) {
    const prices = comps
      .map((c) => c.adjusted_price_per_sqft)
      .filter((p): p is number => p != null && p > 0)
      .sort((a, b) => a - b);
    if (prices.length > 0) {
      const mid = Math.floor(prices.length / 2);
      const median = prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid];
      concludedValue = Math.round((median * property.building_sqft_gross) / 1000) * 1000;
    }
  }

  const assessedValue = property?.assessed_value ?? 0;
  const potentialSavings = Math.max(0, assessedValue - concludedValue);

  // Update status to approved
  const { error: updateError } = await supabase
    .from('reports')
    .update({
      status: 'approved' as ReportStatus,
      approved_at: new Date().toISOString(),
      approved_by: adminUserId,
    } as never)
    .eq('id', reportId);

  if (updateError) throw new Error(`Failed to approve report: ${updateError.message}`);

  // Record approval event
  await insertApprovalEvent(supabase, {
    report_id: reportId,
    admin_user_id: adminUserId,
    action: 'approved',
    notes: 'Report approved — awaiting client payment',
  });

  // Send "report ready" email to client
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  try {
    await sendReportReadyEmail({
      to: report.client_email,
      reportId,
      propertyAddress: [report.property_address, report.city, report.state].filter(Boolean).join(', '),
      concludedValue,
      assessedValue,
      potentialSavings,
      reportUrl: `${appUrl}/report/${reportId}`,
      priceCents: report.amount_paid_cents,
    });
  } catch (emailErr) {
    console.error('[admin/approve] Failed to send report ready email:', emailErr);
  }

  revalidatePath('/admin/reports');
  revalidatePath(`/admin/reports/${reportId}/review`);
}

// ─── Trigger Pipeline (for submitted reports) ────────────────────────────────
// Admin manually triggers the pipeline for a submitted report.

export async function triggerPipeline(reportId: string) {
  const adminUserId = await getAdminUserId();
  const supabase = createAdminClient();

  // Verify report is in submitted status
  const { data: reportData } = await supabase
    .from('reports')
    .select('status')
    .eq('id', reportId)
    .single();

  const report = reportData as { status: string } | null;
  if (!report) throw new Error('Report not found');

  if (report.status !== 'submitted') {
    throw new Error(`Report status is '${report.status}' — must be 'submitted' to trigger pipeline`);
  }

  // Record event
  await insertApprovalEvent(supabase, {
    report_id: reportId,
    admin_user_id: adminUserId,
    action: 'rerun_pipeline',
    notes: 'Pipeline triggered for submitted report',
  });

  // Fire-and-forget pipeline
  runPipeline(reportId, 1).catch((err) => {
    console.error(`[admin] Pipeline failed for report ${reportId}:`, err);
  });

  revalidatePath('/admin/reports');
  revalidatePath(`/admin/reports/${reportId}/review`);
}

export async function rejectReport(reportId: string, notes: string) {
  const adminUserId = await getAdminUserId();
  const supabase = createAdminClient();

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
    .eq('id', reportId);

  if (rejectError) throw new Error(`Failed to reject report: ${rejectError.message}`);

  const { data: reportData } = await supabase
    .from('reports')
    .select('property_address')
    .eq('id', reportId)
    .single();

  sendReportRejectionAlert({
    reportId,
    propertyAddress: (reportData as { property_address: string } | null)?.property_address ?? 'Unknown',
    notes,
  }).catch((err) => {
    console.error('[admin] Failed to send rejection alert email:', err);
  });

  revalidatePath('/admin/reports');
  revalidatePath(`/admin/reports/${reportId}/review`);
}

export async function holdReport(reportId: string, notes: string) {
  const adminUserId = await getAdminUserId();
  const supabase = createAdminClient();

  const eventError = await insertApprovalEvent(supabase, {
    report_id: reportId,
    admin_user_id: adminUserId,
    action: 'approved',
    notes: `HOLD FOR REVIEW: ${notes}`,
  });

  if (eventError) throw new Error(`Failed to record hold: ${eventError.message}`);

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

  const { data: rawNarrative } = await supabase
    .from('report_narratives')
    .select('content, section_name')
    .eq('id', sectionId)
    .single();

  const currentNarrative = rawNarrative as unknown as Pick<ReportNarrative, 'content' | 'section_name'> | null;

  const { error: updateError } = await supabase
    .from('report_narratives')
    .update({
      admin_edited: true,
      admin_edited_content: content,
    } as never)
    .eq('id', sectionId);

  if (updateError) throw new Error(`Failed to update section: ${updateError.message}`);

  await insertApprovalEvent(supabase, {
    report_id: reportId,
    admin_user_id: adminUserId,
    action: 'edit_section',
    section_name: currentNarrative?.section_name ?? null,
    notes: 'Section content edited by admin',
  });

  await supabase
    .from('reports')
    .update({
      status: 'processing' as ReportStatus,
      pipeline_last_completed_stage: 'stage-6-filing',
      pipeline_error_log: null,
    } as never)
    .eq('id', reportId);

  runPipeline(reportId, 7).catch((err) => {
    console.error(`[admin] PDF regeneration failed for report ${reportId}:`, err);
  });

  revalidatePath(`/admin/reports/${reportId}/review`);
}

export async function regenerateSection(reportId: string, sectionName: string) {
  const adminUserId = await getAdminUserId();
  const supabase = createAdminClient();

  await insertApprovalEvent(supabase, {
    report_id: reportId,
    admin_user_id: adminUserId,
    action: 'regenerate_section',
    section_name: sectionName,
    notes: `Triggered regeneration of section: ${sectionName}`,
  });

  await supabase
    .from('reports')
    .update({
      status: 'processing' as ReportStatus,
      pipeline_last_completed_stage: 'stage-4-photos',
      pipeline_error_log: null,
    } as never)
    .eq('id', reportId);

  runPipeline(reportId, 5).catch((err) => {
    console.error(`[admin] Section regeneration failed for report ${reportId}:`, err);
  });

  revalidatePath(`/admin/reports/${reportId}/review`);
}

export async function rerunPipeline(reportId: string) {
  const adminUserId = await getAdminUserId();
  const supabase = createAdminClient();

  await insertApprovalEvent(supabase, {
    report_id: reportId,
    admin_user_id: adminUserId,
    action: 'rerun_pipeline',
    notes: 'Full pipeline rerun triggered by admin',
  });

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

  runPipeline(reportId, 1).catch((err) => {
    console.error(`[admin] Pipeline rerun failed for report ${reportId}:`, err);
  });

  revalidatePath('/admin/reports');
  revalidatePath(`/admin/reports/${reportId}/review`);
}

// ─── Admin Valuation Controls ────────────────────────────────────────────────
// These let the admin manually adjust valuations based on photo review.

export async function updatePhotoCaption(
  reportId: string,
  photoId: string,
  caption: string
) {
  const adminUserId = await getAdminUserId();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('photos')
    .update({ caption } as never)
    .eq('id', photoId)
    .eq('report_id', reportId);

  if (error) throw new Error(`Failed to update photo caption: ${error.message}`);

  await insertApprovalEvent(supabase, {
    report_id: reportId,
    admin_user_id: adminUserId,
    action: 'edit_section',
    notes: `Updated photo caption: ${caption.slice(0, 100)}`,
  });

  revalidatePath(`/admin/reports/${reportId}/review`);
}

export async function updateCompAdjustment(
  reportId: string,
  compId: string,
  field: string,
  value: number
) {
  const adminUserId = await getAdminUserId();
  const supabase = createAdminClient();

  // Validate field name to prevent injection
  const allowedFields = [
    'adjustment_pct_property_rights',
    'adjustment_pct_financing',
    'adjustment_pct_sale_conditions',
    'adjustment_pct_market_trends',
    'adjustment_pct_location',
    'adjustment_pct_size',
    'adjustment_pct_land_to_building',
    'adjustment_pct_condition',
    'adjustment_pct_other',
  ];

  if (!allowedFields.includes(field)) {
    throw new Error(`Invalid adjustment field: ${field}`);
  }

  const { error } = await supabase
    .from('comparable_sales')
    .update({ [field]: value } as never)
    .eq('id', compId)
    .eq('report_id', reportId);

  if (error) throw new Error(`Failed to update comp adjustment: ${error.message}`);

  // Recalculate adjusted_price_per_sqft for this comp
  const { data: compData } = await supabase
    .from('comparable_sales')
    .select('sale_price, building_sqft, adjustment_pct_property_rights, adjustment_pct_financing, adjustment_pct_sale_conditions, adjustment_pct_market_trends, adjustment_pct_location, adjustment_pct_size, adjustment_pct_land_to_building, adjustment_pct_condition, adjustment_pct_other')
    .eq('id', compId)
    .single();

  if (compData) {
    const comp = compData as unknown as Record<string, number | null>;
    const totalAdj = (comp.adjustment_pct_property_rights ?? 0) +
      (comp.adjustment_pct_financing ?? 0) +
      (comp.adjustment_pct_sale_conditions ?? 0) +
      (comp.adjustment_pct_market_trends ?? 0) +
      (comp.adjustment_pct_location ?? 0) +
      (comp.adjustment_pct_size ?? 0) +
      (comp.adjustment_pct_land_to_building ?? 0) +
      (comp.adjustment_pct_condition ?? 0) +
      (comp.adjustment_pct_other ?? 0);

    const salePrice = comp.sale_price ?? 0;
    const sqft = comp.building_sqft ?? 1;
    const pricePerSqft = salePrice / sqft;
    const adjustedPricePerSqft = pricePerSqft * (1 + totalAdj / 100);

    await supabase
      .from('comparable_sales')
      .update({
        net_adjustment_pct: totalAdj,
        adjusted_price_per_sqft: Math.round(adjustedPricePerSqft * 100) / 100,
      } as never)
      .eq('id', compId);
  }

  await insertApprovalEvent(supabase, {
    report_id: reportId,
    admin_user_id: adminUserId,
    action: 'edit_section',
    notes: `Updated comp ${compId.slice(0, 8)} ${field}: ${value}%`,
  });

  revalidatePath(`/admin/reports/${reportId}/review`);
}

export async function overrideConcludedValue(
  reportId: string,
  concludedValue: number,
  justification: string
) {
  const adminUserId = await getAdminUserId();
  const supabase = createAdminClient();

  // Store override in property_data
  const { error } = await supabase
    .from('property_data')
    .update({
      concluded_value_override: concludedValue,
      concluded_value_override_notes: justification,
    } as never)
    .eq('report_id', reportId);

  if (error) throw new Error(`Failed to override concluded value: ${error.message}`);

  await insertApprovalEvent(supabase, {
    report_id: reportId,
    admin_user_id: adminUserId,
    action: 'edit_section',
    notes: `Concluded value override: $${concludedValue.toLocaleString()} — ${justification}`,
  });

  revalidatePath(`/admin/reports/${reportId}/review`);
}
