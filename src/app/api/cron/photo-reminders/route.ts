// ─── Deferred Pipeline Trigger + Photo Reminders ─────────────────────────────
// Runs every 30 minutes via Vercel Cron. This is the PRIMARY pipeline trigger.
//
// Why deferred? The customer has 24 hours to upload photos. Running the
// pipeline immediately on payment wastes API costs — if photos arrive later,
// we'd have to re-run AI analysis, narratives, and PDF generation. By waiting
// ~14 hours, we run the full pipeline ONCE with the best available data.
//
// Timeline after payment:
//   0h   — Payment confirmed, preview shown, photo upload encouraged
//   12h  — Photo reminder email sent
//   14h  — Pipeline triggered (ATTOM + AI + photos if uploaded)
//   ~14.5h — Pipeline complete, report enters pending_approval
//   24h  — Admin reviews and delivers (safety net catches stragglers)
//
// Secured by CRON_SECRET env var via Authorization header.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPhotoReminderEmail } from '@/lib/services/resend-email';
import { runPipeline } from '@/lib/pipeline/orchestrator';
import type { Report } from '@/types/database';

// ─── Configuration ──────────────────────────────────────────────────────────

/** Hours after payment to send photo reminder email */
const REMINDER_HOUR = 12;

/** Hours after payment to trigger the pipeline (primary trigger) */
const PIPELINE_TRIGGER_HOUR = 14;

/** Hours after payment to force-trigger pipeline if still not started (safety net) */
const SAFETY_NET_HOUR = 24;

/** Window in hours around target time to catch reports (cron runs every 30min) */
const WINDOW = 0.5;

export async function GET(request: NextRequest) {
  // ── Verify cron secret ─────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = Date.now();
  let remindersSent = 0;
  let pipelinesTriggered = 0;

  try {
    // ── 1. Send 12-hour photo reminder emails ────────────────────────────
    const reminderStart = new Date(now - (REMINDER_HOUR + WINDOW) * 3600000).toISOString();
    const reminderEnd = new Date(now - (REMINDER_HOUR - WINDOW) * 3600000).toISOString();

    const { data: reminderReports } = await supabase
      .from('reports')
      .select('id, client_email, property_address, property_type')
      .eq('status', 'paid')
      .gte('created_at', reminderStart)
      .lte('created_at', reminderEnd)
      .is('pipeline_started_at', null);

    if (reminderReports && reminderReports.length > 0) {
      for (const report of reminderReports as Report[]) {
        if (!report.client_email) continue;

        try {
          await sendPhotoReminderEmail({
            to: report.client_email,
            reportId: report.id,
            propertyAddress: report.property_address,
            hoursRemaining: SAFETY_NET_HOUR - REMINDER_HOUR,
          });
          remindersSent++;
          console.log(`[cron] Sent 12h photo reminder for report ${report.id}`);
        } catch (err) {
          console.error(`[cron] Failed to send reminder for ${report.id}:`, err);
        }
      }
    }

    // ── 2. Trigger pipeline at ~14 hours (PRIMARY trigger) ───────────────
    // These reports have had time for photo uploads. Run the pipeline once
    // with whatever data we have — ATTOM + AI + photos if any.
    const pipelineStart = new Date(now - (PIPELINE_TRIGGER_HOUR + WINDOW) * 3600000).toISOString();
    const pipelineEnd = new Date(now - (PIPELINE_TRIGGER_HOUR - WINDOW) * 3600000).toISOString();

    const { data: readyReports } = await supabase
      .from('reports')
      .select('id')
      .eq('status', 'paid')
      .gte('created_at', pipelineStart)
      .lte('created_at', pipelineEnd)
      .is('pipeline_started_at', null);

    if (readyReports && readyReports.length > 0) {
      for (const report of readyReports) {
        try {
          console.log(`[cron] Triggering pipeline for report ${report.id} (14h mark)`);
          runPipeline(report.id).catch((err) => {
            console.error(`[cron] Pipeline failed for ${report.id}:`, err);
          });
          pipelinesTriggered++;
        } catch (err) {
          console.error(`[cron] Failed to trigger pipeline for ${report.id}:`, err);
        }
      }
    }

    // ── 3. Safety net at 24 hours ────────────────────────────────────────
    // Catch any reports that slipped through the 14h window (cron downtime, etc.)
    const safetyNetCutoff = new Date(now - SAFETY_NET_HOUR * 3600000).toISOString();

    const { data: staleReports } = await supabase
      .from('reports')
      .select('id')
      .eq('status', 'paid')
      .lt('created_at', safetyNetCutoff)
      .is('pipeline_started_at', null);

    if (staleReports && staleReports.length > 0) {
      for (const report of staleReports) {
        try {
          console.log(`[cron] Safety net: triggering pipeline for stale report ${report.id}`);
          runPipeline(report.id).catch((err) => {
            console.error(`[cron] Pipeline failed for stale ${report.id}:`, err);
          });
          pipelinesTriggered++;
        } catch (err) {
          console.error(`[cron] Failed to trigger pipeline for ${report.id}:`, err);
        }
      }
    }

    console.log(`[cron] Complete: ${remindersSent} reminders, ${pipelinesTriggered} pipelines`);

    return NextResponse.json({
      success: true,
      remindersSent,
      pipelinesTriggered,
      timestamp: new Date(now).toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron] Error: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
