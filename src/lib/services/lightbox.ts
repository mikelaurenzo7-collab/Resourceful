// ─── LightBox RE Property Intelligence API ────────────────────────────────────
// Property data fallback when ATTOM returns zero/empty fields.
// Auth: OAuth2 client credentials (key + secret → bearer token).
// Used by data-router.ts as Source 3 after ATTOM fails.

const BASE_URL = 'https://api.lightboxre.com';

// ─── Token Cache ─────────────────────────────────────────────────────────────
// Module-level cache — reused within a warm serverless invocation.
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }
  const key = process.env.LIGHTBOX_API_KEY ?? '';
  const secret = process.env.LIGHTBOX_API_SECRET ?? '';
  if (!key || !secret) return null;

  try {
    const basicAuth = Buffer.from(`${key}:${secret}`).toString('base64');
    const res = await fetch(`${BASE_URL}/v1/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[lightbox] Token request failed ${res.status}: ${body.slice(0, 200)}`);
      return null;
    }
    const json = (await res.json()) as { access_token: string; expires_in: number };
    tokenCache = {
      token: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    };
    return tokenCache.token;
  } catch (err) {
    console.warn('[lightbox] Token error:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

// ─── Response Types ──────────────────────────────────────────────────────────

export interface LightboxParcelDetail {
  parcelId: string;
  apn: string | null;
  address: {
    full: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    county: string | null;
    fips: string | null;
  };
  location: {
    latitude: number | null;
    longitude: number | null;
  };
  assessment: {
    assessedValue: number | null;
    landValue: number | null;
    improvementValue: number | null;
    marketValue: number | null;
    taxAmount: number | null;
    taxYear: number | null;
  };
  structure: {
    yearBuilt: number | null;
    grossSquareFeet: number | null;
    livableSquareFeet: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    stories: number | null;
    pool: boolean;
  };
  lot: {
    squareFeet: number | null;
    zoning: string | null;
  };
  propertyUse: {
    code: string | null;
    description: string | null;
  };
  saleHistory: Array<{
    date: string;
    amount: number | null;
    documentType: string | null;
    armsLength: boolean | null;
    buyerNames: string[];
    sellerNames: string[];
  }>;
}

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function normalizeParcel(raw: Record<string, unknown>): LightboxParcelDetail {
  // Lightbox wraps in a "parcel" or "property" envelope depending on endpoint
  const p = (raw as any)?.parcel ?? (raw as any)?.property ?? raw;
  const addr = p.address ?? {};
  const loc = p.location ?? {};
  const assessment = p.assessment ?? {};
  const structure = p.structure ?? {};
  const area = p.area ?? {};
  const use = p.propertyUse ?? {};
  const saleHistory: unknown[] = Array.isArray(p.saleHistory) ? p.saleHistory : [];

  return {
    parcelId: String(p.id ?? p.parcelId ?? ''),
    apn: p.apn ?? null,
    address: {
      full: addr.full ?? null,
      city: addr.city ?? null,
      state: addr.stateAbbreviation ?? addr.state ?? null,
      zip: addr.zip ?? addr.postalCode ?? null,
      county: addr.county ?? null,
      fips: addr.fips ?? addr.countyFips ?? null,
    },
    location: {
      latitude: typeof loc.latitude === 'number'
        ? loc.latitude
        : (parseFloat(loc.latitude) || null),
      longitude: typeof loc.longitude === 'number'
        ? loc.longitude
        : (parseFloat(loc.longitude) || null),
    },
    assessment: {
      assessedValue: assessment.assessedValue ?? null,
      landValue: assessment.assessedLandValue ?? assessment.landValue ?? null,
      improvementValue: assessment.assessedImprovementValue ?? assessment.improvementValue ?? null,
      marketValue: assessment.marketValue ?? null,
      taxAmount: assessment.taxAmount ?? null,
      taxYear: assessment.assessmentYear ?? assessment.taxYear ?? null,
    },
    structure: {
      yearBuilt: structure.yearBuilt ?? null,
      grossSquareFeet: structure.grossSquareFeet ?? structure.buildingSquareFeet ?? null,
      livableSquareFeet: structure.livableSquareFeet ?? structure.livingSquareFeet ?? null,
      bedrooms: structure.bedrooms ?? null,
      bathrooms: structure.bathroomsTotal ?? structure.bathrooms ?? null,
      stories: structure.floorCount ?? structure.stories ?? null,
      pool: structure.pool === true,
    },
    lot: {
      squareFeet: area.lotSquareFeet ?? p.lot?.squareFeet ?? null,
      zoning: area.zoning ?? p.lot?.zoning ?? null,
    },
    propertyUse: {
      code: use.standardizedCode ?? use.detail?.code ?? null,
      description: use.detail?.description ?? use.description ?? null,
    },
    saleHistory: saleHistory.map((s: any) => ({
      date: s.date ?? s.saleDate ?? '',
      amount: s.amount ?? s.salePrice ?? null,
      documentType: s.documentType ?? null,
      armsLength: s.armsLength ?? null,
      buyerNames: Array.isArray(s.buyerNames) ? s.buyerNames : [],
      sellerNames: Array.isArray(s.sellerNames) ? s.sellerNames : [],
    })),
  };
}

async function lightboxFetch<T>(
  token: string,
  path: string,
  params?: Record<string, string>,
): Promise<ServiceResult<T>> {
  try {
    const url = new URL(`${BASE_URL}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[lightbox] ${path} returned ${res.status}: ${body.slice(0, 300)}`);
      return { data: null, error: `Lightbox API returned ${res.status}` };
    }
    return { data: (await res.json()) as T, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[lightbox] ${path} error: ${msg}`);
    return { data: null, error: msg };
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getPropertyDetail(
  address: string,
  city?: string | null,
  state?: string | null,
): Promise<ServiceResult<LightboxParcelDetail>> {
  const key = process.env.LIGHTBOX_API_KEY ?? '';
  const secret = process.env.LIGHTBOX_API_SECRET ?? '';
  if (!key || !secret) return { data: null, error: 'Lightbox not configured' };

  const token = await getAccessToken();
  if (!token) return { data: null, error: 'Lightbox token acquisition failed' };

  const q = [address, city, state].filter(Boolean).join(', ');
  console.log(`[lightbox] Searching address: "${q}"`);

  // ── Step 1: Resolve address → parcel ID ─────────────────────────────────
  const addrResult = await lightboxFetch<Record<string, unknown>>(token, '/v2/addresses', {
    q,
    country: 'US',
    limit: '1',
  });
  if (addrResult.error || !addrResult.data) {
    return { data: null, error: addrResult.error ?? 'No address results from Lightbox' };
  }

  const addresses: any[] = (addrResult.data as any)?.addresses ?? [];
  if (!addresses.length) {
    console.warn(`[lightbox] No address match for "${q}"`);
    return { data: null, error: 'No address match found in Lightbox' };
  }

  const parcelId: string | null = addresses[0]?.parcels?.[0]?.id ?? null;
  if (!parcelId) {
    console.warn(`[lightbox] No parcel linked to address "${q}"`);
    return { data: null, error: 'No parcel found for address in Lightbox' };
  }

  // ── Step 2: Fetch full parcel detail ─────────────────────────────────────
  const parcelResult = await lightboxFetch<Record<string, unknown>>(
    token,
    `/v2/parcels/${parcelId}`,
  );
  if (parcelResult.error || !parcelResult.data) {
    return { data: null, error: parcelResult.error ?? 'No parcel data from Lightbox' };
  }

  try {
    const detail = normalizeParcel(parcelResult.data);

    const missing: string[] = [];
    if (!detail.structure.grossSquareFeet) missing.push('grossSquareFeet');
    if (!detail.structure.yearBuilt) missing.push('yearBuilt');
    if (!detail.assessment.assessedValue) missing.push('assessedValue');
    if (missing.length) {
      console.warn(`[lightbox] Missing fields for "${q}": ${missing.join(', ')}`);
    }

    console.log(
      `[lightbox] Parcel data for "${q}": ` +
        `assessed=$${detail.assessment.assessedValue?.toLocaleString() ?? 'N/A'}, ` +
        `sqft=${detail.structure.grossSquareFeet ?? 'N/A'}, ` +
        `yearBuilt=${detail.structure.yearBuilt ?? 'N/A'}`,
    );

    return { data: detail, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[lightbox] Failed to normalize parcel: ${msg}`);
    return { data: null, error: `Failed to parse Lightbox response: ${msg}` };
  }
}
