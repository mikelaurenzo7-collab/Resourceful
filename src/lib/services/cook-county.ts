// ─── Cook County Assessor API Service (Socrata / SODA) ───────────────────────
// Queries the Cook County Assessor's open data portal for PIN-level
// assessment records.

// ─── Configuration ───────────────────────────────────────────────────────────

const BASE_URL =
  process.env.COOK_COUNTY_ASSESSOR_API_URL ??
  'https://datacatalog.cookcountyil.gov/resource';

// Socrata dataset identifiers for Cook County
const DATASETS = {
  assessments: 'uzyt-m557',        // current-year assessed values
  assessmentHistory: '33ri-zmx4',  // multi-year assessment history
  parcels: 'tx2p-k2g5',           // parcel / address lookup
} as const;

// ─── Response Types ──────────────────────────────────────────────────────────

export interface CookCountyAssessment {
  pin: string;
  taxYear: number;
  classCode: string;
  landAssessedValue: number;
  improvementAssessedValue: number;
  totalAssessedValue: number;
  buildingSqFt: number | null;
  landSqFt: number | null;
  yearBuilt: number | null;
  propertyAddress: string | null;
  city: string | null;
  zip: string | null;
}

export interface CookCountyAssessmentHistoryEntry {
  pin: string;
  taxYear: number;
  landAssessedValue: number;
  improvementAssessedValue: number;
  totalAssessedValue: number;
  classCode: string;
}

export interface CookCountyParcel {
  pin: string;
  address: string;
  city: string;
  zip: string;
  classCode: string;
  township: string;
}

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

async function sodaQuery<T>(
  dataset: string,
  params: Record<string, string>
): Promise<ServiceResult<T>> {
  const url = new URL(`${BASE_URL}/${dataset}.json`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  // Append app token if available (raises throttle limits)
  const appToken = process.env.COOK_COUNTY_APP_TOKEN;
  if (appToken) {
    url.searchParams.set('$$app_token', appToken);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000); // 15s timeout
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(
        `[cook-county] ${dataset} responded ${response.status}: ${body.slice(0, 500)}`
      );
      return {
        data: null,
        error: `Cook County API returned ${response.status}: ${response.statusText}`,
      };
    }

    const json = (await response.json()) as T;
    return { data: json, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cook-county] ${dataset} fetch error: ${message}`);
    return { data: null, error: `Cook County API request failed: ${message}` };
  }
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

function normalizeAssessment(row: any): CookCountyAssessment {
  return {
    pin: row.pin ?? '',
    taxYear: parseInt(row.tax_year, 10) || 0,
    classCode: row.class ?? '',
    landAssessedValue: parseFloat(row.certified_land) || 0,
    improvementAssessedValue: parseFloat(row.certified_bldg) || 0,
    totalAssessedValue: parseFloat(row.certified_tot) || 0,
    buildingSqFt: row.bldg_sf ? parseInt(row.bldg_sf, 10) : null,
    landSqFt: row.land_sf ? parseInt(row.land_sf, 10) : null,
    yearBuilt: row.yr_built ? parseInt(row.yr_built, 10) : null,
    propertyAddress: row.property_address ?? null,
    city: row.property_city ?? null,
    zip: row.property_zip ?? null,
  };
}

function normalizeHistoryEntry(row: any): CookCountyAssessmentHistoryEntry {
  return {
    pin: row.pin ?? '',
    taxYear: parseInt(row.tax_year, 10) || 0,
    landAssessedValue: parseFloat(row.certified_land) || 0,
    improvementAssessedValue: parseFloat(row.certified_bldg) || 0,
    totalAssessedValue: parseFloat(row.certified_tot) || 0,
    classCode: row.class ?? '',
  };
}

function normalizeParcel(row: any): CookCountyParcel {
  return {
    pin: row.pin ?? '',
    address: row.property_address ?? '',
    city: row.property_city ?? '',
    zip: row.property_zip ?? '',
    classCode: row.class ?? '',
    township: row.township ?? '',
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Look up the current assessment record for a given 14-digit Cook County PIN.
 */
export async function getPropertyByPIN(
  pin: string
): Promise<ServiceResult<CookCountyAssessment>> {
  // Strip everything except digits to prevent SoQL injection
  const cleanPin = pin.replace(/\D/g, '');
  if (cleanPin.length === 0 || cleanPin.length > 14) {
    return { data: null, error: `Invalid PIN format: ${pin}` };
  }
  const result = await sodaQuery<any[]>(DATASETS.assessments, {
    $where: `pin='${cleanPin}'`,
    $order: 'tax_year DESC',
    $limit: '1',
  });

  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }

  if (result.data.length === 0) {
    return { data: null, error: `No assessment found for PIN ${cleanPin}` };
  }

  try {
    return { data: normalizeAssessment(result.data[0]), error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { data: null, error: `Failed to parse Cook County response: ${message}` };
  }
}

/**
 * Retrieve multi-year assessment history for a PIN.
 */
export async function getAssessmentHistory(
  pin: string
): Promise<ServiceResult<CookCountyAssessmentHistoryEntry[]>> {
  const cleanPin = pin.replace(/\D/g, '');
  if (cleanPin.length === 0 || cleanPin.length > 14) {
    return { data: null, error: `Invalid PIN format: ${pin}` };
  }
  const result = await sodaQuery<any[]>(DATASETS.assessmentHistory, {
    $where: `pin='${cleanPin}'`,
    $order: 'tax_year DESC',
    $limit: '20',
  });

  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }

  try {
    return { data: result.data.map(normalizeHistoryEntry), error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { data: null, error: `Failed to parse Cook County response: ${message}` };
  }
}

/**
 * Search for a PIN by street address.
 */
export async function searchByAddress(
  address: string
): Promise<ServiceResult<CookCountyParcel[]>> {
  // Sanitize input to prevent SoQL injection — strip anything that isn't
  // alphanumeric, space, period, comma, or hash (standard address chars).
  const normalized = address
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9 .,#-]/g, '');
  const result = await sodaQuery<any[]>(DATASETS.parcels, {
    $where: `upper(property_address) LIKE '%${normalized}%'`,
    $limit: '10',
  });

  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }

  try {
    return { data: result.data.map(normalizeParcel), error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { data: null, error: `Failed to parse Cook County response: ${message}` };
  }
}
