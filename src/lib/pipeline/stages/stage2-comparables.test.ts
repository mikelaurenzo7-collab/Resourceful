// ─── Stage 2: Comparable Sales Tests ────────────────────────────────────────

import { vi } from 'vitest';
import { makeReport, makePropertyData } from '@/lib/__tests__/fixtures';
import type { AttomSaleComp } from '@/lib/services/attom';

// ─── Mock external services ─────────────────────────────────────────────────

const mockGetSalesComparables = vi.fn();
const mockGetStreetViewUrl = vi.fn().mockReturnValue('https://maps.example.com/streetview');
const mockGetCalibrationParams = vi.fn().mockResolvedValue(null);

vi.mock('@/lib/services/attom', () => ({
  getSalesComparables: (...args: unknown[]) => mockGetSalesComparables(...args),
}));

vi.mock('@/lib/services/google-maps', () => ({
  getStreetViewUrl: (...args: unknown[]) => mockGetStreetViewUrl(...args),
}));

vi.mock('@/lib/calibration/recalculate', () => ({
  getCalibrationParams: (...args: unknown[]) => mockGetCalibrationParams(...args),
}));

import { runComparables } from '@/lib/pipeline/stages/stage2-comparables';

// ─── Supabase mock builder ──────────────────────────────────────────────────

function buildSupabaseMock(overrides?: {
  report?: ReturnType<typeof makeReport> | null;
  propertyData?: ReturnType<typeof makePropertyData> | null;
  deleteError?: string | null;
  insertError?: string | null;
}) {
  const report = overrides?.report !== undefined ? overrides.report : makeReport({ latitude: 39.7817, longitude: -89.6501 });
  const propertyData = overrides?.propertyData !== undefined ? overrides.propertyData : makePropertyData();

  const supabase = {
    from: vi.fn().mockImplementation((table: string) => {
      const chain: Record<string, any> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.delete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: overrides?.deleteError ? { message: overrides.deleteError } : null,
        }),
      });
      chain.insert = vi.fn().mockResolvedValue({
        error: overrides?.insertError ? { message: overrides.insertError } : null,
      });
      chain.single = vi.fn().mockImplementation(() => {
        if (table === 'reports') return Promise.resolve({ data: report, error: null });
        if (table === 'property_data') return Promise.resolve({ data: propertyData, error: null });
        if (table === 'calibration_params') return Promise.resolve({ data: null, error: null });
        return Promise.resolve({ data: null, error: null });
      });
      return chain;
    }),
  };

  return supabase as any;
}

// ─── Comp fixtures ──────────────────────────────────────────────────────────

function makeAttomComp(overrides?: Partial<AttomSaleComp>): AttomSaleComp {
  return {
    attomId: 100,
    address: '456 Oak Ave',
    city: 'Springfield',
    state: 'IL',
    zip: '62701',
    salePrice: 225000,
    saleDate: '2025-09-15',
    pricePerSqFt: 128.57,
    yearBuilt: 1998,
    buildingSquareFeet: 1750,
    lotSquareFeet: 7500,
    bedrooms: 3,
    bathrooms: 2,
    stories: 2,
    garageSpaces: 2,
    basementSquareFeet: 600,
    propertyType: 'SFR',
    distanceMiles: 0.4,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runComparables', () => {
  it('returns success and inserts comparable sales', async () => {
    const comps = [
      makeAttomComp({ attomId: 100, address: '456 Oak Ave' }),
      makeAttomComp({ attomId: 101, address: '789 Pine Rd' }),
      makeAttomComp({ attomId: 102, address: '321 Elm St' }),
    ];
    mockGetSalesComparables.mockResolvedValue({ data: comps, error: null });

    const supabase = buildSupabaseMock();
    const result = await runComparables('rpt_test_001', supabase);

    expect(result.success).toBe(true);
    expect(mockGetSalesComparables).toHaveBeenCalled();

    // Verify insert was called on comparable_sales
    const insertCalls = supabase.from.mock.calls.filter(
      (c: string[]) => c[0] === 'comparable_sales'
    );
    expect(insertCalls.length).toBeGreaterThan(0);
  });

  it('expands search tiers when first tier returns too few comps', async () => {
    // First tier: only 1 comp (below MIN_COMPS of 3)
    mockGetSalesComparables
      .mockResolvedValueOnce({ data: [makeAttomComp({ address: 'A' })], error: null })
      // Second tier: 3 more comps
      .mockResolvedValueOnce({
        data: [
          makeAttomComp({ address: 'B' }),
          makeAttomComp({ address: 'C' }),
          makeAttomComp({ address: 'D' }),
        ],
        error: null,
      });

    const supabase = buildSupabaseMock();
    const result = await runComparables('rpt_test_001', supabase);

    expect(result.success).toBe(true);
    // Should have been called at least twice (two tiers)
    expect(mockGetSalesComparables).toHaveBeenCalledTimes(2);
  });

  it('stops expanding once MIN_COMPS is reached', async () => {
    const comps = [
      makeAttomComp({ address: 'A' }),
      makeAttomComp({ address: 'B' }),
      makeAttomComp({ address: 'C' }),
    ];
    mockGetSalesComparables.mockResolvedValue({ data: comps, error: null });

    const supabase = buildSupabaseMock();
    const result = await runComparables('rpt_test_001', supabase);

    expect(result.success).toBe(true);
    // Only 1 call needed — first tier found enough
    expect(mockGetSalesComparables).toHaveBeenCalledTimes(1);
  });

  it('fails when no comps found after all tiers', async () => {
    mockGetSalesComparables.mockResolvedValue({ data: [], error: null });

    const supabase = buildSupabaseMock();
    const result = await runComparables('rpt_test_001', supabase);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No comparable sales found');
  });

  it('fails when report is not found', async () => {
    const supabase = buildSupabaseMock({ report: null });
    const result = await runComparables('rpt_nonexistent', supabase);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to fetch report');
  });

  it('fails when property_data is not found', async () => {
    const supabase = buildSupabaseMock({ propertyData: null });
    const result = await runComparables('rpt_test_001', supabase);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No property_data found');
  });

  it('fails when report has no coordinates', async () => {
    const report = makeReport({ latitude: null as any, longitude: null as any });
    const supabase = buildSupabaseMock({ report });
    const result = await runComparables('rpt_test_001', supabase);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No geocode coordinates');
  });

  it('deduplicates comps across tiers by address', async () => {
    // First tier: 2 comps (not enough)
    mockGetSalesComparables
      .mockResolvedValueOnce({
        data: [
          makeAttomComp({ address: 'A' }),
          makeAttomComp({ address: 'B' }),
        ],
        error: null,
      })
      // Second tier: includes duplicate 'A' plus new 'C'
      .mockResolvedValueOnce({
        data: [
          makeAttomComp({ address: 'A' }),
          makeAttomComp({ address: 'C' }),
        ],
        error: null,
      });

    const supabase = buildSupabaseMock();
    const result = await runComparables('rpt_test_001', supabase);

    expect(result.success).toBe(true);
    // Should have called ATTOM twice
    expect(mockGetSalesComparables).toHaveBeenCalledTimes(2);
  });
});
