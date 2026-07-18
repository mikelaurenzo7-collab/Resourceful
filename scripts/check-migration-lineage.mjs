import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MIGRATION_FILE_PATTERN = /^(\d{3,})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;

export function parseMigrationFilename(filename) {
  const match = MIGRATION_FILE_PATTERN.exec(filename);
  if (!match) {
    throw new Error(
      `Invalid migration filename "${filename}". Expected NNN_descriptive_snake_case.sql.`,
    );
  }

  return {
    filename,
    version: match[1],
    slug: match[2],
  };
}

export async function validateMigrationDirectory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const migrationFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'en'));

  if (migrationFiles.length === 0) {
    throw new Error(`No SQL migrations found in ${directory}.`);
  }

  const parsed = migrationFiles.map(parseMigrationFilename);
  const filenamesByVersion = new Map();

  for (const migration of parsed) {
    const existing = filenamesByVersion.get(migration.version) ?? [];
    existing.push(migration.filename);
    filenamesByVersion.set(migration.version, existing);
  }

  const duplicates = [...filenamesByVersion.entries()]
    .filter(([, filenames]) => filenames.length > 1)
    .map(([version, filenames]) => `${version}: ${filenames.join(', ')}`);

  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate Supabase migration versions detected:\n${duplicates
        .map((duplicate) => `  - ${duplicate}`)
        .join('\n')}`,
    );
  }

  return {
    count: parsed.length,
    firstVersion: parsed[0].version,
    lastVersion: parsed.at(-1).version,
  };
}

async function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const migrationDirectory = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(repositoryRoot, 'supabase', 'migrations');

  const result = await validateMigrationDirectory(migrationDirectory);
  console.log(
    `Validated ${result.count} Supabase migrations (${result.firstVersion} through ${result.lastVersion}) with unique versions.`,
  );
}

const invokedAsScript = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false;

if (invokedAsScript) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
