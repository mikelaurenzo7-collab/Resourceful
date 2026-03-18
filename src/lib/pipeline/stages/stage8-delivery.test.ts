// ─── Stage 8: Client Delivery Tests ─────────────────────────────────────────

import { vi } from 'vitest';
import { makeReport, makePropertyData, makeComparableSale } from '@/lib/__tests__/fixtures';

// ─── Mock email service ─────────────────────────────────────────────────────

const mockSendReportDeliveryEmail = vi.fn();

vi.mock('@/lib/services/resend-email', () => ({
  sendReportDeliveryEmail: (...args: unknown[]) => mockSendReportDeliveryEmail(...args),
}));

import { runDelivery } from '@/lib/pipeline/stages/stage8-delivery';

// ─── Supabase mock builder ──────────────────────────────────────────────────

function buildSupabaseMock(overrides?: {
  report?: ReturnType<typeof makeReport> | null;
  propertyData?: ReturnType<typeof makePropertyData> | null;
  comps?: ReturnType<typeof makeComparableSale>[];
  filingGuide?: string | null;
  signedUrl?: string | null;
  signedUrlError?: string | null;
  statusUpdateError?: string | null;
  approvalInsertError?: string | null;
}) {
  const report = overrides?.report !== undefined ? overrides.report : makeReport({
    status: 'pending_approval',
    client_email: 'client@example.com',
    report_pdf_storage_path: 'reports/rpt_test_001/report.pdf',
  });
  const propertyData = overrides?.propertyData !== undefined ? overrides.propertyData : makePropertyData();
  const comps = overrides?.comps ?? [makeComparableSale()];
  const filingGuide = overrides?.filingGuide ?? 'File your appeal by July 31.';
  const signedUrl = overrides?.signedUrl ?? 'https://storage.example.com/signed-report.pdf';

  const supabase = {
    from: vi.fn().mockImplementation((table: string) => {
      const chain: Record<string, any> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: overrides?.statusUpdateError ? { message: overrides.statusUpdateError } : null,
        }),
      });
      chain.insert = vi.fn().mockResolvedValue({
        error: overrides?.approvalInsertError ? { message: overrides.approvalInsertError } : null,
      });
      chain.single = vi.fn().mockImplementation(() => {
        if (table === 'reports') return Promise.resolve({ data: report, error: null });
        if (table === 'property_data') return Promise.resolve({ data: propertyData, error: null });
        if (table === 'report_narratives') return Promise.resolve({ data: filingGuide ? { content: filingGuide } : null, error: null });
        return Promise.resolve({ data: null, error: null });
      });

      // comparable_sales returns an array (no .single())
      if (table === 'comparable_sales') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: comps, error: null }),
          }),
        };
      }

      return chain;
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: overrides?.signedUrlError ? null : { signedUrl },
          error: overrides?.signedUrlError ? { message: overrides.signedUrlError } : null,
        }),
      }),
    },
  };

  return supabase as any;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockSendReportDeliveryEmail.mockResolvedValue({ data: { id: 'email_001' }, error: null });
});

describe('runDelivery', () => {
  it('sends email and updates status to delivered', async () => {
    const supabase = buildSupabaseMock();
    const result = await runDelivery('rpt_test_001', 'admin_user_001', supabase);

    expect(result.success).toBe(true);
    expect(mockSendReportDeliveryEmail).toHaveBeenCalledOnce();

    const emailParams = mockSendReportDeliveryEmail.mock.calls[0][0];
    expect(emailParams.to).toBe('client@example.com');
    expect(emailParams.reportId).toBe('rpt_test_001');
    expect(emailParams.pdfUrl).toBe('https://storage.example.com/signed-report.pdf');
  });

  it('fails when email delivery fails', async () => {
    mockSendReportDeliveryEmail.mockResolvedValue({
      data: null,
      error: 'Resend API timeout',
    });

    const supabase = buildSupabaseMock();
    const result = await runDelivery('rpt_test_001', 'admin_user_001', supabase);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Email delivery failed');
  });

  it('fails when report is not found', async () => {
    const supabase = buildSupabaseMock({ report: null });
    const result = await runDelivery('rpt_nonexistent', 'admin_user_001', supabase);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to fetch report');
  });

  it('fails when report status is not deliverable', async () => {
    const report = makeReport({
      status: 'intake',
      client_email: 'client@example.com',
      report_pdf_storage_path: 'reports/rpt_test_001/report.pdf',
    });

    const supabase = buildSupabaseMock({ report });
    const result = await runDelivery('rpt_test_001', 'admin_user_001', supabase);

    expect(result.success).toBe(false);
    expect(result.error).toContain('must be pending_approval or approved');
  });

  it('fails when no PDF storage path exists', async () => {
    const report = makeReport({
      status: 'pending_approval',
      client_email: 'client@example.com',
      report_pdf_storage_path: null,
    });

    const supabase = buildSupabaseMock({ report });
    const result = await runDelivery('rpt_test_001', 'admin_user_001', supabase);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No PDF storage path');
  });

  it('fails when no client email on report', async () => {
    const report = makeReport({
      status: 'pending_approval',
      client_email: null as any,
      report_pdf_storage_path: 'reports/rpt_test_001/report.pdf',
    });

    const supabase = buildSupabaseMock({ report });
    const result = await runDelivery('rpt_test_001', 'admin_user_001', supabase);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No client email');
  });

  it('fails when signed URL creation fails', async () => {
    const supabase = buildSupabaseMock({ signedUrlError: 'Object not found' });
    const result = await runDelivery('rpt_test_001', 'admin_user_001', supabase);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to create signed URL');
  });

  it('fails when report status update fails after email sent', async () => {
    const supabase = buildSupabaseMock({ statusUpdateError: 'DB connection lost' });
    const result = await runDelivery('rpt_test_001', 'admin_user_001', supabase);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Report status update failed');
    // Email was still sent
    expect(mockSendReportDeliveryEmail).toHaveBeenCalledOnce();
  });

  it('succeeds even when approval event insert fails (non-fatal)', async () => {
    const supabase = buildSupabaseMock({ approvalInsertError: 'Unique constraint violation' });
    const result = await runDelivery('rpt_test_001', 'admin_user_001', supabase);

    // Approval event failure is non-fatal (just logged)
    expect(result.success).toBe(true);
  });
});
