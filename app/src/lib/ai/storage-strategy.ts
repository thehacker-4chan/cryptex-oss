/**
 * Storage strategy for BYOK provider records.
 *
 * Default: `localStorage` — persists across browser sessions, so users keep
 * their provider config + API keys on every visit.
 *
 * Opt-in ephemeral mode: `sessionStorage` — keys live only for the current
 * tab. Closing the tab clears them. For users who want stricter
 * compartmentalization (shared machines, screen-share / remote-desktop
 * sessions, paranoid threat models). The opt-in flag itself stays in
 * `localStorage` (otherwise it would clear on tab close, defeating the
 * persisted preference).
 *
 * Surface used by `providers.svelte.ts` and the SecurityPanel toggle.
 */

const PREF_KEY = 'cryptex.settings.ephemeralKeys';

/** Read the preference flag. Defaults to false (= localStorage). */
export function isEphemeralStorage(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(PREF_KEY) === '1';
  } catch {
    return false;
  }
}

/** Returns the active Storage object based on the preference. */
export function getKeyStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return isEphemeralStorage() ? sessionStorage : localStorage;
  } catch {
    return null;
  }
}

/**
 * Toggle ephemeral mode and migrate the listed keys between localStorage
 * and sessionStorage so the user does not have to re-enter them on flip.
 *
 * @param enabled  true → switch to sessionStorage, false → switch back to localStorage
 * @param keysToMigrate  array of storage keys (e.g. `['cryptex.providers']`)
 */
export function setEphemeralStorage(enabled: boolean, keysToMigrate: string[]): void {
  if (typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') return;
  const from = enabled ? localStorage : sessionStorage;
  const to = enabled ? sessionStorage : localStorage;
  for (const k of keysToMigrate) {
    try {
      const v = from.getItem(k);
      if (v !== null) {
        to.setItem(k, v);
        from.removeItem(k);
      }
    } catch {
      // best-effort — quota / SecurityError shouldn't kill the toggle
    }
  }
  try {
    if (enabled) localStorage.setItem(PREF_KEY, '1');
    else localStorage.removeItem(PREF_KEY);
  } catch {
    // ignore — preference flag set failure leaves us in current mode
  }
}

/** All BYOK-related storage keys subject to the ephemeral toggle. */
export const BYOK_STORAGE_KEYS: readonly string[] = [
  'cryptex.providers',
  'cryptex.openrouterApiKey' // legacy key, still seeded by providers.svelte.ts
];
