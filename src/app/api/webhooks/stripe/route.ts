// ─── Stripe Webhook Handler ──────────────────────────────────────────────────
// Verifies Stripe signature and processes payment events.
//
// On successful payment:
//   1. Update report status to 'paid'
//   2. Send payment confirmation email
//   3. Show instant preview on success page (via valuation API, client-side)
//
// Pipeline is NOT triggered here. The cron job at /api/cron/photo-reminders
// triggers the pipeline ~14 hours after payment, giving the customer time to
// upload photos that strengthen their case. This saves API costs by running
// the full pipeline once with the best available data, not twice.

import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/services/stripe-service';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPaymentConfirmationEmail } from '@/lib/services/resend-email';
import type Stripe from 'stripe';
import type { Report } from '@/types/database';

export async function POST(request: NextRequest) {
  // ── Read raw body for signature verification ────────────────────────────
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.error('[webhook/stripe] Missing stripe-signature header');
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  // ── Verify signature ───────────────────────────────────────────────────
  const { data: event, error: verifyError } = constructWebhookEvent(
    body,
    signature
  );

  if (verifyError || !event) {
    console.error(`[webhook/stripe] Verification failed: ${verifyError}`);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  // ── Handle events ─────────────────────────────────────────────────────
  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        await handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent
        );
        break;
      }
      default:
        console.log(`[webhook/stripe] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[webhook/stripe] Handler error: ${message}`);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// ─── Event Handlers ──────────────────────────────────────────────────────────

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
) {
  const reportId = paymentIntent.metadata?.report_id;

  if (!reportId) {
    console.error(
      '[webhook/stripe] payment_intent.succeeded missing report_id in metadata'
    );
    return;
  }

  console.log(
    `[webhook/stripe] Payment succeeded for report ${reportId}. PI: ${paymentIntent.id}`
  );

  const supabase = createAdminClient();

  // ── Idempotency guard: only process reports still in 'intake' status ──
  const { data: existingReport } = await supabase
    .from('reports')
    .select('status')
    .eq('id', reportId)
    .single();

  if (!existingReport) {
    console.error(`[webhook/stripe] Report ${reportId} not found`);
    return;
  }

  if (existingReport.status !== 'intake') {
    console.log(
      `[webhook/stripe] Report ${reportId} already in '${existingReport.status}' status — skipping duplicate webhook`
    );
    return;
  }

  // ── Update report to 'paid' status with payment fields ──────────────
  const { error: updateError } = await supabase
    .from('reports')
    .update({
      status: 'paid',
      stripe_payment_intent_id: paymentIntent.id,
      payment_status: 'succeeded',
      amount_paid_cents: paymentIntent.amount,
    })
    .eq('id', reportId);

  if (updateError) {
    console.error(
      `[webhook/stripe] Failed to update report ${reportId}: ${updateError.message}`
    );
    throw new Error(`Failed to update report: ${updateError.message}`);
  }

  // ── Send payment confirmation email (non-blocking) ─────────────────
  const { data: reportData } = await supabase
    .from('reports')
    .select('client_email, property_address, property_type')
    .eq('id', reportId)
    .single();

  const report = reportData as Report | null;
  if (report?.client_email) {
    sendPaymentConfirmationEmail({
      to: report.client_email,
      reportId,
      propertyAddress: report.property_address,
      amountPaidCents: paymentIntent.amount,
      propertyType: report.property_type ?? 'residential',
    }).catch((err) => {
      console.error(`[webhook/stripe] Payment confirmation email failed for ${reportId}:`, err);
    });
  }

  // Pipeline is deferred — triggered by cron at ~14 hours to allow
  // photo uploads. See /api/cron/photo-reminders/route.ts.
  console.log(`[webhook/stripe] Report ${reportId} marked as paid. Pipeline will run via cron after photo window.`);
}
