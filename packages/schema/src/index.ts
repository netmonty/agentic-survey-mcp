export * from './types.js';
export { readInitialMigrationSql, readMigrationSql } from './migration.js';

/** Path (relative to this package) of the initial schema migration SQL. */
export const INITIAL_MIGRATION = '0001_init.sql';

/** All migrations in apply order. 0001 is the full schema; later files are upgrades. */
export const MIGRATIONS = ['0001_init.sql', '0002_add_question_types.sql'];
