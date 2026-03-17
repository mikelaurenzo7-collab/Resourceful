// ─── Stripe Webhook Handler ──────────────────────────────────────────────────
// Verifies Stripe signature and processes payment events.
// In the pay-after model, payment happens AFTER the report is approved.
// This webhook unlocks the report for the user (approved → delivered).

import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/services/stripe-service';
import { createAdminClient } from '@/lib/supabase/admin';
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

  // ── Fetch report to verify it's in the right state ────────────────────
  const { data: existingReport } = await supabase
    .from('reports')
    .select('status')
    .eq('id', reportId)
    .single();

  if (!existingReport) {
    console.error(`[webhook/stripe] Report ${reportId} not found`);
    return;
  }

  // ── Idempotency: skip if already delivered or not in approved state ───
  if (existingReport.status === 'delivered') {
    console.log(
      `[webhook/stripe] Report ${reportId} already delivered — skipping duplicate webhook`
    );
    return;
  }

  if (existingReport.status !== 'approved') {
    console.warn(
      `[webhook/stripe] Report ${reportId} in status '${existingReport.status}' — expected 'approved'. Recording payment but not unlocking.`
    );
    // Still record the payment even if status is unexpected
    await supabase
      .from('reports')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        payment_status: 'succeeded',
        amount_paid_cents: paymentIntent.amount,
      })
      .eq('id', reportId);
    return;
  }

  // ── Unlock report: approved → delivered ───────────────────────────────
  const { error: updateError } = await supabase
    .from('reports')
    .update({
      status: 'delivered',
      stripe_payment_intent_id: paymentIntent.id,
      payment_status: 'succeeded',
      amount_paid_cents: paymentIntent.amount,
      delivered_at: new Date().toISOString(),
    })
    .eq('id', reportId)
    .eq('status', 'approved'); // Atomic guard — only transition approved → delivered

  if (updateError) {
    console.error(
      `[webhook/stripe] Failed to unlock report ${reportId}: ${updateError.message}`
    );
    throw new Error(`Failed to unlock report: ${updateError.message}`);
  }

  console.log(`[webhook/stripe] Report ${reportId} unlocked (delivered) after payment`);
}
