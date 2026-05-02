/**
 * run-naperville-e2e.mjs
 * One-off founder E2E for 1611 Country Lakes Drive, Naperville, IL (DuPage 17043).
 * Submits via /api/reports (founder bypass), polls progress, auto-approves, prints summary.
 */

import { createClient } from '@supabase/supabase-js';

const BASE_URL = 'http://localhost:3000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const REPORT_PAYLOAD = {
  client_email: 'jordan@resourceful.dev',
  client_name: 'Jordan (Naperville E2E)',
  property_address: '1611 Country Lakes Drive',
  city: 'Naperville',
  state: 'IL',
  county: 'DuPage County',
  county_fips: '17043',
  property_type: 'residential',
  service_type: 'tax_appeal',
  review_tier: 'expert_reviewed',
  photos_skipped: true,
  property_issues: [],
  additional_notes: 'Founder E2E — Naperville, post-Gemini-removal Claude-only pipeline',
  desired_outcome: 'Verify assessed value accuracy',
  has_tax_bill: false,
};

const STAGE_LABELS = {
  'stage-1-data':       'Stage 1 — Property Data Collection (ATTOM)',
  'stage-2-comps':      'Stage 2 — Comparable Sales',
  'stage-3-income':     'Stage 3 — Income Analysis',
  'stage-4-photos':     'Stage 4 — Photo Analysis',
  'stage-5-narratives': 'Stage 5 — Narratives (Opus + thinking)',
  'stage-6-filing':     'Stage 6 — Filing Guide (Opus + thinking)',
  'stage-7-pdf':        'Stage 7 — PDF Assembly',
};

const log  = (m) => console.log(`[${new Date().toLocaleTimeString()}] ${m}`);
const ok   = (s) => console.log(`  ✓ ${STAGE_LABELS[s] ?? s}`);
const fail = (m) => console.error(`  ✗ ${m}`);

if (!SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY missing. Run from a shell with .env.local sourced.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  E2E — 1611 Country Lakes Drive, Naperville, IL');
console.log('  Provider: Claude only (Opus 4.7 + Haiku 4.5) — Gemini removed');
console.log('═══════════════════════════════════════════════════════════════\n');

log('Submitting report (founder bypass)...');

let reportId;
try {
  const res = await fetch(`${BASE_URL}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(REPORT_PAYLOAD),
  });
  const json = await res.json();
  if (!res.ok) {
    fail(`API ${res.status}: ${JSON.stringify(json)}`);
    process.exit(1);
  }
  if (!json.founderAccess) {
    fail(`Not founder — got ${JSON.stringify(json)}`);
    process.exit(1);
  }
  reportId = json.reportId;
  log(`Report created: ${reportId}`);
  log(`Open in VS Code browser: ${BASE_URL}/report/${reportId}`);
} catch (err) {
  fail(`Cannot reach ${BASE_URL}: ${err.message}. Is dev server running?`);
  process.exit(1);
}

console.log('\n  Pipeline progress:\n');

let lastStage = null;
let lastStatus = null;

async function poll() {
  const { data } = await sb
    .from('reports')
    .select('status, pipeline_last_completed_stage, pipeline_error_log')
    .eq('id', reportId)
    .single();
  if (!data) return null;
  const { status, pipeline_last_completed_stage: stage, pipeline_error_log: errLog } = data;
  if (stage && stage !== lastStage) { ok(stage); lastStage = stage; }
  if (status !== lastStatus) {
    if (status === 'pending_approval') console.log('\n  ✓ Stages 1-7 done — pending approval\n');
    else if (status === 'failed') {
      const e = Array.isArray(errLog) ? errLog[errLog.length - 1] : errLog;
      fail(`Failed at ${e?.stage}: ${e?.error}`);
      process.exit(1);
    }
    lastStatus = status;
  }
  return status;
}

await new Promise((resolve, reject) => {
  const t = setInterval(async () => {
    try {
      const s = await poll();
      if (s === 'pending_approval' || s === 'delivered') { clearInterval(t); resolve(s); }
    } catch (e) { clearInterval(t); reject(e); }
  }, 4000);
  setTimeout(() => { clearInterval(t); reject(new Error('Timeout 20m')); }, 20 * 60 * 1000);
});

log('Auto-approving (local dev)...');
await sb
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

const { data: result } = await sb
  .from('reports')
  .select('*, property_data(*), comparable_sales(*)')
  .eq('id', reportId)
  .single();
const pd = result?.property_data?.[0];

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  RESULTS');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Address:          ${result?.property_address}, ${result?.city}, ${result?.state}`);
console.log(`  Report ID:        ${reportId}`);
if (pd) {
  console.log(`  Assessed Value:   $${pd.assessed_value?.toLocaleString() ?? 'N/A'}`);
  console.log(`  Concluded Value:  $${pd.concluded_value?.toLocaleString() ?? 'N/A'}`);
  console.log(`  Year Built:       ${pd.year_built ?? 'N/A'}`);
  console.log(`  Living Area:      ${pd.building_sqft_living_area?.toLocaleString() ?? 'N/A'} sq ft`);
  console.log(`  Condition:        ${pd.overall_condition ?? 'N/A'}`);
}
console.log(`\n  Open in browser:  ${BASE_URL}/report/${reportId}\n`);
