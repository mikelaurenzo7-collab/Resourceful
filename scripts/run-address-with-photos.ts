/**
 * scripts/run-address-with-photos.ts
 *
 * Creates a local test report, uploads provided photos directly to Supabase,
 * and runs the full pipeline (stages 1-7).
 *
 * Usage:
 *   npx tsx scripts/run-address-with-photos.ts "5633 N Kenmore" "Chicago" "IL" "Cook County" "17031" "C:\\img\\1.jpg" "C:\\img\\2.jpg"
 */

import { existsSync, readFileSync, createWriteStream } from 'fs';
import { basename, extname, resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database';
import { generateReportAccessToken } from '../src/lib/utils/report-access';

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    process.env[key] = val;
  }
}

function inferContentType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.heic') return 'image/heic';
  if (ext === '.heif') return 'image/heif';
  return 'application/octet-stream';
}

async function main() {
  loadEnvLocal();

  const [address, city, state, county, countyFips, ...imagePaths] = process.argv.slice(2);

  if (!address || !city || !state || !county || !countyFips || imagePaths.length === 0) {
    console.error('Usage: npx tsx scripts/run-address-with-photos.ts "address" "city" "state" "county" "countyFips" "img1" ["img2" ...]');
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is required in environment or .env.local');
    process.exit(1);
  }

  const badPath = imagePaths.find((p) => !existsSync(p));
  if (badPath) {
    console.error(`Image file not found: ${badPath}`);
    process.exit(1);
  }

  const logFile = `pipeline-run-${Date.now()}.log`;
  const logStream = createWriteStream(logFile, { flags: 'a' });
  const log = (msg: string) => {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    logStream.write(`${line}\n`);
  };

  const sb = createClient<Database>(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  log(`Starting pipeline test for ${address}, ${city}, ${state}`);

  const { data: report, error: reportErr } = await sb
    .from('reports')
    .insert({
      user_id: null,
      client_email: 'jordan@resourceful.dev',
      client_name: 'Jordan (Photo Address Test)',
      status: 'paid',
      service_type: 'tax_appeal',
      property_type: 'residential',
      property_address: address,
      city,
      state,
      state_abbreviation: state,
      county,
      county_fips: countyFips,
      pin: null,
      latitude: null,
      longitude: null,
      report_pdf_storage_path: null,
      admin_notes: 'Local scripted address+photos test',
      stripe_payment_intent_id: null,
      payment_status: 'founder_access',
      amount_paid_cents: 0,
      review_tier: 'expert_reviewed',
      photos_skipped: false,
      property_issues: [],
      additional_notes: 'Created by scripts/run-address-with-photos.ts',
      desired_outcome: 'Verify local pipeline with user-provided photos',
      has_tax_bill: false,
      tax_bill_assessed_value: null,
      tax_bill_tax_amount: null,
      tax_bill_tax_year: null,
      pipeline_last_completed_stage: null,
      pipeline_error_log: null,
      pipeline_started_at: null,
      pipeline_completed_at: null,
      approved_at: null,
      approved_by: null,
      delivered_at: null,
      filing_status: 'not_started',
      filed_at: null,
      filing_method: null,
      appeal_outcome: null,
      savings_amount_cents: null,
    })
    .select('id')
    .single();

  if (reportErr || !report) {
    log(`Failed to create report: ${reportErr?.message || 'unknown error'}`);
    process.exit(1);
  }

  const reportId = report.id;
  log(`Created report: ${reportId}`);

  for (let i = 0; i < imagePaths.length; i += 1) {
    const imagePath = imagePaths[i];
    const ext = extname(imagePath).toLowerCase() || '.jpg';
    const contentType = inferContentType(imagePath);
    const storagePath = `${reportId}/uploaded_${String(i + 1).padStart(2, '0')}_${Date.now()}${ext}`;

    const fileBuffer = readFileSync(imagePath);

    const { error: uploadErr } = await sb.storage
      .from('photos')
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: false,
      });

    if (uploadErr) {
      log(`Upload failed (${basename(imagePath)}): ${uploadErr.message}`);
      process.exit(1);
    }

    const { error: photoErr } = await sb.from('photos').insert({
      report_id: reportId,
      storage_path: storagePath,
      photo_type: 'deferred_maintenance',
      caption: `Uploaded test photo ${i + 1}`,
      sort_order: i,
      ai_analysis: null,
    });

    if (photoErr) {
      log(`Photo row insert failed (${basename(imagePath)}): ${photoErr.message}`);
      process.exit(1);
    }

    log(`Uploaded photo ${i + 1}/${imagePaths.length}: ${basename(imagePath)}`);
  }

  const { runPipeline } = await import('../src/lib/pipeline/orchestrator');
  log('Running pipeline (stages 1-7)...');

  const result = await runPipeline(reportId, 1);
  if (!result.success) {
    log(`Pipeline failed: ${result.error || 'unknown error'}`);
    process.exit(1);
  }

  const { runDelivery } = await import('../src/lib/pipeline/stages/stage8-delivery');
  log('Running delivery (stage 8)...');

  const deliveryResult = await runDelivery(reportId, null, sb);
  if (!deliveryResult.success) {
    log(`Delivery failed: ${deliveryResult.error || 'unknown error'}`);
    process.exit(1);
  }

  const accessToken = generateReportAccessToken(reportId);

  const { data: finalReport } = await sb
    .from('reports')
    .select('status,pipeline_last_completed_stage,report_pdf_storage_path,delivered_at')
    .eq('id', reportId)
    .single();

  log(`Pipeline success for report ${reportId}`);
  log(`Status: ${finalReport?.status || 'unknown'}`);
  log(`Last stage: ${finalReport?.pipeline_last_completed_stage || 'unknown'}`);
  log(`PDF path: ${finalReport?.report_pdf_storage_path || 'not generated'}`);
  log(`Delivered at: ${finalReport?.delivered_at || 'not delivered'}`);
  log(`Open report: http://localhost:3000/report/${reportId}?token=${accessToken}`);
  log(`Local run log saved to ${logFile}`);

  logStream.end();
}

main().catch((err) => {
  console.error('Unhandled error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
