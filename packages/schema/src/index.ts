export * from './types.js';
export { readInitialMigrationSql } from './migration.js';

/** Path (relative to this package) of the initial schema migration SQL. */
export const INITIAL_MIGRATION = '0001_init.sql';
