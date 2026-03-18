// ─── Stripe Service Tests ────────────────────────────────────────────────────

import { vi } from 'vitest';
import { mockStripeClient } from '@/lib/__tests__/mocks';

// ─── Mock Stripe SDK ─────────────────────────────────────────────────────────

const stripeMock = mockStripeClient();

vi.mock('stripe', () => {
  // Stripe SDK uses `new Stripe(key, opts)` — mock must be a constructor
  function MockStripe() {
    return stripeMock;
  }
  return { default: MockStripe };
});

// Import AFTER mock is registered
import {
  createPaymentIntent,
  constructWebhookEvent,
  getPaymentIntent,
} from '@/lib/services/stripe-service';

// ─── createPaymentIntent ─────────────────────────────────────────────────────

describe('createPaymentIntent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default success response
    stripeMock.paymentIntents.create.mockResolvedValue({
      id: 'pi_test_001',
      client_secret: 'pi_test_001_secret_abc',
      status: 'requires_payment_method',
      amount: 4900,
    });
  });

  it('returns id, clientSecret, status, and amountCents on success', async () => {
    const result = await createPaymentIntent({
      amountCents: 4900,
      customerEmail: 'test@example.com',
      reportId: 'rpt_test_001',
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      id: 'pi_test_001',
      clientSecret: 'pi_test_001_secret_abc',
      status: 'requires_payment_method',
      amountCents: 4900,
    });
  });

  it('passes correct params to Stripe', async () => {
    await createPaymentIntent({
      amountCents: 9900,
      customerEmail: 'buyer@example.com',
      reportId: 'rpt_002',
      metadata: { coupon: 'SAVE10' },
    });

    expect(stripeMock.paymentIntents.create).toHaveBeenCalledWith({
      amount: 9900,
      currency: 'usd',
      receipt_email: 'buyer@example.com',
      metadata: {
        report_id: 'rpt_002',
        coupon: 'SAVE10',
      },
    });
  });

  it('returns error string when Stripe throws', async () => {
    stripeMock.paymentIntents.create.mockRejectedValueOnce(
      new Error('Card declined')
    );

    const result = await createPaymentIntent({
      amountCents: 4900,
      customerEmail: 'test@example.com',
      reportId: 'rpt_test_001',
    });

    expect(result.data).toBeNull();
    expect(result.error).toContain('Card declined');
    expect(result.error).toContain('Stripe payment intent failed');
  });

  it('returns error when client_secret is missing', async () => {
    stripeMock.paymentIntents.create.mockResolvedValueOnce({
      id: 'pi_no_secret',
      client_secret: null,
      status: 'requires_payment_method',
      amount: 4900,
    });

    const result = await createPaymentIntent({
      amountCents: 4900,
      customerEmail: 'test@example.com',
      reportId: 'rpt_test_001',
    });

    expect(result.data).toBeNull();
    expect(result.error).toBe('Stripe did not return a client secret');
  });
});

// ─── constructWebhookEvent ───────────────────────────────────────────────────

describe('constructWebhookEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: 'evt_test_001',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_001',
          amount: 4900,
          metadata: { report_id: 'rpt_test_001' },
        },
      },
    });
  });

  it('returns a valid event on success', () => {
    const result = constructWebhookEvent('raw_body', 'sig_header');

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data!.type).toBe('payment_intent.succeeded');
    expect(result.data!.id).toBe('evt_test_001');
  });

  it('passes body, signature, and secret to Stripe', () => {
    constructWebhookEvent('{"payload":"data"}', 'sig_v1=abc');

    expect(stripeMock.webhooks.constructEvent).toHaveBeenCalledWith(
      '{"payload":"data"}',
      'sig_v1=abc',
      'whsec_test_fake' // from setup.ts env
    );
  });

  it('returns error on bad signature', () => {
    stripeMock.webhooks.constructEvent.mockImplementationOnce(() => {
      throw new Error('Invalid signature');
    });

    const result = constructWebhookEvent('bad_body', 'bad_sig');

    expect(result.data).toBeNull();
    expect(result.error).toContain('Invalid signature');
    expect(result.error).toContain('Webhook verification failed');
  });
});

// ─── getPaymentIntent ────────────────────────────────────────────────────────

describe('getPaymentIntent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stripeMock.paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_test_001',
      client_secret: 'pi_test_001_secret_abc',
      status: 'succeeded',
      amount: 4900,
    });
  });

  it('returns payment intent data on success', async () => {
    const result = await getPaymentIntent('pi_test_001');

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      id: 'pi_test_001',
      clientSecret: 'pi_test_001_secret_abc',
      status: 'succeeded',
      amountCents: 4900,
    });
  });

  it('calls Stripe retrieve with the correct id', async () => {
    await getPaymentIntent('pi_xyz_999');

    expect(stripeMock.paymentIntents.retrieve).toHaveBeenCalledWith('pi_xyz_999');
  });

  it('returns error when Stripe throws', async () => {
    stripeMock.paymentIntents.retrieve.mockRejectedValueOnce(
      new Error('No such payment intent')
    );

    const result = await getPaymentIntent('pi_nonexistent');

    expect(result.data).toBeNull();
    expect(result.error).toContain('No such payment intent');
    expect(result.error).toContain('Stripe retrieve failed');
  });

  it('returns empty string for clientSecret when null', async () => {
    stripeMock.paymentIntents.retrieve.mockResolvedValueOnce({
      id: 'pi_test_002',
      client_secret: null,
      status: 'canceled',
      amount: 0,
    });

    const result = await getPaymentIntent('pi_test_002');

    expect(result.data!.clientSecret).toBe('');
  });
});
