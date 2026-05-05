import { browser } from '$app/environment';

/** Central registry of runtime feature flags. Read from Vite env at build time. */
export const featureFlags = {
  /** When true, the auth UI is active and the app expects a Supabase project. */
  authEnabled: (() => {
    const raw = browser ? import.meta.env.VITE_AUTH_ENABLED : process.env.VITE_AUTH_ENABLED;
    return raw === 'true' || raw === '1';
  })(),
  /** When true, Godmode tab can run a browser-only orchestrator (no Supabase
   *  edge function, no auth required). Defaults to true; set
   *  PUBLIC_GODMODE_LOCAL_ENABLED=false to hide the local path. */
  godmodeLocalEnabled: (() => {
    const raw = browser
      ? import.meta.env.PUBLIC_GODMODE_LOCAL_ENABLED
      : process.env.PUBLIC_GODMODE_LOCAL_ENABLED;
    return raw !== 'false' && raw !== '0';
  })()
} as const;
