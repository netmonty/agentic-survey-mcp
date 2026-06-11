import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/** Read the initial migration SQL bundled with this package. */
export function readInitialMigrationSql(): string {
  // src/ (or dist/) -> package root -> migrations/
  return readFileSync(join(here, '..', 'migrations', '0001_init.sql'), 'utf8');
}
