/**
 * Run just stage 7 (PDF assembly) for a report that already has stages 1-6 data.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

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
    process.env[key] = val;
  }
} catch { /* no .env.local in CI */ }

const reportId = process.argv[2];
if (!reportId) {
  console.error('Usage: npx tsx scripts/run-stage7.ts <reportId>');
  process.exit(1);
}

async function main() {
  const { runPipeline } = await import('../src/lib/pipeline/orchestrator');
  console.log(`[run-stage7] Running stage 7 only for ${reportId}...`);
  const result = await runPipeline(reportId, 7);
  if (result.success) {
    console.log('[run-stage7] Stage 7 completed successfully.');
  } else {
    console.error('[run-stage7] FAILED:', result.error);
    process.exit(1);
  }
}

main();
