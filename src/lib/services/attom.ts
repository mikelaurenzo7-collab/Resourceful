// ─── ATTOM Data API Service ──────────────────────────────────────────────────
// Property data, sales comps, rental comps, and deed history from ATTOM.

// ─── Configuration ───────────────────────────────────────────────────────────

const BASE_URL =
  process.env.ATTOM_API_BASE_URL ??
  'https://api.gateway.attomdata.com/propertyapi/v1.0.0';

const API_KEY = process.env.ATTOM_API_KEY ?? '';

// ─── Response Types ──────────────────────────────────────────────────────────

export interface AttomPropertyDetail {
  attomId: number;
  address: {
    line1: string;
    line2: string;
    locality: string;
    countrySubd: string;
    postal1: string;
    postal2: string;
  };
  location: {
    latitude: number | null;
    longitude: number | null;
    countyFips: string;
    countyName: string;
  };
  summary: {
    propertyType: string;
    propertyClass: string | null;
    propertyClassDescription: string | null;
    yearBuilt: number;
    buildingSquareFeet: number;
    livingSquareFeet: number | null;
    lotSquareFeet: number;
    bedrooms: number;
    bathrooms: number;
    stories: number;
  };
  assessment: {
    assessedValue: number;
    marketValue: number;
    landValue: number;
    improvementValue: number;
    assessmentYear: number;
    taxAmount: number;
  };
  building: {
    garageType: string | null;
    garageSpaces: number | null;
    basementType: string | null;
    basementSquareFeet: number | null;
    exteriorMaterial: string | null;
    roofMaterial: string | null;
    heatingType: string | null;
    coolingType: string | null;
    fireplaceCount: number | null;
    pool: boolean;
  };
  lot: {
    lotSquareFeet: number;
    zoning: string | null;
    legalDescription: string | null;
  };
}

export interface AttomSaleComp {
  attomId: number;
  address: string;
  city: string;
  state: string;
  zip: string;
  salePrice: number;
  saleDate: string;
  pricePerSqFt: number | null;
  yearBuilt: number | null;
  buildingSquareFeet: number | null;
  lotSquareFeet: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  stories: number | null;
  garageSpaces: number | null;
  basementSquareFeet: number | null;
  propertyType: string | null;
  distanceMiles: number | null;
}

export interface AttomRentalComp {
  attomId: number;
  address: string;
  city: string;
  state: string;
  zip: string;
  monthlyRent: number;
  rentDate: string | null;
  rentPerSqFt: number | null;
  yearBuilt: number | null;
  buildingSquareFeet: number | null;
  lotSquareFeet: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  propertyType: string | null;
  distanceMiles: number | null;
}

export interface AttomDeedRecord {
  documentType: string;
  recordingDate: string;
  salePrice: number | null;
  seller: string | null;
  buyer: string | null;
  documentNumber: string | null;
  deedType: string | null;
}

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

// ─── Comparables Search Params ───────────────────────────────────────────────

export interface SalesCompParams {
  latitude: number;
  longitude: number;
  propertyType: string;
  minSqft: number;
  maxSqft: number;
  radiusMiles: number;
  monthsBack: number;
}

export interface RentalCompParams {
  latitude: number;
  longitude: number;
  propertyType: string;
  minSqft: number;
  maxSqft: number;
  radiusMiles: number;
  monthsBack: number;
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

async function attomFetch<T>(
  path: string,
  params?: Record<string, string>
): Promise<ServiceResult<T>> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 1000;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000); // 20s timeout
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          apikey: API_KEY,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      // Retry on 429 (rate limited) or 5xx (transient server errors)
      if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
        const retryAfter = response.headers.get('retry-after');
        const delayMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[attom] ${path} returned ${response.status}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        console.error(
          `[attom] ${path} responded ${response.status}: ${body.slice(0, 500)}`
        );
        return {
          data: null,
          error: `ATTOM API returned ${response.status}: ${response.statusText}`,
        };
      }

      const json = (await response.json()) as T;
      return { data: json, error: null };
    } catch (err) {
      // Retry on network errors (not abort timeouts)
      if (attempt < MAX_RETRIES && err instanceof Error && err.name !== 'AbortError') {
        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[attom] ${path} fetch error, retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES}): ${err.message}`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[attom] ${path} fetch error: ${message}`);
      return { data: null, error: `ATTOM API request failed: ${message}` };
    }
  }

  // Should never reach here, but TypeScript needs a return
  return { data: null, error: 'ATTOM API request failed after retries' };
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

function normalizePropertyDetail(raw: Record<string, unknown>): AttomPropertyDetail {
  const property = (raw as any)?.property?.[0] ?? {};
  const addr = property.address ?? {};
  const loc = property.location ?? {};
  const summary = property.summary ?? {};
  const assessment = property.assessment?.assessed ?? {};
  const market = property.assessment?.market ?? {};
  const building = property.building ?? {};
  const lot = property.lot ?? {};

  return {
    attomId: property.identifier?.attomId ?? 0,
    address: {
      line1: addr.line1 ?? '',
      line2: addr.line2 ?? '',
      locality: addr.locality ?? '',
      countrySubd: addr.countrySubd ?? '',
      postal1: addr.postal1 ?? '',
      postal2: addr.postal2 ?? '',
    },
    location: {
      latitude: parseFloat(loc.latitude) || null,
      longitude: parseFloat(loc.longitude) || null,
      countyFips: loc.countyFips ?? '',
      countyName: loc.countyName ?? '',
    },
    summary: {
      propertyType: summary.propertyType ?? '',
      propertyClass: summary.propertyClass ?? null,
      propertyClassDescription: summary.propertyClassDescription ?? null,
      yearBuilt: summary.yearBuilt ?? 0,
      buildingSquareFeet: summary.buildingSqFt ?? 0,
      livingSquareFeet: summary.livingSquareFeet ?? null,
      lotSquareFeet: summary.lotSqFt ?? 0,
      bedrooms: summary.bedrooms ?? 0,
      bathrooms: summary.bathrooms ?? 0,
      stories: summary.stories ?? 0,
    },
    assessment: {
      assessedValue: assessment.assdTtlValue ?? 0,
      marketValue: market.mktTtlValue ?? 0,
      landValue: assessment.assdLandValue ?? market.mktLandValue ?? 0,
      improvementValue: assessment.assdImprValue ?? market.mktImprValue ?? 0,
      assessmentYear: property.assessment?.tax?.taxYear ?? 0,
      taxAmount: property.assessment?.tax?.taxAmt ?? 0,
    },
    building: {
      garageType: building.parking?.garageType ?? null,
      garageSpaces: building.parking?.prkgSpaces ?? null,
      basementType: building.interior?.bsmtType ?? null,
      basementSquareFeet: building.interior?.bsmtSqFt ?? null,
      exteriorMaterial: building.construction?.wallType ?? null,
      roofMaterial: building.construction?.roofCover ?? null,
      heatingType: building.utility?.heatingType ?? null,
      coolingType: building.utility?.coolingType ?? null,
      fireplaceCount: building.interior?.fplcCount ?? null,
      pool: building.summary?.pool === true || building.summary?.pool === 'Y',
    },
    lot: {
      lotSquareFeet: lot.lotSize1 ?? summary.lotSqFt ?? 0,
      zoning: lot.zoningType ?? null,
      legalDescription: lot.legalDesc ?? null,
    },
  };
}

function normalizeSaleComps(raw: Record<string, unknown>): AttomSaleComp[] {
  const sales = (raw as any)?.property ?? [];
  return sales.map((s: any) => ({
    attomId: s.identifier?.attomId ?? 0,
    address: s.address?.line1 ?? '',
    city: s.address?.locality ?? '',
    state: s.address?.countrySubd ?? '',
    zip: s.address?.postal1 ?? '',
    salePrice: s.sale?.amount?.saleAmt ?? 0,
    saleDate: s.sale?.amount?.saleRecDate ?? '',
    pricePerSqFt: s.sale?.calculation?.pricePerSqFt ?? null,
    yearBuilt: s.summary?.yearBuilt ?? null,
    buildingSquareFeet: s.summary?.buildingSqFt ?? null,
    lotSquareFeet: s.summary?.lotSqFt ?? null,
    bedrooms: s.summary?.bedrooms ?? null,
    bathrooms: s.summary?.bathrooms ?? null,
    stories: s.summary?.stories ?? null,
    garageSpaces: s.building?.parking?.prkgSpaces ?? null,
    basementSquareFeet: s.building?.interior?.bsmtSqFt ?? null,
    propertyType: s.summary?.propertyType ?? null,
    distanceMiles: s.location?.distance ?? null,
  }));
}

function normalizeRentalComps(raw: Record<string, unknown>): AttomRentalComp[] {
  const rentals = (raw as any)?.property ?? [];
  return rentals.map((r: any) => ({
    attomId: r.identifier?.attomId ?? 0,
    address: r.address?.line1 ?? '',
    city: r.address?.locality ?? '',
    state: r.address?.countrySubd ?? '',
    zip: r.address?.postal1 ?? '',
    monthlyRent: r.rental?.rentalAmount ?? 0,
    rentDate: r.rental?.rentalDate ?? null,
    rentPerSqFt: r.rental?.rentPerSqFt ?? null,
    yearBuilt: r.summary?.yearBuilt ?? null,
    buildingSquareFeet: r.summary?.buildingSqFt ?? null,
    lotSquareFeet: r.summary?.lotSqFt ?? null,
    bedrooms: r.summary?.bedrooms ?? null,
    bathrooms: r.summary?.bathrooms ?? null,
    propertyType: r.summary?.propertyType ?? null,
    distanceMiles: r.location?.distance ?? null,
  }));
}

function normalizeDeedHistory(raw: Record<string, unknown>): AttomDeedRecord[] {
  const deeds = (raw as any)?.property?.[0]?.saleHistory ?? [];
  return deeds.map((d: any) => ({
    documentType: d.documentType ?? '',
    recordingDate: d.recordingDate ?? '',
    salePrice: d.amount?.saleAmt ?? null,
    seller: d.seller?.name ?? null,
    buyer: d.buyer?.name ?? null,
    documentNumber: d.documentNumber ?? null,
    deedType: d.deedType ?? null,
  }));
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getPropertyDetail(
  address: string
): Promise<ServiceResult<AttomPropertyDetail>> {
  const result = await attomFetch<Record<string, unknown>>(
    '/property/detail',
    { address1: address, address2: '' }
  );

  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }

  try {
    const detail = normalizePropertyDetail(result.data);

    // ── Data quality validation ──────────────────────────────────────────
    // ATTOM sometimes returns zero or missing values for critical fields.
    // Flag these so downstream stages can handle gracefully.
    const warnings: string[] = [];
    if (!detail.summary.buildingSquareFeet || detail.summary.buildingSquareFeet <= 0) {
      warnings.push('buildingSquareFeet is 0 or missing');
    }
    if (!detail.summary.yearBuilt || detail.summary.yearBuilt <= 1700) {
      warnings.push('yearBuilt is missing or implausible');
    }
    if (!detail.assessment.assessedValue || detail.assessment.assessedValue <= 0) {
      warnings.push('assessedValue is 0 or missing');
    }
    if (!detail.summary.lotSquareFeet || detail.summary.lotSquareFeet <= 0) {
      warnings.push('lotSquareFeet is 0 or missing');
    }
    if (warnings.length > 0) {
      console.warn(`[attom] Data quality warnings for "${address}": ${warnings.join('; ')}`);
    }

    return { data: detail, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[attom] Failed to normalize property detail: ${message}`);
    return { data: null, error: `Failed to parse ATTOM response: ${message}` };
  }
}

export async function getSalesComparables(
  params: SalesCompParams
): Promise<ServiceResult<AttomSaleComp[]>> {
  const result = await attomFetch<Record<string, unknown>>(
    '/sale/snapshot',
    {
      latitude: String(params.latitude),
      longitude: String(params.longitude),
      radius: String(params.radiusMiles),
      propertytype: params.propertyType,
      minsqft: String(params.minSqft),
      maxsqft: String(params.maxSqft),
      saleDateRange: `${params.monthsBack}M`,
      orderby: 'distance',
    }
  );

  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }

  try {
    const comps = normalizeSaleComps(result.data);

    // Filter out comps with obviously bad data (zero sale price, missing essential fields)
    const validComps = comps.filter((c) => {
      if (!c.salePrice || c.salePrice <= 0) return false;
      if (!c.saleDate) return false;
      return true;
    });

    if (validComps.length < comps.length) {
      console.warn(`[attom] Filtered ${comps.length - validComps.length} invalid comps (missing sale price/date)`);
    }

    return { data: validComps, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[attom] Failed to normalize sale comps: ${message}`);
    return { data: null, error: `Failed to parse ATTOM response: ${message}` };
  }
}

export async function getRentalComparables(
  params: RentalCompParams
): Promise<ServiceResult<AttomRentalComp[]>> {
  const result = await attomFetch<Record<string, unknown>>(
    '/rental/snapshot',
    {
      latitude: String(params.latitude),
      longitude: String(params.longitude),
      radius: String(params.radiusMiles),
      propertytype: params.propertyType,
      minsqft: String(params.minSqft),
      maxsqft: String(params.maxSqft),
      orderby: 'distance',
    }
  );

  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }

  try {
    return { data: normalizeRentalComps(result.data), error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[attom] Failed to normalize rental comps: ${message}`);
    return { data: null, error: `Failed to parse ATTOM response: ${message}` };
  }
}

export async function getDeedHistory(
  address: string
): Promise<ServiceResult<AttomDeedRecord[]>> {
  const result = await attomFetch<Record<string, unknown>>(
    '/sale/history',
    { address1: address, address2: '' }
  );

  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }

  try {
    return { data: normalizeDeedHistory(result.data), error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[attom] Failed to normalize deed history: ${message}`);
    return { data: null, error: `Failed to parse ATTOM response: ${message}` };
  }
}
