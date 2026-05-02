import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = {};
readFileSync('.env.local','utf8').split(/\r?\n/).forEach(l => {
  const eq = l.indexOf('=');
  if (eq > 0) {
    const k = l.slice(0,eq).trim();
    const v = l.slice(eq+1).trim().replace(/^['"]|['"]$/g,'');
    env[k] = v;
  }
});

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
sb.from('reports').delete()
  .eq('client_email','mikelaurenzo7@gmail.com')
  .in('status',['intake','paid','data_pull','processing'])
  .select('id')
  .then(({ data, error }) => {
    console.log('Deleted:', data?.length ?? 0, 'stale reports', error ? error.message : '(ok)');
    process.exit(0);
  });
