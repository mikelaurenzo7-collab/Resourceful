import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

const failures = [];

async function exists(relativePath) {
  try {
    await access(path.join(repositoryRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function read(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), 'utf8');
}

async function collectFiles(directory, suffixes) {
  const absolute = path.join(repositoryRoot, directory);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(relative, suffixes)));
    } else if (suffixes.some((suffix) => entry.name.endsWith(suffix))) {
      files.push(relative);
    }
  }

  return files;
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const vercel = JSON.parse(await read('vercel.json'));
const crons = Array.isArray(vercel.crons) ? vercel.crons : [];
const functions = vercel.functions ?? {};

for (const cron of crons) {
  const routePath = `src/app${cron.path}/route.ts`;
  assert(
    await exists(routePath),
    `Vercel cron ${cron.path} has no route at ${routePath}`
  );
}

const workerCron = crons.find(
  (cron) => cron.path === '/api/cron/pipeline-worker'
);
assert(
  Boolean(workerCron),
  'Durable pipeline worker is missing from vercel.json crons'
);
assert(
  workerCron?.schedule === '* * * * *',
  'Durable pipeline worker must run every minute'
);

const workerFunction =
  functions['src/app/api/cron/pipeline-worker/route.ts'];
assert(
  Number(workerFunction?.maxDuration) >= 300,
  'Pipeline worker maxDuration must be at least 300 seconds'
);

const jurisdictionOperationsCron = crons.find(
  (cron) => cron.path === '/api/cron/jurisdiction-operations'
);
assert(
  Boolean(jurisdictionOperationsCron),
  'Jurisdiction operations reconciliation is missing from vercel.json crons'
);
assert(
  jurisdictionOperationsCron?.schedule === '0 12 * * *',
  'Jurisdiction operations reconciliation must run daily at 12:00 UTC'
);

const jurisdictionOperationsFunction =
  functions['src/app/api/cron/jurisdiction-operations/route.ts'];
assert(
  Number(jurisdictionOperationsFunction?.maxDuration) >= 120,
  'Jurisdiction operations reconciliation maxDuration must be at least 120 seconds'
);

assert(
  Number(
    functions['src/app/api/webhooks/stripe/route.ts']?.maxDuration
  ) <= 60,
  'Stripe webhook must remain a short ownership-establishment request'
);
assert(
  Number(
    functions[
      'src/app/api/admin/reports/[id]/rerun/route.ts'
    ]?.maxDuration
  ) <= 60,
  'Admin rerun must enqueue work instead of executing the pipeline inline'
);

const requiredQueueRoutes = [
  'src/app/api/reports/route.ts',
  'src/app/api/v1/reports/route.ts',
  'src/app/api/webhooks/stripe/route.ts',
  'src/app/api/admin/reports/[id]/rerun/route.ts',
  'src/app/api/cron/stale-pipeline/route.ts',
];

for (const routePath of requiredQueueRoutes) {
  const source = await read(routePath);
  assert(
    source.includes('enqueuePipelineRun'),
    `${routePath} does not establish durable queue ownership`
  );
}

const founderIngressRoute = await read('src/app/api/reports/route.ts');
assert(
  founderIngressRoute.includes("source: 'founder'") &&
    founderIngressRoute.includes('`founder:${report.id}`'),
  'Founder complimentary work is not explicitly identified and idempotently queued'
);

const partnerIngressRoute = await read('src/app/api/v1/reports/route.ts');
assert(
  partnerIngressRoute.includes("source: 'partner_api'") &&
    partnerIngressRoute.includes('Idempotency-Key') &&
    partnerIngressRoute.includes('claimPartnerReportRequest'),
  'Partner API work does not require private request idempotency before queue ownership'
);
assert(
  partnerIngressRoute.includes("status: 'intake'") &&
    partnerIngressRoute.includes("payment_status: 'partner_api_pending'") &&
    partnerIngressRoute.includes('PartnerMonthlyLimitError') &&
    partnerIngressRoute.includes("status: 'paid'") &&
    partnerIngressRoute.indexOf('trackApiUsage') < partnerIngressRoute.lastIndexOf("status: 'paid'"),
  'Partner API reports can become runnable before quota-safe usage accounting succeeds'
);

const apiFiles = await collectFiles('src/app/api', ['.ts', '.tsx']);
for (const apiFile of apiFiles) {
  const source = await read(apiFile);
  assert(
    !/\brunPipeline\s*\(/u.test(source),
    `${apiFile} calls the legacy inline pipeline`
  );
  assert(
    !source.includes("from '@/lib/pipeline/orchestrator'"),
    `${apiFile} imports the legacy inline pipeline orchestrator`
  );
}

const orchestrator = await read(
  'src/lib/pipeline/orchestrator.ts'
);
assert(
  !/Promise\.race\s*\(/u.test(orchestrator),
  'Legacy orchestrator still uses a non-cancelling Promise.race timeout'
);

const healthRoute = await read('src/app/api/health/route.ts');
assert(
  healthRoute.includes('getPipelineQueueHealth'),
  'Authenticated health checks do not verify the durable control plane'
);

const controlPlaneMigration = await read(
  'supabase/migrations/036_durable_pipeline_control_plane.sql'
);
assert(
  controlPlaneMigration.includes("status in ('failed', 'rejected', 'pending_approval')") &&
    controlPlaneMigration.includes('report_pdf_storage_path = null') &&
    controlPlaneMigration.includes(
      'currently leased and cannot be replaced safely'
    ),
  'Admin rerun reset is not atomic or does not protect an active worker lease'
);
assert(
  controlPlaneMigration.includes(
    'form_submissions_one_prefill_per_report_idx'
  ),
  'Stage 5 retry safety does not prevent duplicate filing prefills'
);

const directIngressMigration = await read(
  'supabase/migrations/038_partner_durable_ingress.sql'
);
assert(
  directIngressMigration.includes('partner_report_requests') &&
    directIngressMigration.includes('request_fingerprint') &&
    directIngressMigration.includes('partner_request_id'),
  'Partner API request idempotency is not backed by a private durable ledger'
);
assert(
  directIngressMigration.includes('partner_report_usage') &&
    directIngressMigration.includes('record_partner_report_usage'),
  'Partner API usage accounting is not idempotent per report'
);
assert(
  directIngressMigration.includes("date_trunc('month', now())") &&
    directIngressMigration.includes('for update') &&
    directIngressMigration.includes('Monthly report limit exceeded') &&
    directIngressMigration.includes('reports_this_month = v_current_month_count'),
  'Partner monthly quota is not enforced atomically from the immutable current-month usage ledger'
);
assert(
  directIngressMigration.includes("'founder'") &&
    directIngressMigration.includes("'partner_api'") &&
    directIngressMigration.includes("p_source <> 'admin'"),
  'Founder/partner queue sources are not distinct from privileged admin replacement work'
);

const partnerApiService = await read(
  'src/lib/services/partner-api-service.ts'
);
assert(
  partnerApiService.includes('record_partner_report_usage') &&
    !partnerApiService.includes("rpc('increment_partner_usage'"),
  'Partner API service still uses non-idempotent aggregate counter mutation'
);
assert(
  partnerApiService.includes('PartnerMonthlyLimitError') &&
    partnerApiService.includes('currentMonthStartIso') &&
    !partnerApiService.includes('reports_this_month >= partner.monthly_report_limit'),
  'Partner API service still treats the stale mutable monthly counter as quota authority'
);

const adminRerunRoute = await read(
  'src/app/api/admin/reports/[id]/rerun/route.ts'
);
assert(
  !adminRerunRoute.includes('updateReport('),
  'Admin rerun resets report state outside the queue transaction'
);

const durableRunner = await read('src/lib/pipeline/durable-runner.ts');
assert(
  durableRunner.includes(
    'stage.number === 7 && report.report_pdf_storage_path'
  ),
  'Stage 7 does not reconcile an already-published immutable artifact'
);

assert(
  await exists(
    'supabase/migrations/036_durable_pipeline_control_plane.sql'
  ),
  'Durable pipeline control-plane migration is missing'
);
assert(
  await exists('src/lib/pipeline/durable-runner.ts'),
  'Durable one-stage runner is missing'
);
assert(
  await exists('src/lib/pipeline/stage-registry.ts'),
  'Shared runtime stage registry is missing'
);
assert(
  await exists('supabase/migrations/037_operations_autopilot.sql'),
  'Jurisdiction operations control-plane migration is missing'
);
assert(
  await exists('supabase/migrations/038_partner_durable_ingress.sql'),
  'Durable founder/partner ingress migration is missing'
);
assert(
  await exists('src/app/api/cron/jurisdiction-operations/route.ts'),
  'Jurisdiction operations cron route is missing'
);
assert(
  await exists('src/lib/operations/jurisdiction-task-planner.test.ts'),
  'Jurisdiction operations planner regression tests are missing'
);
assert(
  await exists('src/app/admin/operations/page.tsx'),
  'Admin operations control tower is missing'
);

if (failures.length > 0) {
  console.error('Resourceful operability checks failed:');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Validated ${crons.length} Vercel crons, ${apiFiles.length} API files, durable paid-work ingress, quota-safe partner accounting, one-stage worker execution, and jurisdiction operations automation.`
  );
}
