// ─── Stripe Webhook Handler ──────────────────────────────────────────────────
// Verifies Stripe signature and processes payment events.
// CRITICAL: This is the ONLY trigger for report generation pipeline.
// Never trigger pipeline from the frontend.

import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/services/stripe-service';
import { createAdminClient } from '@/lib/supabase/admin';
import { runPipeline } from '@/lib/pipeline/orchestrator';
import { sendDisputeAlert, sendPaymentReceipt } from '@/lib/services/resend-email';
import type Stripe from 'stripe';

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
      case 'charge.dispute.created':
      case 'charge.dispute.closed': {
        await handleDispute(event.data.object as Stripe.Dispute);
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

  // ── Idempotency check: only process if report is still in 'intake' status ──
  // Stripe can retry webhooks. Without this, duplicate events trigger duplicate pipelines.
  const { data: existingReport } = await supabase
    .from('reports')
    .select('status, stripe_payment_intent_id')
    .eq('id', reportId)
    .single();

  if (!existingReport) {
    console.error(`[webhook/stripe] Report ${reportId} not found`);
    return;
  }

  // If already paid/processing/delivered, this is a duplicate webhook — skip
  if (existingReport.status !== 'intake') {
    console.log(
      `[webhook/stripe] Duplicate webhook for report ${reportId} (status: ${existingReport.status}). Skipping.`
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
    .eq('id', reportId)
    .eq('status', 'intake'); // Double-check with WHERE clause for atomicity

  if (updateError) {
    console.error(
      `[webhook/stripe] Failed to update report ${reportId}: ${updateError.message}`
    );
    throw new Error(`Failed to update report: ${updateError.message}`);
  }

  // ── Send payment receipt email (non-blocking) ───────────────────────
  try {
    const { data: reportDetails } = await supabase
      .from('reports')
      .select('client_email, client_name, property_address, service_type, review_tier, has_tax_bill')
      .eq('id', reportId)
      .single();

    if (reportDetails?.client_email) {
      const SERVICE_NAMES: Record<string, string> = {
        tax_appeal: 'Tax Appeal Report',
        pre_purchase: 'Pre-Purchase Analysis',
        pre_listing: 'Pre-Listing Report',
      };

      const TIER_NAMES: Record<string, string> = {
        auto: 'Auto Report',
        expert_reviewed: 'Expert Reviewed',
        guided_filing: 'Guided Filing',
        full_representation: 'Full Representation',
      };

      sendPaymentReceipt({
        to: reportDetails.client_email,
        clientName: reportDetails.client_name ?? null,
        reportId,
        propertyAddress: reportDetails.property_address ?? 'Your property',
        amountCents: paymentIntent.amount,
        serviceName: SERVICE_NAMES[reportDetails.service_type ?? ''] ?? 'Property Report',
        tierName: TIER_NAMES[reportDetails.review_tier ?? 'auto'] ?? 'Auto Report',
        discountApplied: !!reportDetails.has_tax_bill,
      }).catch((e) => console.warn(`[webhook/stripe] Receipt email failed (non-fatal): ${e}`));
    }
  } catch (e) {
    console.warn(`[webhook/stripe] Receipt email lookup failed (non-fatal): ${e}`);
  }

  // ── Trigger the report generation pipeline ──────────────────────────
  // This is the ONLY place the pipeline should be triggered.
  console.log(`[webhook/stripe] Triggering pipeline for report ${reportId}`);

  // Pipeline runs asynchronously. On failure, record error to database
  // so the report doesn't get stuck in 'paid' status forever.
  runPipeline(reportId).catch(async (err) => {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`[webhook/stripe] Pipeline failed for report ${reportId}: ${message}`, stack);

    // Mark report as failed with error details — prevents stuck reports
    try {
      const { error: updateErr } = await supabase
        .from('reports')
        .update({
          status: 'failed',
          pipeline_error_log: [{
            stage: 'pipeline',
            error: message,
            stack: stack ?? message,
            timestamp: new Date().toISOString(),
          }],
        } as never)
        .eq('id', reportId);

      if (updateErr) {
        console.error(
          `[webhook/stripe] CRITICAL: Pipeline failed AND error recording failed for report ${reportId}. ` +
          `Report may be stuck in 'paid' status. DB error: ${updateErr.message}. Pipeline error: ${message}`
        );
      }
    } catch (dbErr) {
      console.error(
        `[webhook/stripe] CRITICAL: Pipeline failed AND error recording threw for report ${reportId}. ` +
        `Report may be stuck in 'paid' status. Exception: ${dbErr}. Pipeline error: ${message}`
      );
    }
  });
}

async function handleDispute(dispute: Stripe.Dispute) {
  const paymentIntentId = typeof dispute.payment_intent === 'string'
    ? dispute.payment_intent
    : dispute.payment_intent?.id ?? 'unknown';

  console.log(
    `[webhook/stripe] Dispute ${dispute.status}: ${dispute.id} (PI: ${paymentIntentId}, reason: ${dispute.reason})`
  );

  // Try to find the associated report
  let reportId: string | undefined;
  if (paymentIntentId !== 'unknown') {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('reports')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single();
    if (data) reportId = data.id;
  }

  // Alert admin via email
  await sendDisputeAlert({
    disputeId: dispute.id,
    paymentIntentId,
    amount: dispute.amount,
    reason: dispute.reason,
    status: dispute.status,
    reportId,
  });
}
