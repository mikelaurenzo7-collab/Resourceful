// ─── Cart Recovery Service ────────────────────────────────────────────────────
// Sends recovery emails to users who started checkout but never completed
// payment. Targets reports with status='intake' that have a Stripe payment
// intent (meaning they got to the payment step) created 2-24 hours ago.
//
// Window logic:
//   - < 2 hours: too soon — they may still come back on their own
//   - 2-24 hours: sweet spot for a gentle nudge
//   - > 24 hours: the cleanup cron handles payment intent expiry;
//     we only send ONE email per abandoned report
//
// Only sends one email per report (tracked via recovery_email_sent_at).

import { createAdminClient } from '@/lib/supabase/admin';
import { sendAbandonedCartRecovery } from '@/lib/services/resend-email';
import type { Report } from '@/types/database';
import { emailLogger } from '@/lib/logger';

const MIN_AGE_HOURS = 2;
const MAX_AGE_HOURS = 48;

type AbandonedReport = Pick<
  Report,
  'id' | 'client_email' | 'client_name' | 'property_address' | 'city' | 'state' | 'service_type'
>;

/**
 * Find abandoned-cart reports and send a single recovery email to each.
 * Called by the cron endpoint.
 */
export async function sendCartRecoveryEmails(): Promise<{ sent: number; errors: number; skipped: number }> {
  const supabase = createAdminClient();

  const now = Date.now();
  const minCutoff = new Date(now - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString();
  const maxCutoff = new Date(now - MIN_AGE_HOURS * 60 * 60 * 1000).toISOString();

  // Find reports where:
  // - status is 'intake' (never paid)
  // - has a stripe_payment_intent_id (got to checkout)
  // - created between 2 and 48 hours ago
  // - no recovery email sent yet
  const { data: reports, error } = await supabase
    .from('reports')
    .select('id, client_email, client_name, property_address, city, state, service_type')
    .eq('status', 'intake')
    .not('stripe_payment_intent_id', 'is', null)
    .is('recovery_email_sent_at', null)
    .gte('created_at', minCutoff)
    .lte('created_at', maxCutoff)
    .limit(50);

  if (error) {
    emailLogger.error({ err: error.message }, 'Query error');
    return { sent: 0, errors: 1, skipped: 0 };
  }

  if (!reports || reports.length === 0) {
    emailLogger.info('[cart-recovery] No abandoned carts in window');
    return { sent: 0, errors: 0, skipped: 0 };
  }

  emailLogger.info(`[cart-recovery] ${reports.length} abandoned carts found`);

  let sent = 0;
  let errors = 0;
  let skipped = 0;

  for (const rawReport of reports) {
    const report = rawReport as AbandonedReport;

    if (!report.client_email) {
      skipped++;
      continue;
    }

    try {
      const propertyAddress = [report.property_address, report.city, report.state]
        .filter(Boolean).join(', ');

      // Mark as sent FIRST to prevent double-sends on retry
      await supabase
        .from('reports')
        .update({ recovery_email_sent_at: new Date().toISOString() })
        .eq('id', report.id);

      const result = await sendAbandonedCartRecovery({
        to: report.client_email,
        clientName: report.client_name,
        reportId: report.id,
        propertyAddress,
        serviceType: report.service_type,
      });

      if (result.error) {
        errors++;
        emailLogger.error(`[cart-recovery] Email failed for ${report.id}: ${result.error}`);
      } else {
        sent++;
        emailLogger.info(`[cart-recovery] Sent recovery email for report ${report.id}`);
      }
    } catch (err) {
      errors++;
      emailLogger.error({ err: err }, `Error processing ${report.id}`);
    }
  }

  emailLogger.info(`[cart-recovery] Complete: ${sent} sent, ${errors} errors, ${skipped} skipped`);
  return { sent, errors, skipped };
}
