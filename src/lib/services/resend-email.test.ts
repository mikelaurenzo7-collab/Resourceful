// ─── Resend Email Service Tests ──────────────────────────────────────────────

import { vi } from 'vitest';

// ─── Mock Resend SDK ────────────────────────────────────────────────────────

const mockSend = vi.fn();

vi.mock('resend', () => {
  return {
    Resend: class MockResend {
      emails = { send: mockSend };
    },
  };
});

import {
  sendReportDeliveryEmail,
  sendAdminNotification,
  sendReportRejectionAlert,
} from '@/lib/services/resend-email';

// ─── Helpers ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── sendReportDeliveryEmail ────────────────────────────────────────────────

describe('sendReportDeliveryEmail', () => {
  const params = {
    to: 'client@example.com',
    reportId: 'rpt_001',
    propertyAddress: '123 Main St, Springfield, IL',
    concludedValue: 200000,
    assessedValue: 250000,
    potentialSavings: 50000,
    pdfUrl: 'https://storage.example.com/report.pdf',
    filingGuide: 'File by July 31.',
  };

  it('sends email with correct to/from/subject', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email_001' }, error: null });

    const result = await sendReportDeliveryEmail(params);

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ id: 'email_001' });
    expect(mockSend).toHaveBeenCalledOnce();

    const call = mockSend.mock.calls[0][0];
    expect(call.to).toBe('client@example.com');
    expect(call.from).toBe('reports@resourceful.app');
    expect(call.subject).toContain('123 Main St, Springfield, IL');
    expect(call.html).toContain('123 Main St, Springfield, IL');
  });

  it('returns error when Resend SDK returns error', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: 'Invalid API key' } });

    const result = await sendReportDeliveryEmail(params);

    expect(result.data).toBeNull();
    expect(result.error).toContain('Email send failed');
    expect(result.error).toContain('Invalid API key');
  });

  it('returns error when Resend SDK throws', async () => {
    mockSend.mockRejectedValue(new Error('Network timeout'));

    const result = await sendReportDeliveryEmail(params);

    expect(result.data).toBeNull();
    expect(result.error).toContain('Email send failed');
    expect(result.error).toContain('Network timeout');
  });
});

// ─── sendAdminNotification ──────────────────────────────────────────────────

describe('sendAdminNotification', () => {
  const params = {
    reportId: 'rpt_002',
    propertyAddress: '456 Oak Ave, Chicago, IL',
    propertyType: 'residential',
    reviewUrl: 'https://app.example.com/admin/reports/rpt_002',
  };

  it('sends notification to admin email', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email_002' }, error: null });

    const result = await sendAdminNotification(params);

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ id: 'email_002' });

    const call = mockSend.mock.calls[0][0];
    expect(call.to).toBe('admin@resourceful.app');
    expect(call.subject).toContain('[Review Needed]');
    expect(call.subject).toContain('456 Oak Ave, Chicago, IL');
    expect(call.html).toContain('rpt_002');
  });

  it('returns error when Resend throws', async () => {
    mockSend.mockRejectedValue(new Error('Service unavailable'));

    const result = await sendAdminNotification(params);

    expect(result.data).toBeNull();
    expect(result.error).toContain('Admin notification failed');
  });
});

// ─── sendReportRejectionAlert ───────────────────────────────────────────────

describe('sendReportRejectionAlert', () => {
  const params = {
    reportId: 'rpt_003',
    propertyAddress: '789 Pine Rd, Naperville, IL',
    notes: 'Comparable sales are too far away. Re-run with tighter radius.',
  };

  it('sends rejection alert to admin', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email_003' }, error: null });

    const result = await sendReportRejectionAlert(params);

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ id: 'email_003' });

    const call = mockSend.mock.calls[0][0];
    expect(call.to).toBe('admin@resourceful.app');
    expect(call.subject).toContain('[Rejected]');
    expect(call.subject).toContain('789 Pine Rd, Naperville, IL');
    expect(call.html).toContain('Comparable sales are too far away');
  });

  it('returns error on SDK error response', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: 'Rate limited' } });

    const result = await sendReportRejectionAlert(params);

    expect(result.data).toBeNull();
    expect(result.error).toContain('Rejection alert failed');
    expect(result.error).toContain('Rate limited');
  });
});
