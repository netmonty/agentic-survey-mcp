import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The injected database handle. `core` never reads global config — callers
 * build this from supplied credentials and pass it to every function.
 */
export type Db = SupabaseClient;

/**
 * Build a Supabase client from a project URL + SECRET key (`sb_secret_…`).
 * The secret key bypasses RLS; it lives only on the user's machine.
 */
export function createDb(url: string, secretKey: string): Db {
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
