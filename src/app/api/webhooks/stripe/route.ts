// ─── Stripe Webhook Handler ──────────────────────────────────────────────────
// Verifies Stripe signatures and establishes durable ownership of paid work.
// The webhook never launches the report pipeline in the request lifecycle.

import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { paymentLogger } from '@/lib/logger';
import { enqueuePipelineRun } from '@/lib/pipeline/queue';
import { inferNextStageNumber } from '@/lib/pipeline/run-types';
import {
  sendDisputeAlert,
  sendPaymentReceipt,
} from '@/lib/services/resend-email';
import { constructWebhookEvent } from '@/lib/services/stripe-service';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ReportStatus } from '@/types/database';

export const maxDuration = 60;

interface PaymentReportState {
  status: ReportStatus;
  stripe_payment_intent_id: string | null;
  pipeline_last_completed_stage: string | null;
}

const RECOVERABLE_PAYMENT_STATUSES = new Set<ReportStatus>([
  'paid',
  'data_pull',
  'photo_pending',
  'processing',
]);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    paymentLogger.error('Missing stripe-signature header');
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  const { data: event, error: verifyError } = constructWebhookEvent(
    body,
    signature
  );

  if (verifyError || !event) {
    paymentLogger.error(
      { err: verifyError },
      'Webhook signature verification failed'
    );
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent
        );
        break;
      case 'charge.dispute.created':
      case 'charge.dispute.closed':
        await handleDispute(event.data.object as Stripe.Dispute);
        break;
      default:
        paymentLogger.info(
          { eventType: event.type },
          'Unhandled Stripe event type'
        );
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    paymentLogger.error(
      { eventId: event.id, eventType: event.type, err: message },
      'Webhook handler failed'
    );
    // Stripe retries the event. If payment state was already persisted, the next
    // delivery will still enqueue the same idempotent pipeline run.
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function loadPaymentReport(
  reportId: string
): Promise<PaymentReportState> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('reports')
    .select(
      'status, stripe_payment_intent_id, pipeline_last_completed_stage'
    )
    .eq('id', reportId)
    .single();

  if (error || !data) {
    throw new Error(
      `Report ${reportId} was not found for paid Stripe work: ${
        error?.message ?? 'not found'
      }`
    );
  }

  return data as unknown as PaymentReportState;
}

function assertPaymentIntentOwnership(
  reportId: string,
  storedPaymentIntentId: string | null,
  expectedPaymentIntentId: string
): void {
  if (
    storedPaymentIntentId &&
    storedPaymentIntentId !== expectedPaymentIntentId
  ) {
    throw new Error(
      `Report ${reportId} is already bound to another payment intent`
    );
  }
}

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
) {
  const reportId = paymentIntent.metadata?.report_id;

  if (!reportId) {
    paymentLogger.error(
      { paymentIntentId: paymentIntent.id },
      'payment_intent.succeeded is missing report_id metadata'
    );
    return;
  }

  paymentLogger.info(
    {
      reportId,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
    },
    'Payment succeeded'
  );

  const supabase = createAdminClient();
  let report = await loadPaymentReport(reportId);
  let paymentTransitioned = false;

  assertPaymentIntentOwnership(
    reportId,
    report.stripe_payment_intent_id,
    paymentIntent.id
  );

  if (report.status === 'intake') {
    const { data: updated, error: updateError } = await supabase
      .from('reports')
      .update({
        status: 'paid',
        stripe_payment_intent_id: paymentIntent.id,
        payment_status: 'succeeded',
        amount_paid_cents: paymentIntent.amount,
      })
      .eq('id', reportId)
      .eq('status', 'intake')
      .select(
        'status, stripe_payment_intent_id, pipeline_last_completed_stage'
      )
      .maybeSingle();

    if (updateError) {
      throw new Error(
        `Failed to persist paid report state: ${updateError.message}`
      );
    }

    if (updated) {
      report = updated as unknown as PaymentReportState;
      paymentTransitioned = true;
    } else {
      // A concurrent delivery may have won the intake -> paid transition.
      report = await loadPaymentReport(reportId);
    }
  }

  assertPaymentIntentOwnership(
    reportId,
    report.stripe_payment_intent_id,
    paymentIntent.id
  );

  if (
    report.stripe_payment_intent_id === null &&
    RECOVERABLE_PAYMENT_STATUSES.has(report.status)
  ) {
    const { data: bound, error: bindError } = await supabase
      .from('reports')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        payment_status: 'succeeded',
        amount_paid_cents: paymentIntent.amount,
      })
      .eq('id', reportId)
      .is('stripe_payment_intent_id', null)
      .select(
        'status, stripe_payment_intent_id, pipeline_last_completed_stage'
      )
      .maybeSingle();

    if (bindError) {
      throw new Error(
        `Failed to reconcile report payment identity: ${bindError.message}`
      );
    }

    // A concurrent webhook may have won the compare-and-set with another
    // payment intent. Never infer ownership from a zero-row update: reload the
    // canonical row and fail closed if the persisted identity differs.
    report = bound
      ? (bound as unknown as PaymentReportState)
      : await loadPaymentReport(reportId);

    assertPaymentIntentOwnership(
      reportId,
      report.stripe_payment_intent_id,
      paymentIntent.id
    );

    if (report.stripe_payment_intent_id !== paymentIntent.id) {
      throw new Error(
        `Report ${reportId} payment identity could not be durably established`
      );
    }
  }

  if (!RECOVERABLE_PAYMENT_STATUSES.has(report.status)) {
    paymentLogger.info(
      {
        reportId,
        paymentIntentId: paymentIntent.id,
        currentStatus: report.status,
      },
      'Duplicate payment event reached a non-runnable report; no pipeline work added'
    );
    return;
  }

  if (report.stripe_payment_intent_id !== paymentIntent.id) {
    throw new Error(
      `Report ${reportId} does not have durable ownership for payment intent ${paymentIntent.id}`
    );
  }

  const run = await enqueuePipelineRun({
    reportId,
    source: 'stripe',
    idempotencyKey: `stripe:${paymentIntent.id}`,
    startStage: inferNextStageNumber(
      report.pipeline_last_completed_stage
    ),
    metadata: {
      payment_intent_id: paymentIntent.id,
      amount_cents: paymentIntent.amount,
      enqueued_from: 'payment_intent.succeeded',
    },
  });

  paymentLogger.info(
    {
      reportId,
      paymentIntentId: paymentIntent.id,
      runId: run.id,
      runStatus: run.status,
      currentStage: run.current_stage,
    },
    'Durable pipeline ownership established'
  );

  if (paymentTransitioned) {
    await sendReceiptForPaidReport(reportId, paymentIntent);
  }
}

async function sendReceiptForPaidReport(
  reportId: string,
  paymentIntent: Stripe.PaymentIntent
) {
  const supabase = createAdminClient();

  try {
    const { data: reportDetails, error } = await supabase
      .from('reports')
      .select(
        'client_email, client_name, property_address, service_type, review_tier, has_tax_bill'
      )
      .eq('id', reportId)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!reportDetails?.client_email) return;

    const serviceNames: Record<string, string> = {
      tax_appeal: 'Tax Appeal Report',
      pre_purchase: 'Pre-Purchase Analysis',
      pre_listing: 'Pre-Listing Report',
    };
    const tierNames: Record<string, string> = {
      auto: 'Auto Report',
      expert_reviewed: 'Expert Reviewed',
      guided_filing: 'Guided Filing',
      full_representation: 'Full Representation',
    };

    const receipt = await sendPaymentReceipt({
      to: reportDetails.client_email,
      clientName: reportDetails.client_name ?? null,
      reportId,
      propertyAddress:
        reportDetails.property_address ?? 'Your property',
      amountCents: paymentIntent.amount,
      serviceName:
        serviceNames[reportDetails.service_type ?? ''] ??
        'Property Report',
      tierName:
        tierNames[reportDetails.review_tier ?? 'auto'] ??
        'Auto Report',
      discountApplied: Boolean(reportDetails.has_tax_bill),
    });

    if (receipt.error) {
      throw new Error(receipt.error);
    }
  } catch (error) {
    paymentLogger.warn(
      {
        reportId,
        err: error instanceof Error ? error.message : String(error),
      },
      'Payment was durably queued but receipt delivery failed'
    );
  }
}

async function handleDispute(dispute: Stripe.Dispute) {
  const paymentIntentId =
    typeof dispute.payment_intent === 'string'
      ? dispute.payment_intent
      : dispute.payment_intent?.id ?? 'unknown';

  paymentLogger.info(
    {
      disputeId: dispute.id,
      status: dispute.status,
      paymentIntentId,
      reason: dispute.reason,
      amount: dispute.amount,
    },
    'Dispute event received'
  );

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

  const alert = await sendDisputeAlert({
    disputeId: dispute.id,
    paymentIntentId,
    amount: dispute.amount,
    reason: dispute.reason,
    status: dispute.status,
    reportId,
  });

  if (alert.error) {
    paymentLogger.warn(
      { disputeId: dispute.id, err: alert.error },
      'Dispute alert email failed'
    );
  }
}
