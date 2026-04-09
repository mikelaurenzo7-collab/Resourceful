/**
 * run-naperville-report.mjs
 *
 * End-to-end pipeline test for 25W050 Setauket Avenue, Naperville, IL.
 * Submits a REAL report through the live pipeline using founder-email bypass,
 * printing each stage as it completes. Auto-approves so you can view it
 * immediately without logging into the admin panel.
 *
 * Usage (from project root, with local Supabase + dev server running):
 *   node scripts/run-naperville-report.mjs
 *
 * Requirements:
 *   - pnpm dev running on localhost:3000
 *   - Local Supabase running (npx supabase start)
 *   - SUPABASE_SERVICE_ROLE_KEY set in .env.local or exported in shell
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Load .env.local ──────────────────────────────────────────────────────────
function loadEnvLocal() {
  try {
    const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of env.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch { /* no .env.local — rely on shell env */ }
}
loadEnvLocal();

// ── Config ───────────────────────────────────────────────────────────────────
const BASE_URL        = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// DuPage County, IL — FIPS 17043
const REPORT_PAYLOAD = {
  client_email:      'mikelaurenzo7@gmail.com',   // founder email → bypasses Stripe
  client_name:       'Mike Laurenzo (Audit Run)',
  property_address:  '25W050 Setauket Ave',
  city:              'Naperville',
  state:             'IL',
  county:            'DuPage County',
  county_fips:       '17043',
  property_type:     'residential',
  service_type:      'tax_appeal',
  review_tier:       'expert_reviewed',
  photos_skipped:    true,
  property_issues:   [],
  additional_notes:  'End-to-end pipeline test — 25W050 Setauket Ave, Naperville. Verifying ATTOM + Claude pipeline for DuPage County.',
  desired_outcome:   'Verify assessed value accuracy against comparable sales',
  has_tax_bill:      false,
};

const STAGE_LABELS = {
  'stage-1-data':       'Stage 1 — Property Data Collection  (ATTOM)',
  'stage-2-comps':      'Stage 2 — Comparable Sales          (ATTOM)',
  'stage-3-income':     'Stage 3 — Income Analysis           (skipped for residential)',
  'stage-4-photos':     'Stage 4 — Photo Analysis            (AI Vision)',
  'stage-5-narratives': 'Stage 5 — Report Narratives         (Claude)',
  'stage-6-filing':     'Stage 6 — Filing Guide              (Claude)',
  'stage-7-pdf':        'Stage 7 — PDF Assembly              (Puppeteer)',
};

// ─────────────────────────────────────────────────────────────────────────────

function ts()      { return new Date().toLocaleTimeString(); }
function log(msg)  { console.log(`[${ts()}] ${msg}`); }
function ok(msg)   { console.log(`\n  ✅  ${msg}`); }
function fail(msg) { console.error(`\n  ❌  ${msg}`); }

function logStage(stage) {
  const label = STAGE_LABELS[stage] ?? stage;
  ok(label);
}

async function main() {
  if (!SERVICE_ROLE_KEY) {
    fail('SUPABASE_SERVICE_ROLE_KEY not found.');
    console.error('  Add it to .env.local or export it:');
    console.error('    export SUPABASE_SERVICE_ROLE_KEY="eyJ..."');
    console.error('  (Get from: npx supabase status)');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  REAL PIPELINE TEST — 25W050 Setauket Ave, Naperville, IL');
  console.log('  County: DuPage County (FIPS 17043)');
  console.log('  Using: ATTOM API + Claude AI + FEMA + Azure Maps');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── Step 1: Ensure DuPage County rule exists ─────────────────────────────
  log('Ensuring DuPage County rule is seeded...');
  const { error: countyErr } = await supabase.from('county_rules').upsert({
    county_fips:                   '17043',
    county_name:                   'DuPage County',
    state_abbreviation:            'IL',
    state_name:                    'Illinois',
    appeal_board_name:             'DuPage County Board of Review',
    appeal_board_address:          '421 N County Farm Rd, Wheaton, IL 60187',
    appeal_board_phone:            '(630) 407-5760',
    accepts_online_filing:         true,
    portal_url:                    'https://www.dupagecounty.gov/elected_officials/board_of_review/',
    accepts_email_filing:          false,
    requires_mail_filing:          false,
    appeal_deadline_rule:          'Appeals must be filed within 30 days of the mailed assessment notice. Notices typically mailed in late spring (May–June). Check dupagecounty.gov for the current open window.',
    next_appeal_deadline:          '2026-06-30',
    current_tax_year:              2025,
    assessment_cycle:              'Triennial (every 3 years)',
    appeal_form_name:              'Complaint to the Board of Review',
    form_download_url:             'https://www.dupagecounty.gov/elected_officials/board_of_review/forms_and_procedures/',
    filing_fee_cents:              0,
    filing_fee_notes:              'No filing fee.',
    required_documents:            [
      'Completed complaint form',
      'Uniform Residential Appraisal Report or comparable sales grid (3–5 recent sales within 1 mile)',
      'Property photos documenting condition defects',
      'Copy of your tax bill or assessment notice (shows PIN)',
    ],
    filing_steps:                  [
      { step_number: 1, title: 'Confirm Your Township', description: 'Naperville sits in Lisle Township (western Naperville) and Naperville Township (eastern). Your PIN prefix identifies your township. Check your assessment notice.'},
      { step_number: 2, title: 'Gather Evidence', description: 'Print this report with the comparable sales grid. Have your 14-digit PIN ready from your tax bill. Photograph any physical defects.'},
      { step_number: 3, title: 'File Online or By Mail', description: 'Visit the DuPage Board of Review portal during the open appeal window. Upload your evidence as PDFs. Or mail to 421 N County Farm Rd, Room 4-300, Wheaton IL 60187.', url: 'https://www.dupagecounty.gov/elected_officials/board_of_review/', form_name: 'Complaint to the Board of Review'},
      { step_number: 4, title: 'Attend Hearing (if scheduled)', description: 'The Board may schedule an informal or formal hearing. Arrive 10 minutes early. Present your strongest comparable sale first, then condition photos.'},
      { step_number: 5, title: 'Await Decision', description: 'Decisions are mailed 6–12 weeks after the hearing. If unsuccessful, you may appeal to the Illinois Property Tax Appeal Board (PTAB) within 30 days.'},
    ],
    hearing_typically_required:    false,
    hearing_format:                'in_person',
    hearing_duration_minutes:      10,
    virtual_hearing_available:     false,
    virtual_hearing_platform:      null,
    informal_review_available:     true,
    informal_review_notes:         'An informal hearing with a hearing officer is available. Many DuPage County appeals are resolved at the informal stage without proceeding to a formal hearing.',
    typical_resolution_weeks_min:  6,
    typical_resolution_weeks_max:  14,
    further_appeal_body:           'Illinois Property Tax Appeal Board (PTAB)',
    pro_se_tips:                   'DuPage County hearing officers respond best to recent arm\'s-length sales within a mile of your property. Bring 3–5 comps from the last 12 months. Condition photos showing specific, documentable defects (not just "general wear") carry significant weight. Be concise — you\'ll have 10 minutes. Open with "My assessed value is $X; my three closest comparable sales indicate a market value of $Y." Then hand over your grid.',
    assessment_ratio_residential:  0.3333,
    assessment_ratio_commercial:   0.3333,
    assessment_ratio_industrial:   0.3333,
    is_active:                     true,
  }, { onConflict: 'county_fips' });

  if (countyErr) {
    fail(`County seed failed: ${countyErr.message}`);
    process.exit(1);
  }
  log('  ✓ DuPage County rule ready');

  // ── Step 2: Submit report via API (founder email skips Stripe) ──────────
  log('\nSubmitting report to pipeline...');

  let reportId;
  try {
    const res = await fetch(`${BASE_URL}/api/reports`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(REPORT_PAYLOAD),
    });

    const json = await res.json();

    if (!res.ok) {
      fail(`API returned ${res.status}: ${JSON.stringify(json)}`);
      process.exit(1);
    }

    if (!json.founderAccess) {
      fail(`Not a founder email — got: ${JSON.stringify(json)}`);
      fail('Add mikelaurenzo7@gmail.com to FOUNDER_EMAILS in config/founders.ts');
      process.exit(1);
    }

    reportId = json.reportId;
    ok(`Report created: ${reportId}`);
    log('    Founder bypass active — pipeline starting...\n');
  } catch (err) {
    fail(`Cannot reach dev server at ${BASE_URL}: ${err.message}`);
    fail('Start the dev server first:  pnpm dev');
    process.exit(1);
  }

  console.log('  Pipeline progress:\n');

  // ── Step 3: Poll for stage-by-stage progress ─────────────────────────────
  let lastStage  = null;
  let lastStatus = null;

  const poll = async () => {
    const { data, error } = await supabase
      .from('reports')
      .select('status, pipeline_last_completed_stage, pipeline_error_log')
      .eq('id', reportId)
      .single();

    if (error || !data) return null;

    const { status, pipeline_last_completed_stage: stage, pipeline_error_log: errLog } = data;

    if (stage && stage !== lastStage) {
      logStage(stage);
      lastStage = stage;
    }

    if (status !== lastStatus) {
      if (status === 'processing' && lastStatus !== 'processing') {
        log('    Pipeline running...');
      } else if (status === 'pending_approval') {
        console.log('\n  ✅  Stages 1–7 complete — pending admin approval');
      } else if (status === 'failed') {
        if (errLog) {
          const lastErr = Array.isArray(errLog) ? errLog[errLog.length - 1] : errLog;
          fail(`Pipeline failed at ${lastErr?.stage ?? 'unknown'}: ${lastErr?.error}`);
        } else {
          fail('Pipeline failed — check dev server logs');
        }
        process.exit(1);
      }
      lastStatus = status;
    }
    return status;
  };

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

    // Safety timeout: 25 minutes
    setTimeout(() => {
      clearInterval(interval);
      reject(new Error('Timed out after 25 minutes'));
    }, 25 * 60 * 1000);
  });

  // ── Step 4: Auto-approve ─────────────────────────────────────────────────
  log('\n  Auto-approving (skipping email delivery for local dev)...');
  const { error: approvalErr } = await supabase
    .from('reports')
    .update({
      status:                        'delivered',
      delivered_at:                  new Date().toISOString(),
      approved_at:                   new Date().toISOString(),
      approved_by:                   'local-dev-auto-approve',
      pipeline_last_completed_stage: 'stage_8_delivery',
    })
    .eq('id', reportId)
    .in('status', ['pending_approval', 'delivering']);

  if (approvalErr) {
    fail(`Auto-approval failed: ${approvalErr.message}`);
    process.exit(1);
  }

  // ── Step 5: Fetch final results ──────────────────────────────────────────
  const { data: result } = await supabase
    .from('reports')
    .select('*, property_data(*), comparable_sales(*)')
    .eq('id', reportId)
    .single();

  const pd       = result?.property_data?.[0];
  const compCount = result?.comparable_sales?.length ?? 0;

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PIPELINE COMPLETE — REAL DATA RESULTS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\n  Address:    ${result?.property_address}, ${result?.city}, ${result?.state}`);
  console.log(`  PIN:        ${result?.pin ?? '(not returned by ATTOM)'}`);
  console.log(`  County:     ${result?.county} (FIPS: ${result?.county_fips})`);
  console.log(`  Lat/Lng:    ${result?.latitude ?? '?'}, ${result?.longitude ?? '?'}`);

  if (pd) {
    console.log('\n  ── Valuation ─────────────────────────────────────────');
    console.log(`  Assessed Value:    $${pd.assessed_value?.toLocaleString() ?? 'N/A'}`);
    console.log(`  Concluded Value:   $${pd.concluded_value?.toLocaleString() ?? 'N/A'}`);
    const savings = pd.assessed_value && pd.concluded_value
      ? Math.max(0, pd.assessed_value - pd.concluded_value) : null;
    if (savings !== null)
      console.log(`  Potential Savings: $${savings.toLocaleString()} (${((savings / pd.assessed_value) * 100).toFixed(1)}%)`);

    console.log('\n  ── Property Facts (ATTOM) ────────────────────────────');
    console.log(`  Year Built:   ${pd.year_built ?? 'N/A'}`);
    console.log(`  Living Area:  ${pd.building_sqft_living_area?.toLocaleString() ?? 'N/A'} sq ft`);
    console.log(`  Lot Size:     ${pd.lot_size_sqft?.toLocaleString() ?? 'N/A'} sq ft`);
    console.log(`  Bedrooms:     ${pd.bedroom_count ?? 'N/A'}`);
    console.log(`  Bathrooms:    ${pd.full_bath_count ?? 'N/A'} full / ${pd.half_bath_count ?? 'N/A'} half`);
    console.log(`  Flood Zone:   ${pd.flood_zone_designation ?? 'N/A'}`);
  }

  if (compCount > 0) {
    console.log(`\n  ── ${compCount} Comparable Sales Found ─────────────────────`);
    const { data: comps } = await supabase
      .from('comparable_sales')
      .select('address, sale_price, sale_date, building_sqft, distance_miles')
      .eq('report_id', reportId)
      .order('distance_miles', { ascending: true });

    comps?.slice(0, 6).forEach(c => {
      console.log(`  ${(c.address ?? '').padEnd(38)} $${(c.sale_price?.toLocaleString() ?? '?').padEnd(9)} ${c.sale_date}  ${c.distance_miles?.toFixed(2)} mi`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  View report:  ${BASE_URL}/report/${reportId}`);
  console.log(`  Admin queue:  ${BASE_URL}/admin/reports`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('\nUnhandled error:', err.message);
  process.exit(1);
});
