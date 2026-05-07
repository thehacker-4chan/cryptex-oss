import { supabase } from './supabase';
import { session } from './session.svelte';

const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_HASH = 'SHA-256';
const AES_KEY_LENGTH = 256;
const SALT_BYTES = 32;
const IV_BYTES = 12;

// --- pure crypto helpers (unit-testable) ---------------------------------

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

export function generateIv(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_BYTES));
}

export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const mat = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
    mat,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptKey(plaintext: string, key: CryptoKey, iv: Uint8Array): Promise<ArrayBuffer> {
  return crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext) as BufferSource
  );
}

export async function decryptKey(ciphertext: ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<string> {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ciphertext);
  return new TextDecoder().decode(plain);
}

// --- high-level API --------------------------------------------------------

export type VaultKeyRow = {
  id: string;
  provider_id: string;
  instance_id: string | null;
  label: string | null;
  ciphertext: ArrayBuffer;
  iv: Uint8Array;
  salt: Uint8Array;
  kdf_iterations: number;
};

/** Attempt to unlock the vault with the given passphrase.
 *
 *  Returns `true` if:
 *  - the passphrase successfully decrypts the first stored row (new key cached), OR
 *  - the vault is empty (no rows to verify against — any passphrase "unlocks"; no key cached)
 *
 *  The empty-vault case clears any stale cached key from a prior session
 *  so a subsequent `storeBYOKKey` derives fresh state.
 */
export async function unlockVault(passphrase: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.from('byok_keys').select('*').limit(1);
  if (error) return false;
  if (!data || data.length === 0) {
    // No keys stored yet — treat this passphrase as the new master.
    // Clear any stale cached key from a prior session so a subsequent
    // storeBYOKKey derives fresh state.
    session._setVaultKey(null);
    return true;
  }
  const row = data[0] as unknown as { ciphertext: Uint8Array; iv: Uint8Array; salt: Uint8Array };
  try {
    const k = await deriveKey(passphrase, row.salt);
    await decryptKey(row.ciphertext.buffer as ArrayBuffer, k, row.iv);
    session._setVaultKey(k);
    return true;
  } catch {
    return false;
  }
}

export function lockVault(): void {
  session._setVaultKey(null);
}

/**
 * Decrypt and return every BYOK row owned by the current user.
 *
 * Requires the vault to already be unlocked — the cached CryptoKey is read
 * via `session._getVaultKey()`. Returns `[]` when the vault is locked, when
 * Supabase is not configured, or when the user has no rows.
 *
 * Used by `providers.svelte.ts` to hydrate the in-memory provider list with
 * decrypted apiKey strings on first access after sign-in or page reload.
 */
export async function listBYOKKeys(): Promise<Array<{
  id: string;
  providerId: string;
  instanceId: string | null;
  label: string | null;
  apiKey: string;
}>> {
  if (!supabase) return [];
  const cachedKey = session._getVaultKey();
  if (!cachedKey) return [];

  const { data, error } = await supabase.from('byok_keys').select('*');
  if (error || !data || data.length === 0) return [];

  const out: Array<{
    id: string;
    providerId: string;
    instanceId: string | null;
    label: string | null;
    apiKey: string;
  }> = [];

  for (const row of data as unknown as Array<{
    id: string;
    provider_id: string;
    instance_id: string | null;
    label: string | null;
    ciphertext: Uint8Array;
    iv: Uint8Array;
    salt: Uint8Array;
  }>) {
    try {
      // Single-salt-per-vault model: every row was encrypted with a key
      // derived from the same salt as the cached key, so one CryptoKey
      // decrypts every row. (The IV is per-row, which is required for
      // AES-GCM correctness.)
      const plain = await decryptKey(row.ciphertext.buffer as ArrayBuffer, cachedKey, row.iv);
      const parsed = JSON.parse(plain) as { providerId: string; apiKey: string };
      out.push({
        id: row.id,
        providerId: row.provider_id,
        instanceId: row.instance_id,
        label: row.label,
        apiKey: parsed.apiKey
      });
    } catch {
      // Pre-rollout rows that still have per-row salts will fail here.
      // Skip silently — the user can re-enter the key for that provider
      // and the next storeBYOKKey will reuse the canonical salt going
      // forward. After one full add-cycle the vault is migrated.
      continue;
    }
  }

  return out;
}

/**
 * Encrypt + store an apiKey using the already-cached vault CryptoKey. Use
 * this for the second-and-onwards key in a session — the first key (when
 * the vault is empty) must use `storeBYOKKey()` with a passphrase to seed
 * the canonical salt.
 *
 * Throws if: Supabase isn't configured / user not signed in / vault locked
 * / vault is empty (no canonical salt to extend). The caller should fall
 * back to `storeBYOKKey()` with a passphrase prompt when this throws
 * "Vault locked" or "Vault empty".
 */
export async function storeBYOKKeyWithVaultKey(
  providerId: string,
  instanceId: string | null,
  apiKey: string,
  label: string | null
): Promise<void> {
  if (!supabase) throw new Error('Auth not enabled');
  const user = session.currentUser;
  if (!user) throw new Error('Not signed in');
  const cachedKey = session._getVaultKey();
  if (!cachedKey) throw new Error('Vault locked');

  // Reuse the canonical salt so the cached key can decrypt this row later.
  const { data: existingRows, error: fetchErr } = await supabase
    .from('byok_keys')
    .select('salt')
    .limit(1);
  if (fetchErr) throw fetchErr;
  if (!existingRows || existingRows.length === 0) {
    throw new Error('Vault empty');
  }
  const salt = (existingRows[0] as unknown as { salt: Uint8Array }).salt;
  const iv = generateIv();
  const plaintext = JSON.stringify({ providerId, apiKey });
  const ciphertext = await encryptKey(plaintext, cachedKey, iv);

  const { error } = await supabase.from('byok_keys').upsert({
    owner_id: user.id,
    provider_id: providerId,
    instance_id: instanceId,
    label,
    ciphertext: new Uint8Array(ciphertext),
    iv,
    salt,
    kdf_iterations: PBKDF2_ITERATIONS,
    kdf_hash: PBKDF2_HASH
  });
  if (error) throw error;
}

export async function storeBYOKKey(
  providerId: string,
  instanceId: string | null,
  apiKey: string,
  label: string | null,
  passphrase: string
): Promise<void> {
  if (!supabase) throw new Error('Auth not enabled');
  const user = session.currentUser;
  if (!user) throw new Error('Not signed in');

  // All rows in a single user's vault must share the SAME salt so the
  // cached vault key (derived once at unlock) can decrypt every row. Per-row
  // salts would force re-deriving the key per row, requiring the passphrase
  // to stay in memory — which we don't want. The IV stays per-row (AES-GCM
  // correctness — IV reuse with the same key breaks the cipher).
  //
  // Lookup: read existing rows. If any exist, reuse the first row's salt.
  // Otherwise generate a fresh salt for the vault's lifetime.
  const { data: existingRows } = await supabase.from('byok_keys').select('salt').limit(1);
  const existingSalt = existingRows && existingRows.length > 0
    ? (existingRows[0] as unknown as { salt: Uint8Array }).salt
    : null;
  const salt = existingSalt ?? generateSalt();
  const iv = generateIv();
  const key = await deriveKey(passphrase, salt);
  const plaintext = JSON.stringify({ providerId, apiKey });
  const ciphertext = await encryptKey(plaintext, key, iv);

  const { error } = await supabase.from('byok_keys').upsert({
    owner_id: user.id,
    provider_id: providerId,
    instance_id: instanceId,
    label,
    ciphertext: new Uint8Array(ciphertext),
    iv,
    salt,
    kdf_iterations: PBKDF2_ITERATIONS,
    kdf_hash: PBKDF2_HASH
  });
  if (error) throw error;
  session._setVaultKey(key);
}

export async function rotatePassphrase(oldP: string, newP: string): Promise<void> {
  if (!supabase) throw new Error('Auth not enabled');
  const { data: fullRows, error: fetchErr } = await supabase.from('byok_keys').select('*');
  if (fetchErr || !fullRows) throw fetchErr ?? new Error('No vault');

  const rows = fullRows as unknown as Array<{
    id: string;
    owner_id: string;
    provider_id: string;
    instance_id: string | null;
    label: string | null;
    ciphertext: Uint8Array;
    iv: Uint8Array;
    salt: Uint8Array;
  }>;

  if (rows.length === 0) {
    // Empty vault — nothing to rotate. Still acceptable for "set new passphrase
    // before adding any keys" UX, but we don't have anything to cache yet.
    return;
  }

  // Decrypt all rows with the old passphrase. Pre `single-salt` rollout each
  // row had its own salt, post-rollout they all share one — both shapes are
  // handled uniformly by deriving a per-row key from `r.salt` here.
  const decrypted: Array<{ id: string; row: (typeof rows)[number]; plaintext: string }> = [];
  for (const r of rows) {
    const oldKey = await deriveKey(oldP, r.salt);
    const pt = await decryptKey(r.ciphertext.buffer as ArrayBuffer, oldKey, r.iv);
    decrypted.push({ id: r.id, row: r, plaintext: pt });
  }

  // Re-encrypt with the new passphrase under a SHARED fresh salt so the
  // cached vault key (derived once from this salt) can decrypt every row
  // post-rotation. Each row keeps its own IV.
  const sharedSalt = generateSalt();
  const newKey = await deriveKey(newP, sharedSalt);
  const updates = await Promise.all(
    decrypted.map(async (d) => {
      const iv = generateIv();
      const ct = await encryptKey(d.plaintext, newKey, iv);
      return {
        id: d.id,
        owner_id: d.row.owner_id,
        provider_id: d.row.provider_id,
        instance_id: d.row.instance_id,
        label: d.row.label,
        ciphertext: new Uint8Array(ct),
        iv,
        salt: sharedSalt,
        kdf_iterations: PBKDF2_ITERATIONS,
        kdf_hash: PBKDF2_HASH
      };
    })
  );

  // One atomic upsert — all rows update or none do (server-side statement).
  // Avoids the split-state risk of looping per-row updates.
  const { error: upErr } = await supabase.from('byok_keys').upsert(updates);
  if (upErr) throw upErr;

  session._setVaultKey(newKey);
}
