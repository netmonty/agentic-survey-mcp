import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type PublicClient = SupabaseClient;

/**
 * Build a Supabase client from the user's PUBLISHABLE key (sb_publishable_…).
 * RLS-fenced: can read published surveys + insert responses/answers, nothing
 * else (verified in the spike). This is the only key the page-service ever holds,
 * and it arrives with the share link.
 */
export function createPublicClient(supabaseUrl: string, publishableKey: string): PublicClient {
  return createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Supabase project refs are exactly 20 lowercase alphanumerics. Validating
 * before interpolation stops a crafted `ref` (e.g. containing `/`, `#`, `@`)
 * from pointing the URL host somewhere other than *.supabase.co — i.e. it
 * closes an SSRF on the server-side submit path and constrains rendering to
 * genuine Supabase projects.
 */
const PROJECT_REF = /^[a-z0-9]{20}$/;

export function isValidProjectRef(ref: unknown): ref is string {
  return typeof ref === 'string' && PROJECT_REF.test(ref);
}

/** Cloud projects: reconstruct the URL from a project ref carried in the link. */
export function urlFromRef(projectRef: string): string {
  if (!isValidProjectRef(projectRef)) {
    throw new Error('Invalid Supabase project ref.');
  }
  return `https://${projectRef}.supabase.co`;
}
