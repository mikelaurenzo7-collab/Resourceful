// ─── County Rules Repository Tests ───────────────────────────────────────────

import { vi } from 'vitest';
import { mockSupabase, mockSupabaseReturns, type MockSupabaseChain } from '@/lib/__tests__/mocks';
import { makeCountyRule } from '@/lib/__tests__/fixtures';

// ─── Mock Supabase Admin ─────────────────────────────────────────────────────

let supabaseMock: MockSupabaseChain;

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => supabaseMock,
}));

// Import AFTER mock
import {
  getCountyByFips,
  getCountyByName,
  getActiveCounties,
  upsertCountyRule,
} from '@/lib/repository/county-rules';

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  supabaseMock = mockSupabase();
  // Add ilike and upsert to the chainable mock since county-rules uses them
  (supabaseMock as any).ilike = vi.fn().mockReturnValue(supabaseMock);
  (supabaseMock as any).upsert = vi.fn().mockReturnValue(supabaseMock);
});

// ─── getCountyByFips ─────────────────────────────────────────────────────────

describe('getCountyByFips', () => {
  it('returns county rule when found', async () => {
    const county = makeCountyRule();
    mockSupabaseReturns(supabaseMock, county);

    const result = await getCountyByFips('17167');

    expect(supabaseMock.from).toHaveBeenCalledWith('county_rules');
    expect(supabaseMock.select).toHaveBeenCalledWith('*');
    expect(supabaseMock.eq).toHaveBeenCalledWith('county_fips', '17167');
    expect(supabaseMock.single).toHaveBeenCalled();
    expect(result).toEqual(county);
    expect(result!.county_name).toBe('Sangamon');
  });

  it('returns null when FIPS not found (PGRST116)', async () => {
    mockSupabaseReturns(supabaseMock, null, { code: 'PGRST116', message: 'not found' });

    const result = await getCountyByFips('99999');

    expect(result).toBeNull();
  });

  it('throws on other database errors', async () => {
    mockSupabaseReturns(supabaseMock, null, { code: '42P01', message: 'relation missing' });

    await expect(getCountyByFips('17167')).rejects.toThrow('Failed to fetch county by FIPS');
  });
});

// ─── getCountyByName ─────────────────────────────────────────────────────────

describe('getCountyByName', () => {
  it('returns county rule when found by name and state', async () => {
    const county = makeCountyRule();
    mockSupabaseReturns(supabaseMock, county);

    const result = await getCountyByName('Sangamon', 'IL');

    expect(supabaseMock.from).toHaveBeenCalledWith('county_rules');
    expect(supabaseMock.select).toHaveBeenCalledWith('*');
    expect((supabaseMock as any).ilike).toHaveBeenCalledWith('county_name', 'Sangamon');
    expect(supabaseMock.eq).toHaveBeenCalledWith('state_abbreviation', 'IL');
    expect(result).toEqual(county);
  });

  it('uppercases state abbreviation', async () => {
    mockSupabaseReturns(supabaseMock, makeCountyRule());

    await getCountyByName('Cook', 'il');

    expect(supabaseMock.eq).toHaveBeenCalledWith('state_abbreviation', 'IL');
  });

  it('returns null when county not found (PGRST116)', async () => {
    mockSupabaseReturns(supabaseMock, null, { code: 'PGRST116', message: 'not found' });

    const result = await getCountyByName('Nonexistent', 'ZZ');

    expect(result).toBeNull();
  });

  it('throws on database error', async () => {
    mockSupabaseReturns(supabaseMock, null, { code: '500', message: 'db error' });

    await expect(getCountyByName('Cook', 'IL')).rejects.toThrow('Failed to fetch county by name');
  });
});

// ─── getActiveCounties ───────────────────────────────────────────────────────

describe('getActiveCounties', () => {
  it('returns all active counties ordered by state and name', async () => {
    const counties = [
      makeCountyRule({ county_fips: '17031', county_name: 'Cook', state_abbreviation: 'IL' }),
      makeCountyRule({ county_fips: '17167', county_name: 'Sangamon', state_abbreviation: 'IL' }),
    ];
    // getActiveCounties chains: select -> eq -> order -> order
    // The second .order() call is the terminal one that resolves
    supabaseMock.order.mockReturnValueOnce(supabaseMock); // first order returns chain
    supabaseMock.order.mockResolvedValueOnce({ data: counties, error: null }); // second resolves

    const result = await getActiveCounties();

    expect(supabaseMock.from).toHaveBeenCalledWith('county_rules');
    expect(supabaseMock.eq).toHaveBeenCalledWith('is_active', true);
    expect(supabaseMock.order).toHaveBeenCalledWith('state_abbreviation', { ascending: true });
    expect(supabaseMock.order).toHaveBeenCalledWith('county_name', { ascending: true });
    expect(result).toEqual(counties);
    expect(result).toHaveLength(2);
  });

  it('returns empty array when no active counties', async () => {
    supabaseMock.order.mockReturnValueOnce(supabaseMock);
    supabaseMock.order.mockResolvedValueOnce({ data: null, error: null });

    const result = await getActiveCounties();

    expect(result).toEqual([]);
  });

  it('throws on database error', async () => {
    supabaseMock.order.mockReturnValueOnce(supabaseMock);
    supabaseMock.order.mockResolvedValueOnce({
      data: null,
      error: { message: 'timeout' },
    });

    await expect(getActiveCounties()).rejects.toThrow('Failed to fetch active counties');
  });
});

// ─── upsertCountyRule ────────────────────────────────────────────────────────

describe('upsertCountyRule', () => {
  it('upserts with onConflict county_fips and returns rule', async () => {
    const county = makeCountyRule();
    mockSupabaseReturns(supabaseMock, county);

    const result = await upsertCountyRule({
      county_fips: '17167',
      county_name: 'Sangamon',
      state_name: 'Illinois',
      state_abbreviation: 'IL',
    } as any);

    expect(supabaseMock.from).toHaveBeenCalledWith('county_rules');
    expect((supabaseMock as any).upsert).toHaveBeenCalledWith(
      expect.objectContaining({ county_fips: '17167' }),
      { onConflict: 'county_fips' }
    );
    expect(supabaseMock.select).toHaveBeenCalled();
    expect(supabaseMock.single).toHaveBeenCalled();
    expect(result).toEqual(county);
  });

  it('throws on database error', async () => {
    mockSupabaseReturns(supabaseMock, null, { message: 'constraint violation' });

    await expect(
      upsertCountyRule({ county_fips: '00000' } as any)
    ).rejects.toThrow('Failed to upsert county rule');
  });
});
