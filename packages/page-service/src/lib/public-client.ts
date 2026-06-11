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

/** Cloud projects: reconstruct the URL from a project ref carried in the link. */
export function urlFromRef(projectRef: string): string {
  return `https://${projectRef}.supabase.co`;
}
