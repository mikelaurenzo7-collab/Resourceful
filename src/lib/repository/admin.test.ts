// ─── Admin Repository Tests ──────────────────────────────────────────────────

import { vi } from 'vitest';
import { mockSupabase, mockSupabaseReturns, type MockSupabaseChain } from '@/lib/__tests__/mocks';

// ─── Mock Supabase Admin ─────────────────────────────────────────────────────

let supabaseMock: MockSupabaseChain;

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => supabaseMock,
}));

// Import AFTER mock
import {
  isAdmin,
  getAdminUser,
  getApprovalEvents,
  createApprovalEvent,
} from '@/lib/repository/admin';

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  supabaseMock = mockSupabase();
});

// ─── getAdminUser ────────────────────────────────────────────────────────────

describe('getAdminUser', () => {
  it('returns admin user when found', async () => {
    const adminUser = { user_id: 'admin_001', role: 'admin', created_at: '2026-01-01' };
    mockSupabaseReturns(supabaseMock, adminUser);

    const result = await getAdminUser('admin_001');

    expect(supabaseMock.from).toHaveBeenCalledWith('admin_users');
    expect(supabaseMock.select).toHaveBeenCalledWith('*');
    expect(supabaseMock.eq).toHaveBeenCalledWith('user_id', 'admin_001');
    expect(supabaseMock.single).toHaveBeenCalled();
    expect(result).toEqual(adminUser);
  });

  it('returns null when user is not an admin (PGRST116)', async () => {
    mockSupabaseReturns(supabaseMock, null, { code: 'PGRST116', message: 'not found' });

    const result = await getAdminUser('regular_user');

    expect(result).toBeNull();
  });

  it('throws on other database errors', async () => {
    mockSupabaseReturns(supabaseMock, null, { code: '42P01', message: 'table missing' });

    await expect(getAdminUser('admin_001')).rejects.toThrow('Failed to fetch admin user');
  });
});

// ─── isAdmin ─────────────────────────────────────────────────────────────────

describe('isAdmin', () => {
  it('returns true when user is in admin_users table', async () => {
    const adminUser = { user_id: 'admin_001', role: 'admin', created_at: '2026-01-01' };
    mockSupabaseReturns(supabaseMock, adminUser);

    const result = await isAdmin('admin_001');

    expect(result).toBe(true);
  });

  it('returns false when user is not in admin_users table', async () => {
    mockSupabaseReturns(supabaseMock, null, { code: 'PGRST116', message: 'not found' });

    const result = await isAdmin('regular_user_123');

    expect(result).toBe(false);
  });

  it('throws on unexpected database error (does not silently return false)', async () => {
    mockSupabaseReturns(supabaseMock, null, { code: '500', message: 'internal error' });

    await expect(isAdmin('any_user')).rejects.toThrow('Failed to fetch admin user');
  });
});

// ─── getApprovalEvents ───────────────────────────────────────────────────────

describe('getApprovalEvents', () => {
  it('returns approval events for a report', async () => {
    const events = [
      { id: 'ae_001', report_id: 'rpt_001', action: 'approved', created_at: '2026-01-15' },
      { id: 'ae_002', report_id: 'rpt_001', action: 'rejected', created_at: '2026-01-14' },
    ];
    // getApprovalEvents does not use .single(), it uses .order() which returns chain
    // then the chain resolves. We need order to resolve with data.
    supabaseMock.order.mockResolvedValue({ data: events, error: null });

    const result = await getApprovalEvents('rpt_001');

    expect(supabaseMock.from).toHaveBeenCalledWith('approval_events');
    expect(supabaseMock.eq).toHaveBeenCalledWith('report_id', 'rpt_001');
    expect(supabaseMock.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result).toEqual(events);
  });

  it('returns empty array when no events exist', async () => {
    supabaseMock.order.mockResolvedValue({ data: null, error: null });

    const result = await getApprovalEvents('rpt_no_events');

    expect(result).toEqual([]);
  });

  it('throws on database error', async () => {
    supabaseMock.order.mockResolvedValue({
      data: null,
      error: { message: 'query failed' },
    });

    await expect(getApprovalEvents('rpt_001')).rejects.toThrow('Failed to fetch approval events');
  });
});

// ─── createApprovalEvent ─────────────────────────────────────────────────────

describe('createApprovalEvent', () => {
  it('inserts and returns the approval event', async () => {
    const event = {
      id: 'ae_new_001',
      report_id: 'rpt_001',
      admin_user_id: 'admin_001',
      action: 'approved',
      notes: 'Looks good',
      created_at: '2026-01-15',
    };
    mockSupabaseReturns(supabaseMock, event);

    const result = await createApprovalEvent({
      report_id: 'rpt_001',
      admin_user_id: 'admin_001',
      action: 'approved',
      notes: 'Looks good',
    } as any);

    expect(supabaseMock.from).toHaveBeenCalledWith('approval_events');
    expect(supabaseMock.insert).toHaveBeenCalled();
    expect(supabaseMock.select).toHaveBeenCalled();
    expect(supabaseMock.single).toHaveBeenCalled();
    expect(result).toEqual(event);
  });

  it('throws on database error', async () => {
    mockSupabaseReturns(supabaseMock, null, { message: 'insert failed' });

    await expect(
      createApprovalEvent({ report_id: 'rpt_001' } as any)
    ).rejects.toThrow('Failed to create approval event');
  });
});
