// ─── Stripe Webhook Handler ──────────────────────────────────────────────────
// Verifies Stripe signature and processes payment events.
// CRITICAL: This is the ONLY trigger for report generation pipeline.
// Never trigger pipeline from the frontend.

import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/services/stripe-service';
import { createAdminClient } from '@/lib/supabase/admin';
import { runPipeline } from '@/lib/pipeline/orchestrator';
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
  // Stripe can deliver webhooks multiple times. If the report has already
  // moved past 'intake', this is a duplicate — skip silently.
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

  // ── Trigger the report generation pipeline ──────────────────────────
  // This is the ONLY place the pipeline should be triggered.
  console.log(`[webhook/stripe] Triggering pipeline for report ${reportId}`);

  // Fire-and-forget: pipeline runs asynchronously. Errors are recorded
  // in the report's pipeline_error_log field by the orchestrator.
  runPipeline(reportId).catch((err) => {
    console.error(
      `[webhook/stripe] Pipeline failed for report ${reportId}: ${err}`
    );
  });
}
