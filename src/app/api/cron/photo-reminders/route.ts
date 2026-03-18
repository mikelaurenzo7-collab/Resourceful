// ─── Photo Reminder & Window Closure Cron ────────────────────────────────────
// Runs every 30 minutes via Vercel Cron.
//
// 1. Sends 12-hour photo reminder emails to customers who haven't uploaded yet
// 2. Safety net: if a report is still in 'paid' status after 24 hours with no
//    pipeline run, triggers the pipeline (shouldn't happen normally — webhook
//    fires pipeline immediately — but this catches edge cases)
//
// Secured by CRON_SECRET env var via Authorization header.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPhotoReminderEmail } from '@/lib/services/resend-email';
import { runPipeline } from '@/lib/pipeline/orchestrator';
import type { Report } from '@/types/database';

export async function GET(request: NextRequest) {
  // ── Verify cron secret ─────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  let remindersSent = 0;
  let pipelinesTriggered = 0;

  try {
    // ── 12-hour reminders ──────────────────────────────────────────────
    // Find reports paid 11.5-12.5 hours ago that haven't had a reminder sent
    const reminderWindowStart = new Date(now.getTime() - 12.5 * 60 * 60 * 1000).toISOString();
    const reminderWindowEnd = new Date(now.getTime() - 11.5 * 60 * 60 * 1000).toISOString();

    const { data: reminderReports } = await supabase
      .from('reports')
      .select('id, client_email, property_address, property_type')
      .eq('status', 'paid')
      .gte('created_at', reminderWindowStart)
      .lte('created_at', reminderWindowEnd);

    if (reminderReports && reminderReports.length > 0) {
      for (const report of reminderReports as Report[]) {
        if (!report.client_email) continue;

        try {
          await sendPhotoReminderEmail({
            to: report.client_email,
            reportId: report.id,
            propertyAddress: report.property_address,
            hoursRemaining: 12,
          });
          remindersSent++;
          console.log(`[cron/photo-reminders] Sent 12h reminder for report ${report.id}`);
        } catch (err) {
          console.error(`[cron/photo-reminders] Failed to send reminder for ${report.id}:`, err);
        }
      }
    }

    // ── 24-hour safety net ─────────────────────────────────────────────
    // Find reports still in 'paid' status after 24 hours with no pipeline run.
    // This is a safety net — normally the webhook triggers the pipeline immediately.
    const windowCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const { data: staleReports } = await supabase
      .from('reports')
      .select('id')
      .eq('status', 'paid')
      .lt('created_at', windowCutoff)
      .is('pipeline_started_at', null);

    if (staleReports && staleReports.length > 0) {
      for (const report of staleReports) {
        try {
          console.log(`[cron/photo-reminders] Safety net: triggering pipeline for stale report ${report.id}`);
          runPipeline(report.id).catch((err) => {
            console.error(`[cron/photo-reminders] Pipeline failed for ${report.id}:`, err);
          });
          pipelinesTriggered++;
        } catch (err) {
          console.error(`[cron/photo-reminders] Failed to trigger pipeline for ${report.id}:`, err);
        }
      }
    }

    console.log(`[cron/photo-reminders] Complete: ${remindersSent} reminders sent, ${pipelinesTriggered} pipelines triggered`);

    return NextResponse.json({
      success: true,
      remindersSent,
      pipelinesTriggered,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron/photo-reminders] Error: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
