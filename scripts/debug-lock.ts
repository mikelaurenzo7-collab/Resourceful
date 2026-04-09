import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
const lines = readFileSync(envPath, 'utf-8').split('\n');
for (const line of lines) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  const k = t.slice(0, eq).trim();
  const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  process.env[k] = v;
}

console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('KEY prefix:', process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 15));

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const r = await (sb.rpc as any)('acquire_pipeline_lock', { p_report_id: 'c1d17e75-058e-43d8-9140-0f96a7cc462d' });
  console.log('data:', r.data, 'error:', JSON.stringify(r.error));
  
  if (r.data) {
    // Release it
    await (sb.rpc as any)('release_pipeline_lock', { p_report_id: 'c1d17e75-058e-43d8-9140-0f96a7cc462d' });
    console.log('Lock released.');
  }
}

main();
