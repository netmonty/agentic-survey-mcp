import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * Connection config. The SECRET key lives only here (local file) or in env —
 * it is NEVER accepted as an MCP tool argument, so it never reaches the agent
 * or model provider. See docs/trust-model.md.
 */
export interface StoredConfig {
  supabaseUrl: string;
  secretKey: string;
  publishableKey?: string;
  /** Page-service base URL; defaults to the author's hosted instance. */
  pageEndpoint?: string;
}

export const DEFAULT_PAGE_ENDPOINT = 'https://pages.agentic-survey.dev';

export function configPath(): string {
  const base =
    process.env.AGENTIC_SURVEY_CONFIG ??
    join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'agentic-survey', 'config.json');
  return base;
}

/** Derive the Supabase project ref from the project URL. */
export function projectRefFromUrl(url: string): string | undefined {
  const m = url.match(/^https?:\/\/([a-z0-9]+)\.supabase\.(co|in|net)/i);
  return m?.[1];
}

function readFile(): Partial<StoredConfig> {
  const p = configPath();
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as Partial<StoredConfig>;
  } catch {
    return {};
  }
}

/**
 * Resolution order (per the brief): explicit args → local config file → env.
 * The server has no explicit secret args, so: file values win, env fills gaps.
 */
export function loadConfig(): Partial<StoredConfig> {
  const fromEnv: Partial<StoredConfig> = {
    supabaseUrl: process.env.SUPABASE_URL,
    secretKey: process.env.SUPABASE_SECRET_KEY,
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
    pageEndpoint: process.env.AGENTIC_SURVEY_PAGE_ENDPOINT,
  };
  const fromFile = readFile();
  // Drop undefined so file values aren't clobbered by missing env keys.
  const merged: Partial<StoredConfig> = { ...fromEnv };
  for (const [k, v] of Object.entries(fromFile)) {
    if (v !== undefined && v !== '') (merged as any)[k] = v;
  }
  return merged;
}

export function saveConfig(cfg: StoredConfig): string {
  const p = configPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
  try {
    chmodSync(p, 0o600); // ensure perms even if the file pre-existed
  } catch {
    /* best effort */
  }
  return p;
}

/** A config is "connectable" once it has a URL + secret key. */
export function isConnectable(cfg: Partial<StoredConfig>): cfg is StoredConfig {
  return Boolean(cfg.supabaseUrl && cfg.secretKey);
}
