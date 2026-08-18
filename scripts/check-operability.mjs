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
    `Validated ${crons.length} Vercel crons, ${apiFiles.length} API files, durable payment ownership, one-stage worker execution, and jurisdiction operations automation.`
  );
}
