import { browser } from '$app/environment';

/** Central registry of runtime feature flags. Read from Vite env at build time. */
export const featureFlags = {
  /** When true, the auth UI is active and the app expects a Supabase project. */
  authEnabled: (() => {
    const raw = browser ? import.meta.env.VITE_AUTH_ENABLED : process.env.VITE_AUTH_ENABLED;
    return raw === 'true' || raw === '1';
  })()
} as const;
