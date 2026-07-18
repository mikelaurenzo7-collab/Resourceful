import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  parseMigrationFilename,
  validateMigrationDirectory,
} from './check-migration-lineage.mjs';

async function withMigrationDirectory(files, run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'resourceful-migrations-'));

  try {
    await Promise.all(
      files.map((filename) => writeFile(path.join(directory, filename), '-- test migration\n', 'utf8')),
    );
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('accepts canonical migration filenames', () => {
  assert.deepEqual(parseMigrationFilename('031_reconcile_legacy_lineage.sql'), {
    filename: '031_reconcile_legacy_lineage.sql',
    version: '031',
    slug: 'reconcile_legacy_lineage',
  });
});

test('rejects malformed migration filenames', () => {
  assert.throws(
    () => parseMigrationFilename('migration-031.sql'),
    /Expected NNN_descriptive_snake_case\.sql/,
  );
});

test('accepts a directory with unique migration versions', async () => {
  await withMigrationDirectory(
    ['001_initial_schema.sql', '002_add_reports.sql', '031_reconcile_legacy_lineage.sql'],
    async (directory) => {
      const result = await validateMigrationDirectory(directory);
      assert.deepEqual(result, {
        count: 3,
        firstVersion: '001',
        lastVersion: '031',
      });
    },
  );
});

test('rejects duplicate migration versions with actionable filenames', async () => {
  await withMigrationDirectory(
    ['029_claim_lease.sql', '029_rls_fix.sql'],
    async (directory) => {
      await assert.rejects(
        validateMigrationDirectory(directory),
        /029: 029_claim_lease\.sql, 029_rls_fix\.sql/,
      );
    },
  );
});
