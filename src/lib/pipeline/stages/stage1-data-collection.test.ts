// ─── Stage 1: Data Collection Tests ─────────────────────────────────────────

import { vi } from 'vitest';
import { makeReport, makeCountyRule } from '@/lib/__tests__/fixtures';

// ─── Mock external services ─────────────────────────────────────────────────

const mockGeocodeAddress = vi.fn();
const mockGetPropertyDetail = vi.fn();

vi.mock('@/lib/services/google-maps', () => ({
  geocodeAddress: (...args: unknown[]) => mockGeocodeAddress(...args),
}));

vi.mock('@/lib/services/attom', () => ({
  getPropertyDetail: (...args: unknown[]) => mockGetPropertyDetail(...args),
}));

// Mock FEMA fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { runDataCollection } from '@/lib/pipeline/stages/stage1-data-collection';

// ─── Supabase mock builder ──────────────────────────────────────────────────

function buildSupabaseMock(overrides: {
  report?: ReturnType<typeof makeReport> | null;
  countyRule?: ReturnType<typeof makeCountyRule> | null;
  existingPropertyData?: { id: string } | null;
  insertError?: string | null;
  updateError?: string | null;
}) {
  const report = overrides.report !== undefined ? overrides.report : makeReport();
  const countyRule = overrides.countyRule !== undefined ? overrides.countyRule : makeCountyRule();
  const existingPd = overrides.existingPropertyData ?? null;

  // Track what table is being queried to return the right data
  const supabase = {
    from: vi.fn().mockImplementation((table: string) => {
      const chain: Record<string, any> = {};

      chain.select = vi.fn().mockReturnValue(chain);
      chain.insert = vi.fn().mockResolvedValue({
        data: null,
        error: overrides.insertError ? { message: overrides.insertError } : null,
      });
      chain.update = vi.fn().mockImplementation(() => {
        // update().eq() returns a promise-like
        return {
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: overrides.updateError ? { message: overrides.updateError } : null,
          }),
        };
      });
      chain.delete = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.ilike = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockReturnValue(chain);
      chain.single = vi.fn().mockImplementation(() => {
        if (table === 'reports') {
          return Promise.resolve({ data: report, error: null });
        }
        if (table === 'county_rules') {
          return Promise.resolve({ data: countyRule, error: null });
        }
        if (table === 'property_data') {
          return Promise.resolve({ data: existingPd, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      return chain;
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test.pdf' }, error: null }),
      }),
    },
  };

  return supabase as any;
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const geocodeData = {
  formattedAddress: '123 Main St, Springfield, IL 62701',
  latitude: 39.7817,
  longitude: -89.6501,
  placeId: 'ChIJ_test',
  county: 'Sangamon',
  countyFips: null,
  streetNumber: '123',
  route: 'Main St',
  city: 'Springfield',
  state: 'IL',
  zip: '62701',
};

const attomData = {
  attomId: 12345,
  address: { line1: '123 Main St', line2: '', locality: 'Springfield', countrySubd: 'IL', postal1: '62701', postal2: '' },
  location: { latitude: 39.7817, longitude: -89.6501, countyFips: '17167', countyName: 'Sangamon' },
  summary: { propertyType: 'SFR', propertyClass: 'R1', propertyClassDescription: 'Single Family', yearBuilt: 1995, buildingSquareFeet: 1800, livingSquareFeet: 1600, lotSquareFeet: 8000, bedrooms: 3, bathrooms: 2, stories: 2 },
  assessment: { assessedValue: 83250, marketValue: 250000, landValue: 20000, improvementValue: 63250, assessmentYear: 2025, taxAmount: 5200 },
  building: { garageType: 'Attached', garageSpaces: 2, basementType: 'Full', basementSquareFeet: 800, exteriorMaterial: 'Vinyl', roofMaterial: 'Asphalt', heatingType: 'Forced Air', coolingType: 'Central', fireplaceCount: 1, pool: false },
  lot: { lotSquareFeet: 8000, zoning: 'R-1', legalDescription: 'Lot 5 Block 3' },
};

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // FEMA returns a non-flood zone by default
  mockFetch.mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({
      features: [{ attributes: { FLD_ZONE: 'X', FIRM_PAN: '17167C0001' } }],
    }),
  });
});

describe('runDataCollection', () => {
  it('returns success when geocode and ATTOM succeed', async () => {
    mockGeocodeAddress.mockResolvedValue({ data: geocodeData, error: null });
    mockGetPropertyDetail.mockResolvedValue({ data: attomData, error: null });

    const supabase = buildSupabaseMock({});
    const result = await runDataCollection('rpt_test_001', supabase);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockGeocodeAddress).toHaveBeenCalledOnce();
    expect(mockGetPropertyDetail).toHaveBeenCalledOnce();
  });

  it('inserts property_data when none exists', async () => {
    mockGeocodeAddress.mockResolvedValue({ data: geocodeData, error: null });
    mockGetPropertyDetail.mockResolvedValue({ data: attomData, error: null });

    const supabase = buildSupabaseMock({ existingPropertyData: null });
    const result = await runDataCollection('rpt_test_001', supabase);

    expect(result.success).toBe(true);
    // Verify insert was called on property_data table
    const propertyDataCalls = supabase.from.mock.calls.filter(
      (c: string[]) => c[0] === 'property_data'
    );
    expect(propertyDataCalls.length).toBeGreaterThan(0);
  });

  it('fails when ATTOM returns error and no tax bill', async () => {
    mockGeocodeAddress.mockResolvedValue({ data: geocodeData, error: null });
    mockGetPropertyDetail.mockResolvedValue({ data: null, error: 'ATTOM API returned 500' });

    const supabase = buildSupabaseMock({});
    const result = await runDataCollection('rpt_test_001', supabase);

    expect(result.success).toBe(false);
    expect(result.error).toContain('ATTOM property lookup failed');
  });

  it('fails when geocode returns error', async () => {
    mockGeocodeAddress.mockResolvedValue({ data: null, error: 'Geocoding failed' });
    mockGetPropertyDetail.mockResolvedValue({ data: attomData, error: null });

    const supabase = buildSupabaseMock({});
    const result = await runDataCollection('rpt_test_001', supabase);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Geocoding failed');
  });

  it('continues with partial data when ATTOM fails but tax bill exists', async () => {
    mockGeocodeAddress.mockResolvedValue({ data: geocodeData, error: null });
    mockGetPropertyDetail.mockResolvedValue({ data: null, error: 'ATTOM timeout' });

    const report = makeReport({
      has_tax_bill: true,
      tax_bill_assessed_value: 80000,
      tax_bill_tax_amount: 4500,
      tax_bill_tax_year: '2025',
    });

    const supabase = buildSupabaseMock({ report });
    const result = await runDataCollection('rpt_test_001', supabase);

    expect(result.success).toBe(true);
  });

  it('fails when report is not found', async () => {
    mockGeocodeAddress.mockResolvedValue({ data: geocodeData, error: null });
    mockGetPropertyDetail.mockResolvedValue({ data: attomData, error: null });

    const supabase = buildSupabaseMock({ report: null });
    const result = await runDataCollection('rpt_nonexistent', supabase);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to fetch report');
  });
});
