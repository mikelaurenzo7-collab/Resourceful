/**
 * scripts/rerun-report.ts
 * Directly triggers the pipeline for a given report ID.
 * Usage: npx tsx scripts/rerun-report.ts <reportId>
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local since dotenv/config only loads .env by default
const envPath = resolve(process.cwd(), '.env.local');
try {
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    // Last value in file wins (standard behavior); system env already set before Node startup
    process.env[key] = val;
  }
} catch {
  // .env.local may not exist in CI
}

const reportId = process.argv[2];
if (!reportId) {
  console.error('Usage: npx tsx scripts/rerun-report.ts <reportId>');
  process.exit(1);
}

async function main() {
  // Dynamic import ensures .env.local vars are set before any service module
  // captures process.env values at its own module-level const declarations.
  const { runPipeline } = await import('../src/lib/pipeline/orchestrator');
  console.log(`[rerun-report] Running pipeline for report ${reportId}...`);
  const result = await runPipeline(reportId, 1);
  if (result.success) {
    console.log('[rerun-report] Pipeline completed successfully.');
  } else {
    console.error('[rerun-report] Pipeline FAILED:', result.error);
    process.exit(1);
  }
}

main();
