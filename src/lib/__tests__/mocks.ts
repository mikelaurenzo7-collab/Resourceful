// ─── Test Mocks ──────────────────────────────────────────────────────────────
// Reusable mock factories for external dependencies.
// Usage: vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => mockSupabase() }))

import { vi } from 'vitest';

// ─── Supabase Client Mock ───────────────────────────────────────────────────
// Returns a chainable mock that mimics Supabase query builder.

export interface MockSupabaseChain {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  storage: {
    from: ReturnType<typeof vi.fn>;
  };
  auth: {
    getUser: ReturnType<typeof vi.fn>;
  };
  // The resolved result — set this to control what queries return
  _result: { data: unknown; error: unknown };
}

export function mockSupabase(defaultResult?: { data: unknown; error: unknown }): MockSupabaseChain {
  const result = defaultResult ?? { data: null, error: null };

  const chain: MockSupabaseChain = {
    _result: result,
    from: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test.pdf' }, error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://test.url/signed' }, error: null }),
      }),
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user_test_001', email: 'admin@test.com' } },
        error: null,
      }),
    },
  };

  // Make every method return `chain` for chaining, except `single` which resolves
  const chainMethods = ['from', 'select', 'insert', 'update', 'delete', 'eq', 'order', 'range'];
  for (const method of chainMethods) {
    (chain as Record<string, ReturnType<typeof vi.fn>>)[method].mockReturnValue(chain);
  }
  chain.single.mockResolvedValue(result);

  return chain;
}

// ─── Helper: configure mock to return specific data ─────────────────────────

export function mockSupabaseReturns(
  mock: MockSupabaseChain,
  data: unknown,
  error: unknown = null
) {
  mock._result = { data, error };
  mock.single.mockResolvedValue({ data, error });
  // Also handle non-single queries (select without single)
  mock.range.mockResolvedValue({ data: Array.isArray(data) ? data : [data], error });
}

// ─── Stripe Mock ────────────────────────────────────────────────────────────

export function mockStripeClient() {
  return {
    paymentIntents: {
      create: vi.fn().mockResolvedValue({
        id: 'pi_test_001',
        client_secret: 'pi_test_001_secret_abc',
        status: 'requires_payment_method',
        amount: 4900,
      }),
      retrieve: vi.fn().mockResolvedValue({
        id: 'pi_test_001',
        client_secret: 'pi_test_001_secret_abc',
        status: 'succeeded',
        amount: 4900,
      }),
    },
    webhooks: {
      constructEvent: vi.fn().mockReturnValue({
        id: 'evt_test_001',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_001',
            amount: 4900,
            metadata: { report_id: 'rpt_test_001' },
          },
        },
      }),
    },
  };
}

// ─── Resend Mock ────────────────────────────────────────────────────────────

export function mockResend() {
  return {
    sendReportDelivery: vi.fn().mockResolvedValue({ success: true }),
    sendAdminNotification: vi.fn().mockResolvedValue({ success: true }),
    sendReportRejectionAlert: vi.fn().mockResolvedValue({ success: true }),
  };
}

// ─── Anthropic Mock ─────────────────────────────────────────────────────────

export function mockAnthropic() {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        id: 'msg_test_001',
        content: [{ type: 'text', text: 'Mocked AI response for testing.' }],
        usage: { input_tokens: 100, output_tokens: 50 },
        stop_reason: 'end_turn',
      }),
    },
  };
}
