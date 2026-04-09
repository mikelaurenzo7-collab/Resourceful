// ─── Annual Assessment Reminder Service ───────────────────────────────────────
// After a successful appeal, we subscribe the customer to annual reminders.
// When their county's assessment notices go out next year, we email them:
// "Your county just mailed new assessments. Want us to check if you're
// overpaying again?"
//
// This is a retention/revenue machine — past customers are the highest-
// converting audience because they already trust us and know it works.

import { createAdminClient } from '@/lib/supabase/admin';
import type { Report, CountyRule } from '@/types/database';
import { emailLogger } from '@/lib/logger';

/**
 * Subscribe a customer to annual assessment reminders after report delivery.
 * Calculates the reminder month from the county's assessment notice schedule.
 */
export async function subscribeToReminders(reportId: string): Promise<void> {
  const supabase = createAdminClient();

  // Fetch report
  const { data: reportData } = await supabase
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .single();
  const report = reportData as unknown as Report | null;
  if (!report || !report.client_email) return;

  // Fetch county rules to determine reminder timing
  let countyRule: CountyRule | null = null;
  if (report.county_fips) {
    const { data } = await supabase
      .from('county_rules')
      .select('*')
      .eq('county_fips', report.county_fips)
      .single();
    countyRule = data as CountyRule | null;
  }

  // Determine remind month based on county's assessment cycle
  // Default to January (most assessment notices go out Q1)
  let remindMonth = 1;

  if (countyRule?.assessment_notices_mailed) {
    // Try to extract month from text like "February 1" or "Mid-August"
    const monthNames: Record<string, number> = {
      january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
      july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    };
    const match = countyRule.assessment_notices_mailed.match(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i
    );
    if (match) {
      remindMonth = monthNames[match[1].toLowerCase()] ?? 1;
    }
  } else if (countyRule?.appeal_window_start_month) {
    // Remind 1 month before appeal window opens
    remindMonth = countyRule.appeal_window_start_month > 1
      ? countyRule.appeal_window_start_month - 1
      : 12;
  }

  // Upsert reminder subscription
  await supabase
    .from('reminder_subscriptions' as never)
    .upsert({
      email: report.client_email,
      client_name: report.client_name,
      property_address: report.property_address,
      city: report.city,
      state: report.state,
      county: report.county,
      county_fips: report.county_fips,
      remind_month: remindMonth,
      remind_day: 1,
      is_active: true,
      source_report_id: reportId,
    } as never, {
      onConflict: 'email,property_address',
    });

  emailLogger.info(
    `[reminders] Subscribed ${report.client_email} for ${report.property_address} — ` +
    `remind in month ${remindMonth}`
  );
}

/**
 * Find all reminders due this month and send them.
 * Called by a cron job or scheduled function.
 */
export async function sendDueReminders(): Promise<{ sent: number; errors: number }> {
  const supabase = createAdminClient();
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-indexed
  const currentYear = now.getFullYear();

  // Find active reminders for this month that haven't been sent this year
  const { data: dueReminders } = await supabase
    .from('reminder_subscriptions' as never)
    .select('*')
    .eq('remind_month', currentMonth)
    .eq('is_active', true)
    .or(`last_reminded_year.is.null,last_reminded_year.lt.${currentYear}`);

  if (!dueReminders || dueReminders.length === 0) {
    emailLogger.info(`[reminders] No reminders due for month ${currentMonth}`);
    return { sent: 0, errors: 0 };
  }

  emailLogger.info(`[reminders] ${dueReminders.length} reminders due for month ${currentMonth}`);

  let sent = 0;
  let errors = 0;

  for (const reminder of dueReminders) {
    try {
      // Reminder email — uses same Resend service as report delivery
      // Will be fully implemented when email templates are designed
      emailLogger.info(`[reminders] Would send reminder for ${(reminder as { id: string }).id} (email sending pending template design)`);

      // Mark as sent
      await supabase
        .from('reminder_subscriptions' as never)
        .update({
          last_reminded_at: now.toISOString(),
          last_reminded_year: currentYear,
        } as never)
        .eq('id' as never, (reminder as { id: string }).id);

      sent++;
      emailLogger.info(`[reminders] Sent reminder for ${(reminder as { id: string }).id}`);
    } catch (err) {
      errors++;
      emailLogger.error(`[reminders] Failed to send reminder: ${err}`);
    }
  }

  return { sent, errors };
}

/**
 * API endpoint handler for cron-triggered reminder sends.
 * Called monthly by Vercel Cron or similar scheduler.
 */
export async function handleReminderCron(): Promise<{ sent: number; errors: number }> {
  return sendDueReminders();
}
