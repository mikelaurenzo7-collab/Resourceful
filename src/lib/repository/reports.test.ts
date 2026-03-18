// ─── Reports Repository Tests ────────────────────────────────────────────────

import { vi } from 'vitest';
import { mockSupabase, mockSupabaseReturns, type MockSupabaseChain } from '@/lib/__tests__/mocks';
import { makeReport } from '@/lib/__tests__/fixtures';

// ─── Mock Supabase Admin ─────────────────────────────────────────────────────

let supabaseMock: MockSupabaseChain;

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => supabaseMock,
}));

// Import AFTER mock is registered
import {
  createReport,
  getReportById,
  updateReport,
  deleteReport,
  getReportsByStatus,
} from '@/lib/repository/reports';

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  supabaseMock = mockSupabase();
});

// ─── createReport ────────────────────────────────────────────────────────────

describe('createReport', () => {
  it('calls insert, select, and single on the reports table', async () => {
    const report = makeReport();
    mockSupabaseReturns(supabaseMock, report);

    const result = await createReport({
      user_id: report.user_id,
      client_email: report.client_email,
      client_name: report.client_name,
      property_address: report.property_address,
      city: report.city,
      state: report.state,
      state_abbreviation: report.state_abbreviation,
      county: report.county,
      county_fips: report.county_fips,
      service_type: report.service_type,
      property_type: report.property_type,
    } as any);

    expect(supabaseMock.from).toHaveBeenCalledWith('reports');
    expect(supabaseMock.insert).toHaveBeenCalled();
    expect(supabaseMock.select).toHaveBeenCalled();
    expect(supabaseMock.single).toHaveBeenCalled();
    expect(result.id).toBe(report.id);
  });

  it('returns the created report', async () => {
    const report = makeReport({ id: 'rpt_new_001', status: 'intake' });
    mockSupabaseReturns(supabaseMock, report);

    const result = await createReport({
      user_id: 'user@test.com',
      client_email: 'user@test.com',
      client_name: 'New User',
      property_address: '789 Elm St',
    } as any);

    expect(result).toEqual(report);
  });

  it('throws on database error', async () => {
    mockSupabaseReturns(supabaseMock, null, { message: 'duplicate key', code: '23505' });

    await expect(
      createReport({ user_id: 'test' } as any)
    ).rejects.toThrow('Failed to create report');
  });
});

// ─── getReportById ───────────────────────────────────────────────────────────

describe('getReportById', () => {
  it('returns a report when found', async () => {
    const report = makeReport();
    mockSupabaseReturns(supabaseMock, report);

    const result = await getReportById('rpt_test_001');

    expect(supabaseMock.from).toHaveBeenCalledWith('reports');
    expect(supabaseMock.select).toHaveBeenCalledWith('*');
    expect(supabaseMock.eq).toHaveBeenCalledWith('id', 'rpt_test_001');
    expect(supabaseMock.single).toHaveBeenCalled();
    expect(result).toEqual(report);
  });

  it('returns null on PGRST116 (not found)', async () => {
    mockSupabaseReturns(supabaseMock, null, { code: 'PGRST116', message: 'not found' });

    const result = await getReportById('rpt_nonexistent');

    expect(result).toBeNull();
  });

  it('throws on other database errors', async () => {
    mockSupabaseReturns(supabaseMock, null, { code: '42P01', message: 'relation does not exist' });

    await expect(getReportById('rpt_test_001')).rejects.toThrow('Failed to fetch report');
  });
});

// ─── updateReport ────────────────────────────────────────────────────────────

describe('updateReport', () => {
  it('calls update, eq, select, and single', async () => {
    const updatedReport = makeReport({ status: 'pending_approval' });
    mockSupabaseReturns(supabaseMock, updatedReport);

    const result = await updateReport('rpt_test_001', { status: 'pending_approval' } as any);

    expect(supabaseMock.from).toHaveBeenCalledWith('reports');
    expect(supabaseMock.update).toHaveBeenCalledWith({ status: 'pending_approval' });
    expect(supabaseMock.eq).toHaveBeenCalledWith('id', 'rpt_test_001');
    expect(supabaseMock.select).toHaveBeenCalled();
    expect(supabaseMock.single).toHaveBeenCalled();
    expect(result.status).toBe('pending_approval');
  });

  it('returns the updated report', async () => {
    const report = makeReport({ admin_notes: 'Reviewed and updated' });
    mockSupabaseReturns(supabaseMock, report);

    const result = await updateReport('rpt_test_001', { admin_notes: 'Reviewed and updated' } as any);

    expect(result.admin_notes).toBe('Reviewed and updated');
  });

  it('throws on database error', async () => {
    mockSupabaseReturns(supabaseMock, null, { message: 'update failed' });

    await expect(
      updateReport('rpt_test_001', { status: 'approved' } as any)
    ).rejects.toThrow('Failed to update report');
  });
});

// ─── deleteReport ────────────────────────────────────────────────────────────

describe('deleteReport', () => {
  it('calls delete and eq on the reports table', async () => {
    // For delete, the chain ends at eq (no single call), so we need
    // the eq mock to resolve with no error
    supabaseMock.eq.mockResolvedValue({ error: null });

    await deleteReport('rpt_test_001');

    expect(supabaseMock.from).toHaveBeenCalledWith('reports');
    expect(supabaseMock.delete).toHaveBeenCalled();
    expect(supabaseMock.eq).toHaveBeenCalledWith('id', 'rpt_test_001');
  });

  it('throws on database error', async () => {
    supabaseMock.eq.mockResolvedValue({
      error: { message: 'foreign key constraint' },
    });

    await expect(deleteReport('rpt_test_001')).rejects.toThrow('Failed to delete report');
  });
});

// ─── getReportsByStatus ──────────────────────────────────────────────────────

describe('getReportsByStatus', () => {
  it('calls select, eq, order, and range with correct params', async () => {
    const reports = [makeReport({ status: 'pending_approval' })];
    supabaseMock.range.mockResolvedValue({ data: reports, error: null });

    const result = await getReportsByStatus('pending_approval' as any);

    expect(supabaseMock.from).toHaveBeenCalledWith('reports');
    expect(supabaseMock.select).toHaveBeenCalledWith('*');
    expect(supabaseMock.eq).toHaveBeenCalledWith('status', 'pending_approval');
    expect(supabaseMock.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(supabaseMock.range).toHaveBeenCalledWith(0, 99); // default limit=100, offset=0
    expect(result).toEqual(reports);
  });

  it('respects limit and offset options', async () => {
    supabaseMock.range.mockResolvedValue({ data: [], error: null });

    await getReportsByStatus('approved' as any, { limit: 10, offset: 20 });

    expect(supabaseMock.range).toHaveBeenCalledWith(20, 29); // offset=20, limit=10
  });

  it('returns empty array when no reports match', async () => {
    supabaseMock.range.mockResolvedValue({ data: null, error: null });

    const result = await getReportsByStatus('delivered' as any);

    expect(result).toEqual([]);
  });

  it('throws on database error', async () => {
    supabaseMock.range.mockResolvedValue({
      data: null,
      error: { message: 'connection refused' },
    });

    await expect(
      getReportsByStatus('pending_approval' as any)
    ).rejects.toThrow('Failed to fetch reports by status');
  });
});
