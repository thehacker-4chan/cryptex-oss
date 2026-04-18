import { session } from './session.svelte';

function nsKey(key: string): string {
  return `cryptex.${session.currentUser.id}.${key}`;
}

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* quota / disabled */ }
}

function safeRemove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

export const keyVault = {
  get<T>(key: string): T | null {
    const raw = safeGet(nsKey(key));
    if (raw === null) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  },
  set<T>(key: string, value: T): void {
    safeSet(nsKey(key), JSON.stringify(value));
  },
  delete(key: string): void {
    safeRemove(nsKey(key));
  },
  /** Move `cryptex.<key>` → `cryptex.<userId>.<key>`, idempotent. */
  migrateLegacyKey(key: string): void {
    const legacy = `cryptex.${key}`;
    const target = nsKey(key);
    const legacyValue = safeGet(legacy);
    if (legacyValue === null) return;
    if (safeGet(target) !== null) { safeRemove(legacy); return; }
    safeSet(target, legacyValue);
    safeRemove(legacy);
  }
};
