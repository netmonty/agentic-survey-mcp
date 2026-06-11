import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/** Read a bundled migration SQL file by name (e.g. `0002_add_question_types.sql`). */
export function readMigrationSql(file: string): string {
  // src/ (or dist/) -> package root -> migrations/
  return readFileSync(join(here, '..', 'migrations', file), 'utf8');
}

/** Read the initial migration SQL bundled with this package. */
export function readInitialMigrationSql(): string {
  return readMigrationSql('0001_init.sql');
}
