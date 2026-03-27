'use server';

// ─── Admin: Create Partner Server Action ─────────────────────────────────────
// Creates a new API partner and generates a one-time-visible API key.

import { createPartner } from '@/lib/services/partner-api-service';

export type CreatePartnerState = {
  success: boolean;
  error?: string;
  plaintextKey?: string;
  partnerId?: string;
  firmName?: string;
};

export async function createPartnerAction(
  _prevState: CreatePartnerState,
  formData: FormData
): Promise<CreatePartnerState> {
  try {
    const firmName = formData.get('firm_name') as string;
    const contactEmail = formData.get('contact_email') as string;
    const contactName = formData.get('contact_name') as string | null;
    const revenueSharePct = parseFloat(
      (formData.get('revenue_share_pct') as string) || '30'
    );
    const perReportFeeCents = parseInt(
      (formData.get('per_report_fee_cents') as string) || '2500',
      10
    );
    const monthlyLimitStr = formData.get('monthly_report_limit') as string;
    const monthlyReportLimit = monthlyLimitStr ? parseInt(monthlyLimitStr, 10) : null;
    const whiteLabelName = formData.get('white_label_name') as string | null;

    // Validation
    if (!firmName || firmName.trim().length === 0) {
      return { success: false, error: 'Firm name is required.' };
    }
    if (!contactEmail || !contactEmail.includes('@')) {
      return { success: false, error: 'Valid contact email is required.' };
    }
    if (isNaN(revenueSharePct) || revenueSharePct < 0 || revenueSharePct > 100) {
      return { success: false, error: 'Revenue share must be between 0 and 100.' };
    }
    if (isNaN(perReportFeeCents) || perReportFeeCents < 0) {
      return { success: false, error: 'Per-report fee must be a positive number.' };
    }

    const { partner, plaintextKey } = await createPartner({
      firm_name: firmName.trim(),
      contact_email: contactEmail.trim(),
      contact_name: contactName?.trim() || undefined,
      revenue_share_pct: revenueSharePct,
      per_report_fee_cents: perReportFeeCents,
      monthly_report_limit: monthlyReportLimit,
      white_label_name: whiteLabelName?.trim() || undefined,
    });

    return {
      success: true,
      plaintextKey,
      partnerId: partner.id,
      firmName: partner.firm_name,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin/partners/create] Error:', message);
    return { success: false, error: message };
  }
}
