/**
 * run-real-report.mjs
 * 
 * Submits a REAL report for 2120 N Winchester Ave through the live pipeline,
 * printing each stage as it completes. Auto-approves when it hits
 * pending_approval so you can view it immediately without admin login.
 *
 * Usage: node scripts/run-real-report.mjs
 * Requires: dev server running on localhost:3000 + local Supabase running
 */

import { createClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────
const BASE_URL = 'http://localhost:3000';
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const REPORT_PAYLOAD = {
  client_email: 'jordan@resourceful.dev', // must be in FOUNDER_EMAILS — bypasses payment
  client_name: 'Jordan (Audit Run)',
  property_address: '2120 N Winchester Ave',
  city: 'Chicago',
  state: 'IL',
  county: 'Cook County',
  county_fips: '17031',
  property_type: 'residential',
  service_type: 'tax_appeal',
  review_tier: 'expert_reviewed',
  photos_skipped: true,
  property_issues: [],
  additional_notes: 'Audit run — testing real ATTOM + Anthropic pipeline for accuracy',
  desired_outcome: 'Verify assessed value accuracy',
  has_tax_bill: false,
};

// Stage labels for human-readable output
const STAGE_LABELS = {
  'stage-1-data':      'Stage 1 — Property Data Collection (ATTOM)',
  'stage-2-comps':     'Stage 2 — Comparable Sales (ATTOM)',
  'stage-3-income':    'Stage 3 — Income Analysis',
  'stage-4-photos':    'Stage 4 — Photo Analysis (AI Vision)',
  'stage-5-narratives':'Stage 5 — Report Narratives (Claude)',
  'stage-6-filing':    'Stage 6 — Filing Guide (Claude)',
  'stage-7-pdf':       'Stage 7 — PDF Assembly',
};

// ─────────────────────────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toLocaleTimeString();
  console.log(`[${ts}] ${msg}`);
}

function logStage(stage) {
  const label = STAGE_LABELS[stage] ?? stage;
  console.log(`\n  ✅  ${label}`);
}

function logError(msg) {
  console.error(`\n  ❌  ${msg}`);
}

async function main() {
  if (!SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is required. Run with:');
    console.error('  $env:SUPABASE_SERVICE_ROLE_KEY="..." ; node scripts/run-real-report.mjs');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  REAL PIPELINE AUDIT — 2120 N Winchester Ave, Chicago');
  console.log('  Using: ATTOM API + Claude AI + FEMA + Azure Maps');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── Step 1: Submit report via API (founder email skips Stripe) ──────────
  log('Submitting report to pipeline...');

  let reportId;
  try {
    const res = await fetch(`${BASE_URL}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(REPORT_PAYLOAD),
    });

    const json = await res.json();

    if (!res.ok) {
      logError(`API returned ${res.status}: ${JSON.stringify(json)}`);
      process.exit(1);
    }

    if (!json.founderAccess) {
      logError(`Not a founder email — got: ${JSON.stringify(json)}`);
      logError(`Make sure FOUNDER_EMAILS includes jordan@resourceful.dev in .env.local`);
      process.exit(1);
    }

    reportId = json.reportId;
    log(`✅  Report created: ${reportId}`);
    log(`    Founder bypass active — pipeline starting now`);
  } catch (err) {
    logError(`Failed to reach dev server at ${BASE_URL}: ${err.message}`);
    logError('Is the dev server running? Run: pnpm.cmd dev');
    process.exit(1);
  }

  console.log('\n  Pipeline progress:\n');

  // ── Step 2: Poll for stage-by-stage progress ──────────────────────────
  let lastStage = null;
  let lastStatus = null;

  const poll = async () => {
    const { data, error } = await supabase
      .from('reports')
      .select('status, pipeline_last_completed_stage, pipeline_error_log')
      .eq('id', reportId)
      .single();

    if (error || !data) return;

    const { status, pipeline_last_completed_stage: stage, pipeline_error_log: errLog } = data;

    // Print newly completed stage
    if (stage && stage !== lastStage) {
      logStage(stage);
      lastStage = stage;
    }

    // Print status changes
    if (status !== lastStatus) {
      if (status === 'processing' && lastStatus === null) {
        log('  Pipeline running...');
      } else if (status === 'pending_approval') {
        console.log('\n  ✅  Stages 1-7 complete — report queued for admin approval');
      } else if (status === 'failed') {
        if (errLog) {
          const lastErr = Array.isArray(errLog) ? errLog[errLog.length - 1] : errLog;
          logError(`Pipeline failed at ${lastErr?.stage ?? 'unknown stage'}: ${lastErr?.error}`);
        } else {
          logError('Pipeline failed — check server logs for details');
        }
        process.exit(1);
      }
      lastStatus = status;
    }

    return status;
  };

  // Poll every 4 seconds until stage 7 completes or failure
  await new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const status = await poll();
        if (status === 'pending_approval' || status === 'delivered') {
          clearInterval(interval);
          resolve(status);
        }
      } catch (err) {
        clearInterval(interval);
        reject(err);
      }
    }, 4000);

    // Safety timeout: 20 minutes
    setTimeout(() => {
      clearInterval(interval);
      reject(new Error('Timed out waiting for pipeline after 20 minutes'));
    }, 20 * 60 * 1000);
  });

  // ── Step 3: Auto-approve (mark delivered, skip email for local dev) ──
  log('\n  Auto-approving for local review (skipping delivery email)...');

  const { error: approvalErr } = await supabase
    .from('reports')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
      approved_by: 'local-dev-auto-approve',
      pipeline_last_completed_stage: 'stage_8_delivery',
    })
    .eq('id', reportId)
    .in('status', ['pending_approval', 'delivering']);

  if (approvalErr) {
    logError(`Auto-approval failed: ${approvalErr.message}`);
    process.exit(1);
  }

  // ── Step 4: Fetch and display the results ────────────────────────────
  const { data: result } = await supabase
    .from('reports')
    .select('*, property_data(*), comparable_sales(*)')
    .eq('id', reportId)
    .single();

  const pd = result?.property_data?.[0];
  const compCount = result?.comparable_sales?.length ?? 0;

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PIPELINE COMPLETE — REAL DATA RESULTS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\n  Address:          ${result?.property_address}, ${result?.city}, ${result?.state}`);
  console.log(`  PIN:              ${result?.pin ?? '(not found)'}`);
  console.log(`  County:           ${result?.county} (FIPS: ${result?.county_fips})`);
  console.log(`  Lat/Lng:          ${result?.latitude}, ${result?.longitude}`);

  if (pd) {
    console.log('\n  ── Valuation ─────────────────────────────────────────────');
    console.log(`  Assessed Value:   $${pd.assessed_value?.toLocaleString() ?? 'N/A'}`);
    console.log(`  Concluded Value:  $${pd.concluded_value?.toLocaleString() ?? 'N/A'}`);
    const savings = pd.assessed_value && pd.concluded_value
      ? Math.max(0, pd.assessed_value - pd.concluded_value)
      : null;
    if (savings !== null) {
      console.log(`  Potential Savings: $${savings.toLocaleString()} (${pd.assessed_value ? ((savings / pd.assessed_value) * 100).toFixed(1) : '?'}% reduction)`);
    }
    console.log('\n  ── Property Facts (from ATTOM) ───────────────────────────');
    console.log(`  Year Built:       ${pd.year_built ?? 'N/A'}`);
    console.log(`  Living Area:      ${pd.building_sqft_living_area?.toLocaleString() ?? 'N/A'} sq ft`);
    console.log(`  Lot Size:         ${pd.lot_size_sqft?.toLocaleString() ?? 'N/A'} sq ft`);
    console.log(`  Bedrooms:         ${pd.bedroom_count ?? 'N/A'}`);
    console.log(`  Bathrooms:        ${pd.full_bath_count ?? 'N/A'} full / ${pd.half_bath_count ?? 'N/A'} half`);
    console.log(`  Property Class:   ${pd.property_class ?? 'N/A'}`);
    console.log(`  Condition:        ${pd.overall_condition ?? 'N/A'}`);
    console.log(`  Flood Zone:       ${pd.flood_zone_designation ?? 'N/A'}`);
  }

  if (compCount > 0) {
    console.log(`\n  ── Comparable Sales (${compCount} found by ATTOM) ────────────────`);
    const { data: comps } = await supabase
      .from('comparable_sales')
      .select('address, sale_price, sale_date, building_sqft, distance_miles')
      .eq('report_id', reportId)
      .order('distance_miles', { ascending: true });

    comps?.slice(0, 6).forEach(c => {
      console.log(`  ${c.address.padEnd(35)} $${c.sale_price?.toLocaleString()?.padEnd(9)} ${c.sale_date}  ${c.distance_miles?.toFixed(2)} mi`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  View full report: ${BASE_URL}/report/${reportId}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('\nUnhandled error:', err.message);
  process.exit(1);
});
