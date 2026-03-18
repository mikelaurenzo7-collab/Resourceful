// ─── ATTOM Data API Service Tests ───────────────────────────────────────────

import { vi } from 'vitest';

// ─── Mock fetch ─────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { getPropertyDetail, getSalesComparables } from '@/lib/services/attom';

// ─── Helpers ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

function makeFetchResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Not Found',
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  };
}

// ─── Raw ATTOM response fixture ─────────────────────────────────────────────

const rawPropertyResponse = {
  property: [
    {
      identifier: { attomId: 12345 },
      address: {
        line1: '123 Main St',
        line2: 'Springfield, IL 62701',
        locality: 'Springfield',
        countrySubd: 'IL',
        postal1: '62701',
        postal2: '',
      },
      location: {
        latitude: '39.7817',
        longitude: '-89.6501',
        countyFips: '17167',
        countyName: 'Sangamon',
      },
      summary: {
        propertyType: 'SFR',
        propertyClass: 'R1',
        propertyClassDescription: 'Single Family Residence',
        yearBuilt: 1995,
        buildingSqFt: 1800,
        livingSquareFeet: 1600,
        lotSqFt: 8000,
        bedrooms: 3,
        bathrooms: 2,
        stories: 2,
      },
      assessment: {
        assessed: {
          assdTtlValue: 83250,
          assdLandValue: 20000,
          assdImprValue: 63250,
        },
        market: {
          mktTtlValue: 250000,
          mktLandValue: 60000,
          mktImprValue: 190000,
        },
        tax: {
          taxYear: 2025,
          taxAmt: 5200,
        },
      },
      building: {
        parking: { garageType: 'Attached', prkgSpaces: 2 },
        interior: { bsmtType: 'Full', bsmtSqFt: 800, fplcCount: 1 },
        construction: { wallType: 'Vinyl Siding', roofCover: 'Asphalt Shingle' },
        utility: { heatingType: 'Forced Air', coolingType: 'Central' },
        summary: { pool: false },
      },
      lot: {
        lotSize1: 8000,
        zoningType: 'R-1',
        legalDesc: 'Lot 5 Block 3',
      },
    },
  ],
};

// ─── getPropertyDetail ──────────────────────────────────────────────────────

describe('getPropertyDetail', () => {
  it('transforms ATTOM response correctly', async () => {
    mockFetch.mockResolvedValue(makeFetchResponse(rawPropertyResponse));

    const result = await getPropertyDetail('123 Main St, Springfield, IL 62701');

    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();

    const detail = result.data!;
    expect(detail.attomId).toBe(12345);
    expect(detail.address.line1).toBe('123 Main St');
    expect(detail.address.locality).toBe('Springfield');
    expect(detail.location.latitude).toBe(39.7817);
    expect(detail.location.longitude).toBe(-89.6501);
    expect(detail.location.countyFips).toBe('17167');
    expect(detail.summary.yearBuilt).toBe(1995);
    expect(detail.summary.buildingSquareFeet).toBe(1800);
    expect(detail.summary.bedrooms).toBe(3);
    expect(detail.assessment.assessedValue).toBe(83250);
    expect(detail.assessment.taxAmount).toBe(5200);
    expect(detail.building.garageSpaces).toBe(2);
    expect(detail.building.basementSquareFeet).toBe(800);
    expect(detail.lot.zoning).toBe('R-1');
  });

  it('returns error on non-200 status', async () => {
    mockFetch.mockResolvedValue(makeFetchResponse({}, 404));

    const result = await getPropertyDetail('999 Fake St');

    expect(result.data).toBeNull();
    expect(result.error).toContain('ATTOM API returned 404');
  });

  it('returns error when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('DNS resolution failed'));

    const result = await getPropertyDetail('123 Main St');

    expect(result.data).toBeNull();
    expect(result.error).toContain('ATTOM API request failed');
    expect(result.error).toContain('DNS resolution failed');
  });

  it('handles missing/null fields gracefully', async () => {
    const sparse = {
      property: [
        {
          identifier: {},
          address: {},
          location: {},
          summary: {},
          assessment: {},
          building: {},
          lot: {},
        },
      ],
    };
    mockFetch.mockResolvedValue(makeFetchResponse(sparse));

    const result = await getPropertyDetail('empty property');

    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();

    const detail = result.data!;
    expect(detail.attomId).toBe(0);
    expect(detail.address.line1).toBe('');
    expect(detail.location.latitude).toBe(0);
    expect(detail.summary.yearBuilt).toBe(0);
    expect(detail.summary.buildingSquareFeet).toBe(0);
    expect(detail.assessment.assessedValue).toBe(0);
    expect(detail.building.garageType).toBeNull();
    expect(detail.lot.zoning).toBeNull();
  });
});

// ─── getSalesComparables ────────────────────────────────────────────────────

describe('getSalesComparables', () => {
  it('normalizes sale comps from ATTOM response', async () => {
    const rawComps = {
      property: [
        {
          identifier: { attomId: 100 },
          address: { line1: '456 Oak Ave', locality: 'Springfield', countrySubd: 'IL', postal1: '62701' },
          sale: { amount: { saleAmt: 225000, saleRecDate: '2025-09-15' }, calculation: { pricePerSqFt: 128.57 } },
          summary: { yearBuilt: 1998, buildingSqFt: 1750, lotSqFt: 7500, bedrooms: 3, bathrooms: 2, stories: 2, propertyType: 'SFR' },
          building: { parking: { prkgSpaces: 2 }, interior: { bsmtSqFt: 600 } },
          location: { distance: 0.4 },
        },
      ],
    };
    mockFetch.mockResolvedValue(makeFetchResponse(rawComps));

    const result = await getSalesComparables({
      latitude: 39.78,
      longitude: -89.65,
      propertyType: 'RESIDENTIAL',
      minSqft: 1350,
      maxSqft: 2250,
      radiusMiles: 1,
      monthsBack: 18,
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data![0].salePrice).toBe(225000);
    expect(result.data![0].address).toBe('456 Oak Ave');
    expect(result.data![0].distanceMiles).toBe(0.4);
  });

  it('returns error on non-200 status', async () => {
    mockFetch.mockResolvedValue(makeFetchResponse({}, 500));

    const result = await getSalesComparables({
      latitude: 39.78,
      longitude: -89.65,
      propertyType: 'RESIDENTIAL',
      minSqft: 1000,
      maxSqft: 2000,
      radiusMiles: 1,
      monthsBack: 18,
    });

    expect(result.data).toBeNull();
    expect(result.error).toContain('ATTOM API returned 500');
  });
});
