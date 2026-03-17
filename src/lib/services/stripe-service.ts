// ─── Stripe Payment Service ──────────────────────────────────────────────────
// Creates payment intents, verifies webhook signatures, and retrieves payments.

import Stripe from 'stripe';

// ─── Client ──────────────────────────────────────────────────────────────────

// Lazy-initialize to avoid build-time errors when env vars aren't set
let _stripe: Stripe | null = null;
function getStripeClient(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
      typescript: true,
    });
  }
  return _stripe;
}

// Validated at call time — must be set in production or webhook verification
// will correctly reject all events (empty string causes Stripe to throw).
function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set — cannot verify webhook signatures');
  }
  return secret;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreatePaymentIntentParams {
  amountCents: number;
  customerEmail: string;
  reportId: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  id: string;
  clientSecret: string;
  status: string;
  amountCents: number;
}

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a Stripe PaymentIntent for a report purchase.
 */
export async function createPaymentIntent(
  params: CreatePaymentIntentParams
): Promise<ServiceResult<PaymentIntentResult>> {
  try {
    const intent = await getStripeClient().paymentIntents.create({
      amount: params.amountCents,
      currency: 'usd',
      receipt_email: params.customerEmail,
      metadata: {
        report_id: params.reportId,
        ...params.metadata,
      },
    });

    if (!intent.client_secret) {
      return { data: null, error: 'Stripe did not return a client secret' };
    }

    return {
      data: {
        id: intent.id,
        clientSecret: intent.client_secret,
        status: intent.status,
        amountCents: intent.amount,
      },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[stripe] createPaymentIntent error: ${message}`);
    return { data: null, error: `Stripe payment intent failed: ${message}` };
  }
}

/**
 * Construct and verify a Stripe webhook event from the raw body and signature.
 * Throws on invalid signature so the caller can return a 400.
 */
export function constructWebhookEvent(
  body: string,
  signature: string
): ServiceResult<Stripe.Event> {
  try {
    const event = getStripeClient().webhooks.constructEvent(body, signature, getWebhookSecret());
    return { data: event, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[stripe] webhook verification failed: ${message}`);
    return { data: null, error: `Webhook verification failed: ${message}` };
  }
}

/**
 * Retrieve a PaymentIntent by ID.
 */
export async function getPaymentIntent(
  id: string
): Promise<ServiceResult<PaymentIntentResult>> {
  try {
    const intent = await getStripeClient().paymentIntents.retrieve(id);
    return {
      data: {
        id: intent.id,
        clientSecret: intent.client_secret ?? '',
        status: intent.status,
        amountCents: intent.amount,
      },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[stripe] getPaymentIntent error: ${message}`);
    return { data: null, error: `Stripe retrieve failed: ${message}` };
  }
}
