<script lang="ts">
  import {
    listProviders,
    hasLegacyPlaintextKeys,
    migrateLegacyKeysToVault,
    hydrateFromVault
  } from '$lib/ai/providers.svelte';
  import {
    isEphemeralStorage,
    setEphemeralStorage,
    BYOK_STORAGE_KEYS
  } from '$lib/ai/storage-strategy';
  import { featureFlags } from '$lib/config/featureFlags';
  import { session } from '$lib/auth/session.svelte';
  import { notify } from '$lib/stores/toast.svelte';
  import ProviderCard from './ProviderCard.svelte';
  import AddProviderDialog from './AddProviderDialog.svelte';
  import Plus from 'lucide-svelte/icons/plus';
  import ShieldAlert from 'lucide-svelte/icons/shield-alert';
  import KeyRound from 'lucide-svelte/icons/key-round';

  let dialogOpen = $state(false);
  // $derived re-reads the rune-backed list so this section re-renders on changes
  const providers = $derived(listProviders());

  // Local mirror of the persistent ephemeral-storage toggle.
  // Initialised from the helper (reads localStorage) at mount.
  let ephemeral = $state(isEphemeralStorage());

  function toggleEphemeral(next: boolean) {
    setEphemeralStorage(next, [...BYOK_STORAGE_KEYS]);
    ephemeral = next;
  }

  // ----- Legacy plaintext-key migration prompt -----
  // For signed-in users whose `cryptex.providers` localStorage value still
  // carries plaintext apiKey strings (pre-encrypted-vault rollout), offer a
  // one-click migration into the encrypted Supabase vault.
  const useVault = $derived(featureFlags.authEnabled && session.isSignedIn);
  let showMigrate = $state(false);
  let migratePassphrase = $state('');
  let migrateError = $state<string | null>(null);
  let migrating = $state(false);

  $effect(() => {
    if (!useVault) {
      showMigrate = false;
      return;
    }
    // Re-evaluate whenever auth state flips.
    showMigrate = hasLegacyPlaintextKeys();
  });

  // Auto-hydrate _records from the vault when the panel mounts and the
  // vault is already unlocked (e.g. user added a key earlier this session).
  $effect(() => {
    if (useVault && session.vaultUnlocked) {
      void hydrateFromVault();
    }
  });

  async function runMigration() {
    if (migratePassphrase.length === 0) return;
    migrating = true;
    migrateError = null;
    try {
      const n = await migrateLegacyKeysToVault(migratePassphrase);
      if (n > 0) {
        notify.success(`Encrypted ${n} key${n === 1 ? '' : 's'} into the vault`);
        showMigrate = false;
        migratePassphrase = '';
      } else {
        migrateError = 'No keys to migrate.';
      }
    } catch (err) {
      migrateError = (err as Error).message || 'Migration failed.';
    } finally {
      migrating = false;
    }
  }
</script>

<section class="space-y-4" id="providers">
  <header>
    <h2 class="font-serif text-xl font-semibold">Providers</h2>
    <p class="text-sm text-muted-foreground">Use your own API keys. Keys are stored only in your browser.</p>
  </header>

  {#if showMigrate}
    <div class="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
      <div class="flex items-center gap-2 text-sm font-medium">
        <KeyRound size={14} class="text-amber-400" />
        Move keys to encrypted vault
      </div>
      <p class="text-xs text-muted-foreground">
        Your provider API keys are currently stored as plaintext in this browser's
        local storage. Encrypting them with a passphrase moves the ciphertext to
        your Supabase account; the server never sees plaintext. You'll need this
        passphrase the next time you sign in on a fresh browser.
      </p>
      <input
        type="password"
        bind:value={migratePassphrase}
        placeholder="New vault passphrase"
        autocomplete="new-password"
        class="w-full rounded-md border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-xs"
        onkeydown={(e) => { if (e.key === 'Enter') runMigration(); }}
      />
      {#if migrateError}
        <p class="text-xs text-destructive">{migrateError}</p>
      {/if}
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          onclick={() => { showMigrate = false; }}
        >
          Not now
        </button>
        <button
          type="button"
          class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          onclick={runMigration}
          disabled={migrating || migratePassphrase.length === 0}
        >
          {migrating ? 'Encrypting…' : 'Encrypt and move'}
        </button>
      </div>
    </div>
  {/if}

  <label
    class="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card/40 p-3 transition-colors hover:bg-card/60"
  >
    <input
      type="checkbox"
      class="mt-0.5 h-4 w-4 cursor-pointer accent-primary"
      checked={ephemeral}
      onchange={(e) => toggleEphemeral((e.target as HTMLInputElement).checked)}
    />
    <span class="space-y-1 text-sm">
      <span class="flex items-center gap-1.5 font-medium">
        <ShieldAlert size={13} class="text-primary" />
        Clear keys when I close this tab
      </span>
      <span class="block text-xs text-muted-foreground">
        Stricter compartmentalization for shared / borrowed machines. Keys move to
        <code class="rounded bg-muted px-1 py-0.5 text-[10px]">sessionStorage</code>
        and are wiped when this tab closes — you'll re-paste them next session. Default
        is <code class="rounded bg-muted px-1 py-0.5 text-[10px]">localStorage</code>
        (keys persist across browser sessions).
      </span>
    </span>
  </label>

  {#if providers.length === 0}
    <div class="glass rounded-lg border border-dashed border-white/15 p-6 text-center text-sm text-muted-foreground">
      No providers configured yet. Add one to start using AI tools.
    </div>
  {/if}

  {#each providers as record (record.id + ((record as { instanceId?: string }).instanceId ?? ''))}
    <ProviderCard {record} />
  {/each}

  <button
    type="button"
    onclick={() => dialogOpen = true}
    class="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 px-4 py-6 text-sm text-muted-foreground hover:bg-white/5"
  >
    <Plus class="h-4 w-4" /> Add provider
  </button>
</section>

<AddProviderDialog open={dialogOpen} onClose={() => dialogOpen = false} />
