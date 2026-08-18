'use server';

import { adminLogger } from '@/lib/logger';
import { isAdminWithEmailMatch } from '@/lib/repository/admin';
import { createPartner } from '@/lib/services/partner-api-service';
import { createClient } from '@/lib/supabase/server';

export type CreatePartnerState = {
  success: boolean;
  error?: string;
  plaintextKey?: string;
  partnerId?: string;
  firmName?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createPartnerAction(
  _prevState: CreatePartnerState,
  formData: FormData
): Promise<CreatePartnerState> {
  try {
    // Server actions are callable endpoints in their own right. Never rely on
    // the surrounding /admin layout as the authorization boundary.
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user?.email) {
      return { success: false, error: 'Not authenticated.' };
    }
    if (!(await isAdminWithEmailMatch(user.id, user.email))) {
      return { success: false, error: 'Not authorized — admin access required.' };
    }

    const firmName = String(formData.get('firm_name') ?? '').trim();
    const contactEmail = String(formData.get('contact_email') ?? '')
      .trim()
      .toLowerCase();
    const contactName = String(formData.get('contact_name') ?? '').trim();
    const revenueSharePct = Number.parseFloat(
      String(formData.get('revenue_share_pct') ?? '30')
    );
    const perReportFeeCents = Number.parseInt(
      String(formData.get('per_report_fee_cents') ?? '2500'),
      10
    );
    const monthlyLimitRaw = String(formData.get('monthly_report_limit') ?? '').trim();
    const monthlyReportLimit = monthlyLimitRaw
      ? Number.parseInt(monthlyLimitRaw, 10)
      : null;
    const whiteLabelName = String(formData.get('white_label_name') ?? '').trim();

    if (!firmName) {
      return { success: false, error: 'Firm name is required.' };
    }
    if (!EMAIL_PATTERN.test(contactEmail)) {
      return { success: false, error: 'Valid contact email is required.' };
    }
    if (!Number.isFinite(revenueSharePct) || revenueSharePct < 0 || revenueSharePct > 100) {
      return { success: false, error: 'Revenue share must be between 0 and 100.' };
    }
    if (!Number.isInteger(perReportFeeCents) || perReportFeeCents <= 0) {
      return { success: false, error: 'Per-report fee must be a positive whole number of cents.' };
    }
    if (
      monthlyReportLimit !== null &&
      (!Number.isInteger(monthlyReportLimit) || monthlyReportLimit <= 0)
    ) {
      return { success: false, error: 'Monthly report limit must be a positive whole number or left blank for unlimited.' };
    }

    const { partner, plaintextKey } = await createPartner({
      firm_name: firmName,
      contact_email: contactEmail,
      contact_name: contactName || undefined,
      revenue_share_pct: revenueSharePct,
      per_report_fee_cents: perReportFeeCents,
      monthly_report_limit: monthlyReportLimit,
      white_label_name: whiteLabelName || undefined,
    });

    return {
      success: true,
      plaintextKey,
      partnerId: partner.id,
      firmName: partner.firm_name,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    adminLogger.error({ err: message }, '[admin/partners/create] Error');
    return { success: false, error: 'Unable to create partner.' };
  }
}
