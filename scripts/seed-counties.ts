#!/usr/bin/env npx tsx
// ─── County Seeding Script ──────────────────────────────────────────────────
// Fetches all ~3,143 US counties from the Census Bureau API and bulk-inserts
// them into the county_rules table via Supabase. Only populates geographic
// identity fields (FIPS, name, state). County-specific appeal rules, ratios,
// and board info must be filled in via the admin UI or a separate data import.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-counties.ts
// ─────────────────────────────────────────────────────────────────────────────

const CENSUS_API_URL =
  'https://api.census.gov/data/2020/dec/pl?get=NAME&for=county:*&in=state:*';

// State FIPS → abbreviation mapping
const STATE_FIPS_TO_ABBREV: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
  '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
  '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
  '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
  '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
  '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI',
  '56': 'WY',
};

const STATE_ABBREV_TO_NAME: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin',
  WY: 'Wyoming',
};

interface CensusRow {
  name: string;       // "County Name, State Name"
  stateFips: string;  // "01"
  countyFips: string; // "001"
}

async function fetchCounties(): Promise<CensusRow[]> {
  console.log('Fetching counties from Census Bureau API...');
  const response = await fetch(CENSUS_API_URL);

  if (!response.ok) {
    throw new Error(`Census API returned ${response.status}: ${response.statusText}`);
  }

  const data: string[][] = await response.json();
  // First row is headers: ["NAME", "state", "county"]
  const rows = data.slice(1);

  console.log(`Received ${rows.length} county records from Census Bureau`);

  return rows.map((row) => ({
    name: row[0],
    stateFips: row[1],
    countyFips: row[2],
  }));
}

function parseCountyName(fullName: string): string {
  // Census returns "County Name, State Name" — extract just the county part
  const commaIdx = fullName.lastIndexOf(',');
  return commaIdx > 0 ? fullName.substring(0, commaIdx).trim() : fullName.trim();
}

async function seedCounties() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required');
    process.exit(1);
  }

  // Dynamic import to avoid requiring the package at parse time
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  const censusRows = await fetchCounties();

  // Build upsert records
  const records = censusRows
    .filter((row) => STATE_FIPS_TO_ABBREV[row.stateFips]) // skip territories
    .map((row) => {
      const stateAbbrev = STATE_FIPS_TO_ABBREV[row.stateFips];
      const stateName = STATE_ABBREV_TO_NAME[stateAbbrev];
      const fips = `${row.stateFips}${row.countyFips}`;
      const countyName = parseCountyName(row.name);

      return {
        county_fips: fips,
        county_name: countyName,
        state_name: stateName,
        state_abbreviation: stateAbbrev,
        // Defaults for required fields — to be filled via admin UI
        assessment_ratio_residential: 0,
        assessment_ratio_commercial: 0,
        assessment_ratio_industrial: 0,
        assessment_methodology: 'Unknown — needs configuration',
        appeal_board_name: 'Unknown — needs configuration',
        appeal_deadline_rule: 'Unknown — needs configuration',
        accepts_online_filing: false,
        accepts_email_filing: false,
        requires_mail_filing: false,
        hearing_typically_required: false,
        filing_fee_cents: 0,
        is_active: false, // inactive until admin configures rules
      };
    });

  console.log(`Prepared ${records.length} county records for upsert (skipped territories)`);

  // Upsert in batches of 500
  const BATCH_SIZE = 500;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('county_rules')
      .upsert(batch, { onConflict: 'county_fips', ignoreDuplicates: false });

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
      console.log(`  Upserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} records (total: ${inserted})`);
    }
  }

  console.log(`\nDone! Upserted ${inserted} counties. Errors: ${errors}`);
  console.log('Counties are created with is_active=false. Use the admin UI to configure rules and activate.');
}

seedCounties().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
