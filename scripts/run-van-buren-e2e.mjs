/**
 * run-van-buren-e2e.mjs
 *
 * Full end-to-end pipeline test for 914 W Van Buren St, Chicago, IL.
 * Submits a real report through the live pipeline (stages 1-8), printing
 * progress as each stage completes. Auto-approves at pending_approval
 * so you can view the report immediately without an admin login.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/run-van-buren-e2e.mjs
 *
 * Requires:
 *   - pnpm dev running on localhost:3000
 *   - supabase start running on 127.0.0.1:54321
 *   - ATTOM_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY in .env.local
 *   - FOUNDER_EMAILS includes mikelaurenzo7@gmail.com in .env.local
 *   - SUPABASE_SERVICE_ROLE_KEY set (from `supabase status`)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ── Load .env.local ──────────────────────────────────────────────────────────
function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnvLocal();

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL         = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const REPORT_PAYLOAD = {
  client_email:     'mikelaurenzo7@gmail.com', // founder email — bypasses payment
  client_name:      'Mike (E2E Test)',
  property_address: '914 W Van Buren St',
  city:             'Chicago',
  state:            'IL',
  county:           'Cook County',
  county_fips:      '17031',
  property_type:    'residential',
  service_type:     'tax_appeal',
  review_tier:      'expert_reviewed',
  photos_skipped:   true,
  property_issues:  [],
  additional_notes: 'E2E test — 914 W Van Buren, Chicago IL',
  desired_outcome:  'Verify assessed value accuracy',
  has_tax_bill:     false,
};

// ── Stage labels ──────────────────────────────────────────────────────────────
const STAGE_LABELS = {
  'stage-1-data':       'Stage 1 — Property Data Collection (ATTOM)',
  'stage-2-comps':      'Stage 2 — Comparable Sales (ATTOM)',
  'stage-3-income':     'Stage 3 — Income Analysis',
  'stage-4-photos':     'Stage 4 — Photo Analysis (AI Vision)',
  'stage-5-narratives': 'Stage 5 — Report Narratives (Claude)',
  'stage-6-filing':     'Stage 6 — Filing Guide (Claude)',
  'stage-7-pdf':        'Stage 7 — PDF Assembly',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const ts  = () => new Date().toLocaleTimeString();
const log = (msg) => console.log(`[${ts()}] ${msg}`);
const err = (msg) => console.error(`\n  ❌  ${msg}`);

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!SERVICE_ROLE_KEY) {
    err('SUPABASE_SERVICE_ROLE_KEY is required.');
    err('Get it from `supabase status` then run:');
    err('  SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/run-van-buren-e2e.mjs');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  E2E PIPELINE TEST — 914 W Van Buren St, Chicago IL 60607');
  console.log('  ATTOM + Claude AI + Gemini Vision + Azure Maps + FEMA');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── 1. Submit via API (founder email skips Stripe) ───────────────────────
  log('Submitting report to /api/reports ...');

  let reportId;
  try {
    const res  = await fetch(`${BASE_URL}/api/reports`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(REPORT_PAYLOAD),
    });
    const json = await res.json();

    if (!res.ok) {
      err(`API ${res.status}: ${JSON.stringify(json)}`);
      process.exit(1);
    }
    if (!json.founderAccess) {
      err(`Not a founder email. Response: ${JSON.stringify(json)}`);
      err(`Ensure FOUNDER_EMAILS includes mikelaurenzo7@gmail.com in .env.local`);
      process.exit(1);
    }

    reportId = json.reportId;
    log(`Report created: ${reportId}`);
    log('Founder bypass active — pipeline starting now');
  } catch (e) {
    err(`Cannot reach ${BASE_URL}: ${e.message}`);
    err('Is `pnpm dev` running?');
    process.exit(1);
  }

  console.log('\n  Pipeline progress:\n');

  // ── 2. Poll until pending_approval or failure ────────────────────────────
  let lastStage = null;
  let lastStatus = null;

  await new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const { data, error: dbErr } = await supabase
          .from('reports')
          .select('status, pipeline_last_completed_stage, pipeline_error_log')
          .eq('id', reportId)
          .single();

        if (dbErr || !data) return;

        const { status, pipeline_last_completed_stage: stage, pipeline_error_log: errLog } = data;

        if (stage && stage !== lastStage) {
          const label = STAGE_LABELS[stage] ?? stage;
          console.log(`  ✅  ${label}`);
          lastStage = stage;
        }

        if (status !== lastStatus) {
          if (status === 'pending_approval') {
            console.log('\n  ✅  Stages 1-7 complete — queued for approval');
          } else if (status === 'failed') {
            const last = Array.isArray(errLog) ? errLog[errLog.length - 1] : errLog;
            err(`Failed at ${last?.stage ?? '?'}: ${last?.error}`);
            process.exit(1);
          }
          lastStatus = status;
        }

        if (status === 'pending_approval' || status === 'delivered') {
          clearInterval(interval);
          resolve(status);
        }
      } catch (e) {
        clearInterval(interval);
        reject(e);
      }
    }, 4000);

    setTimeout(() => {
      clearInterval(interval);
      reject(new Error('Timed out after 25 minutes'));
    }, 25 * 60 * 1000);
  });

  // ── 3. Auto-approve (no admin login needed for local dev) ────────────────
  log('\nAuto-approving (local dev — skipping delivery email)...');

  const { error: approvalErr } = await supabase
    .from('reports')
    .update({
      status:                        'delivered',
      delivered_at:                  new Date().toISOString(),
      approved_at:                   new Date().toISOString(),
      approved_by:                   'e2e-auto-approve',
      pipeline_last_completed_stage: 'stage_8_delivery',
    })
    .eq('id', reportId)
    .in('status', ['pending_approval', 'delivering']);

  if (approvalErr) {
    err(`Auto-approval failed: ${approvalErr.message}`);
    process.exit(1);
  }

  // ── 4. Fetch and display final results ──────────────────────────────────
  const { data: result } = await supabase
    .from('reports')
    .select('*, property_data(*), comparable_sales(*)')
    .eq('id', reportId)
    .single();

  const pd        = result?.property_data?.[0];
  const compCount = result?.comparable_sales?.length ?? 0;

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  RESULTS — 914 W Van Buren St, Chicago IL');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\n  Address:  ${result?.property_address}, ${result?.city}, ${result?.state}`);
  console.log(`  PIN:      ${result?.pin ?? '(not found)'}`);
  console.log(`  County:   ${result?.county} (FIPS: ${result?.county_fips})`);
  console.log(`  Lat/Lng:  ${result?.latitude}, ${result?.longitude}`);

  if (pd) {
    console.log('\n  ── Valuation ────────────────────────────────────────────');
    console.log(`  Assessed Value:    $${pd.assessed_value?.toLocaleString() ?? 'N/A'}`);
    console.log(`  Concluded Value:   $${pd.concluded_value?.toLocaleString() ?? 'N/A'}`);
    const savings = pd.assessed_value && pd.concluded_value
      ? Math.max(0, pd.assessed_value - pd.concluded_value)
      : null;
    if (savings !== null) {
      const pct = pd.assessed_value ? ((savings / pd.assessed_value) * 100).toFixed(1) : '?';
      console.log(`  Potential Savings: $${savings.toLocaleString()} (${pct}% reduction)`);
    }

    console.log('\n  ── Property Facts (ATTOM) ───────────────────────────────');
    console.log(`  Year Built:   ${pd.year_built ?? 'N/A'}`);
    console.log(`  Living Area:  ${pd.building_sqft_living_area?.toLocaleString() ?? 'N/A'} sq ft`);
    console.log(`  Lot Size:     ${pd.lot_size_sqft?.toLocaleString() ?? 'N/A'} sq ft`);
    console.log(`  Bedrooms:     ${pd.bedroom_count ?? 'N/A'}`);
    console.log(`  Bathrooms:    ${pd.full_bath_count ?? 'N/A'} full / ${pd.half_bath_count ?? 'N/A'} half`);
    console.log(`  Property Cls: ${pd.property_class ?? 'N/A'}`);
    console.log(`  Condition:    ${pd.overall_condition ?? 'N/A'}`);
    console.log(`  Flood Zone:   ${pd.flood_zone_designation ?? 'N/A'}`);
  }

  if (compCount > 0) {
    console.log(`\n  ── Comparable Sales (${compCount} found) ────────────────────────`);
    const { data: comps } = await supabase
      .from('comparable_sales')
      .select('address, sale_price, sale_date, building_sqft, distance_miles')
      .eq('report_id', reportId)
      .order('distance_miles', { ascending: true });

    comps?.slice(0, 6).forEach((c) => {
      const addr  = (c.address ?? '').padEnd(35);
      const price = `$${c.sale_price?.toLocaleString() ?? '?'}`.padEnd(12);
      console.log(`  ${addr} ${price} ${c.sale_date}  ${c.distance_miles?.toFixed(2)} mi`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  Full report: ${BASE_URL}/report/${reportId}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch((e) => {
  console.error('\nUnhandled error:', e.message);
  process.exit(1);
});
