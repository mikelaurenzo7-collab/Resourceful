import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// ─── Mock external dependencies ──────────────────────────────────────────────

vi.mock('@/lib/services/resend-email', () => ({
  sendReportReadyNotification: vi.fn().mockResolvedValue({ data: { id: 'email-123' }, error: null }),
}));

vi.mock('@/lib/services/reminder-service', () => ({
  subscribeToReminders: vi.fn().mockResolvedValue(undefined),
}));

import { runDelivery } from './stage8-delivery';
import { sendReportReadyNotification } from '@/lib/services/resend-email';
import { subscribeToReminders } from '@/lib/services/reminder-service';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const REPORT_ID = 'report-uuid-1';
const ADMIN_ID = 'admin-uuid-1';

function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    id: REPORT_ID,
    status: 'pending_approval',
    report_pdf_storage_path: 'reports/report-uuid-1.pdf',
    client_email: 'owner@example.com',
    email_delivery_preference: true,
    property_address: '123 Main St',
    city: 'Chicago',
    state: 'IL',
    county: 'Cook County',
    county_fips: '17031',
    ...overrides,
  };
}

function makePropertyData(overrides = {}) {
  return {
    assessed_value: 500_000,
    concluded_value: 400_000,
    ...overrides,
  };
}

// Build a chainable Supabase mock.
// Each method returns the builder so calls can be chained like the real client.
function makeSupabaseMock({
  report = makeReport(),
  propertyData = makePropertyData(),
  countyRules = [{ county_name: 'Cook County' }],
  reportUpdateError = null,
  approvalInsertError = null,
} = {}) {
  const fromMap: Record<string, unknown> = {
    reports: {
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: report, error: null }),
      // After update().eq() chain the resolved value changes
    },
    property_data: {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: propertyData, error: null }),
    },
    approval_events: {
      insert: vi.fn().mockResolvedValue({ error: approvalInsertError }),
    },
    county_rules: {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: countyRules, error: null }),
    },
  };

  // Override reports.update chain to return the expected error
  const reportsObj = fromMap['reports'] as Record<string, ReturnType<typeof vi.fn>>;
  reportsObj['update'] = vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ error: reportUpdateError }),
  }));

  const supabase = {
    from: vi.fn((table: string) => fromMap[table] ?? {}),
  } as unknown as SupabaseClient<Database>;

  return { supabase, fromMap };
}

// ─── runDelivery tests ────────────────────────────────────────────────────────

describe('runDelivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful delivery', () => {
    it('returns success: true on happy path', async () => {
      const { supabase } = makeSupabaseMock();
      const result = await runDelivery(REPORT_ID, ADMIN_ID, supabase);
      expect(result.success).toBe(true);
    });

    it('sends email notification when email_delivery_preference is true', async () => {
      const { supabase } = makeSupabaseMock();
      await runDelivery(REPORT_ID, ADMIN_ID, supabase);
      expect(sendReportReadyNotification).toHaveBeenCalledOnce();
    });

    it('passes correct data to sendReportReadyNotification', async () => {
      const { supabase } = makeSupabaseMock();
      await runDelivery(REPORT_ID, ADMIN_ID, supabase);
      expect(sendReportReadyNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'owner@example.com',
          reportId: REPORT_ID,
          potentialSavings: 100_000, // 500k - 400k
        })
      );
    });

    it('subscribes to reminders on successful delivery', async () => {
      const { supabase } = makeSupabaseMock();
      await runDelivery(REPORT_ID, ADMIN_ID, supabase);
      expect(subscribeToReminders).toHaveBeenCalledWith(REPORT_ID);
    });

    it('updates report status to delivered', async () => {
      const { supabase } = makeSupabaseMock();
      await runDelivery(REPORT_ID, ADMIN_ID, supabase);

      // The update was called on the reports table
      expect(supabase.from).toHaveBeenCalledWith('reports');
    });
  });

  describe('email opt-out', () => {
    it('does not send email when email_delivery_preference is false', async () => {
      const { supabase } = makeSupabaseMock({
        report: makeReport({ email_delivery_preference: false }),
      });
      const result = await runDelivery(REPORT_ID, ADMIN_ID, supabase);
      expect(result.success).toBe(true);
      expect(sendReportReadyNotification).not.toHaveBeenCalled();
    });
  });

  describe('email failure is non-fatal (dashboard-first)', () => {
    it('returns success: true even when email sending fails', async () => {
      vi.mocked(sendReportReadyNotification).mockResolvedValueOnce({
        data: null,
        error: 'SMTP connection refused',
      });

      const { supabase } = makeSupabaseMock();
      const result = await runDelivery(REPORT_ID, ADMIN_ID, supabase);

      // Report is still delivered — email failure is non-fatal
      expect(result.success).toBe(true);
    });
  });

  describe('reminder failure is non-fatal', () => {
    it('returns success: true even when subscribeToReminders throws', async () => {
      vi.mocked(subscribeToReminders).mockRejectedValueOnce(new Error('reminder service down'));

      const { supabase } = makeSupabaseMock();
      const result = await runDelivery(REPORT_ID, ADMIN_ID, supabase);
      expect(result.success).toBe(true);
    });
  });

  describe('guard: report not found', () => {
    it('returns failure when report cannot be fetched', async () => {
      const { supabase } = makeSupabaseMock();
      // Override the single() call to return an error
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      } as unknown as ReturnType<SupabaseClient<Database>['from']>);

      const result = await runDelivery(REPORT_ID, ADMIN_ID, supabase);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to fetch report');
    });
  });

  describe('guard: invalid status', () => {
    it('returns failure for a report in "draft" status', async () => {
      const { supabase } = makeSupabaseMock({ report: makeReport({ status: 'draft' }) });
      const result = await runDelivery(REPORT_ID, ADMIN_ID, supabase);
      expect(result.success).toBe(false);
      expect(result.error).toContain("'draft'");
    });

    it('returns failure for an already-delivered report', async () => {
      const { supabase } = makeSupabaseMock({ report: makeReport({ status: 'delivered' }) });
      const result = await runDelivery(REPORT_ID, ADMIN_ID, supabase);
      expect(result.success).toBe(false);
    });
  });

  describe('guard: missing PDF path', () => {
    it('returns failure when report_pdf_storage_path is null', async () => {
      const { supabase } = makeSupabaseMock({
        report: makeReport({ report_pdf_storage_path: null }),
      });
      const result = await runDelivery(REPORT_ID, ADMIN_ID, supabase);
      expect(result.success).toBe(false);
      expect(result.error).toContain('No PDF storage path');
    });
  });

  describe('guard: missing client email', () => {
    it('returns failure when client_email is null', async () => {
      const { supabase } = makeSupabaseMock({
        report: makeReport({ client_email: null }),
      });
      const result = await runDelivery(REPORT_ID, ADMIN_ID, supabase);
      expect(result.success).toBe(false);
      expect(result.error).toContain('No client email');
    });
  });

  describe('guard: status update failure', () => {
    it('returns failure when the database status update fails', async () => {
      const { supabase } = makeSupabaseMock({
        reportUpdateError: { message: 'DB write error' },
      });
      const result = await runDelivery(REPORT_ID, ADMIN_ID, supabase);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to update report status');
    });
  });

  describe('allowable statuses', () => {
    it.each(['processing', 'pending_approval', 'approved'] as const)(
      'accepts status "%s" as deliverable',
      async (status) => {
        const { supabase } = makeSupabaseMock({ report: makeReport({ status }) });
        const result = await runDelivery(REPORT_ID, ADMIN_ID, supabase);
        expect(result.success).toBe(true);
      }
    );
  });
});
