import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { featureFlags } from '$lib/config/featureFlags';

/** Null when VITE_AUTH_ENABLED is off. Callers MUST null-check before use. */
export const supabase: SupabaseClient | null = (() => {
  if (!featureFlags.authEnabled) return null;
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('[auth] VITE_AUTH_ENABLED=true but PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY missing.');
    return null;
  }
  return createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
})();
