<script lang="ts">
  import {
    addProvider,
    updateProvider,
    listProviders,
    persistKeyToVault
  } from '$lib/ai/providers.svelte';
  import { OPENAI_COMPAT_PRESETS } from '$lib/ai/presets';
  import type { ProviderRecord } from '$lib/ai/types';
  import { GatewayError } from '$lib/ai/types';
  import { openrouterAdapter } from '$lib/ai/adapters/openrouter';
  import { anthropicAdapter } from '$lib/ai/adapters/anthropic';
  import { openaiCompatAdapter } from '$lib/ai/adapters/openai-compat';
  import ErrorBanner from '$lib/components/ai/ErrorBanner.svelte';
  import { featureFlags } from '$lib/config/featureFlags';
  import { session } from '$lib/auth/session.svelte';
  import X from 'lucide-svelte/icons/x';
  import KeyRound from 'lucide-svelte/icons/key-round';

  type Props = { open: boolean; onClose: () => void };
  let { open, onClose }: Props = $props();

  let step = $state<'picker' | 'form'>('picker');
  let chosen = $state<'openrouter' | 'anthropic' | 'custom-preset' | null>(null);
  let chosenPresetId = $state<string>('groq');

  function pickOpenRouter() { chosen = 'openrouter'; step = 'form'; }
  function pickAnthropic() { chosen = 'anthropic'; step = 'form'; }
  function pickPreset(id: string) { chosenPresetId = id; chosen = 'custom-preset'; step = 'form'; }

  let apiKey = $state('');
  let name = $state('');
  let baseURL = $state('');
  let testModel = $state('');

  let verifying = $state(false);
  let verifyError = $state<GatewayError | null>(null);
  let abortCtrl: AbortController | null = null;

  // ----- Encrypted-vault flow (signed-in path) -----
  // When the user is signed in, API keys persist as encrypted ciphertext in
  // the Supabase `byok_keys` table (PBKDF2 600k + AES-GCM). The vault is
  // unlocked once per session — only the first key needs a passphrase to
  // seed the canonical salt; subsequent keys reuse the cached CryptoKey via
  // persistKeyToVault(rec) without re-prompting.
  const useVault = $derived(featureFlags.authEnabled && session.isSignedIn);
  let vaultPassphrase = $state('');
  let vaultPromptOpen = $state(false);
  let vaultPromptMode = $state<'setup' | 'unlock'>('setup');
  let pendingRecord = $state<ProviderRecord | null>(null);
  let vaultError = $state<string | null>(null);

  $effect(() => {
    if (chosenPresetId && chosen === 'custom-preset') {
      const p = OPENAI_COMPAT_PRESETS.find((x) => x.id === chosenPresetId);
      if (p) { name = p.name; baseURL = p.baseURL; }
    }
  });

  // Derived booleans to know if a singleton provider already exists
  const hasOpenRouter = $derived(listProviders().some((p) => p.id === 'openrouter'));
  const hasAnthropic = $derived(listProviders().some((p) => p.id === 'anthropic'));

  /** Build the ProviderRecord that persistRecord() will save. Centralised so
   *  saveWithoutVerify(), save(), and the post-passphrase-prompt callback
   *  all build the same shape. */
  function buildRecord(): ProviderRecord | null {
    if (chosen === 'openrouter') {
      return { id: 'openrouter', apiKey: apiKey.trim(), enabled: true };
    }
    if (chosen === 'anthropic') {
      return { id: 'anthropic', apiKey: apiKey.trim(), enabled: true };
    }
    if (chosen === 'custom-preset') {
      const preset = OPENAI_COMPAT_PRESETS.find((p) => p.id === chosenPresetId)!;
      const isCustom = preset.id === 'custom';
      const effectiveTestModel = isCustom ? testModel.trim() : (preset.defaultTestModel ?? '');
      return {
        id: 'openai-compat',
        instanceId: crypto.randomUUID(),
        name: name.trim() || preset.name,
        presetId: preset.id,
        baseURL: baseURL.trim() || preset.baseURL,
        apiKey: apiKey.trim(),
        testModel: effectiveTestModel,
        enabled: true
      };
    }
    return null;
  }

  /** Persist the record to the right backing store: encrypted vault for
   *  signed-in users (with passphrase prompt for the first key per vault),
   *  plaintext localStorage for everyone else. Resolves to true on success,
   *  false when the vault prompt has taken over (caller should not close). */
  async function persistRecord(record: ProviderRecord): Promise<boolean> {
    // Update the in-memory + localStorage-mirror record first. For unsigned
    // users this is the only step; for signed-in users the apiKey gets
    // stripped in providers.svelte.ts persist() and the encrypted ciphertext
    // is written via persistKeyToVault() below.
    if (chosen === 'openrouter') {
      if (hasOpenRouter) updateProvider('openrouter', { apiKey: record.apiKey });
      else addProvider(record);
    } else if (chosen === 'anthropic') {
      if (hasAnthropic) updateProvider('anthropic', { apiKey: record.apiKey });
      else addProvider(record);
    } else if (chosen === 'custom-preset') {
      addProvider(record);
    }

    if (!useVault) return true;

    // Try the cached-key fast-path first. Falls through to passphrase prompt
    // when vault is locked or empty.
    try {
      await persistKeyToVault(record);
      return true;
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === 'Vault locked' || msg === 'Vault empty') {
        // Surface the inline passphrase prompt — it'll call persistKeyToVault
        // a second time with the entered passphrase.
        pendingRecord = record;
        vaultPromptMode = msg === 'Vault empty' ? 'setup' : 'unlock';
        vaultPassphrase = '';
        vaultError = null;
        vaultPromptOpen = true;
        return false;
      }
      // Any other failure (Supabase network, etc.) — surface to user.
      verifyError = new GatewayError(`Could not encrypt key: ${msg}`, {
        category: 'unknown',
        provider: record.id
      });
      return false;
    }
  }

  async function submitVaultPassphrase() {
    if (!pendingRecord || vaultPassphrase.length === 0) return;
    vaultError = null;
    try {
      await persistKeyToVault(pendingRecord, vaultPassphrase);
      vaultPromptOpen = false;
      vaultPassphrase = '';
      pendingRecord = null;
      close();
    } catch (err) {
      vaultError = (err as Error).message || 'Vault unlock failed.';
    }
  }

  async function saveWithoutVerify() {
    // Bail out of the verify path and persist the provider as-is. Used when
    // the probe fails with a transient network / CORS-looking error but the
    // user knows the provider works (e.g. they just tested it elsewhere).
    verifyError = null;
    const record = buildRecord();
    if (!record) return;
    const ok = await persistRecord(record);
    if (ok) close();
  }

  async function save() {
    verifying = true;
    verifyError = null;
    abortCtrl?.abort();
    abortCtrl = new AbortController();

    try {
      // Validate the key with the provider FIRST so we never persist a key
      // that doesn't work. The persist + (optional) vault-encrypt step
      // happens only after a clean validateKey() return.
      const trimmed = apiKey.trim();
      if (chosen === 'openrouter') {
        const provisional: Extract<ProviderRecord, { id: 'openrouter' }> = {
          id: 'openrouter',
          apiKey: trimmed,
          enabled: true
        };
        await openrouterAdapter(provisional).validateKey(trimmed, abortCtrl.signal);
      } else if (chosen === 'anthropic') {
        const provisional: Extract<ProviderRecord, { id: 'anthropic' }> = {
          id: 'anthropic',
          apiKey: trimmed,
          enabled: true
        };
        await anthropicAdapter(provisional).validateKey(trimmed, abortCtrl.signal);
      } else if (chosen === 'custom-preset') {
        const preset = OPENAI_COMPAT_PRESETS.find((p) => p.id === chosenPresetId)!;
        const isCustom = preset.id === 'custom';
        const effectiveTestModel = isCustom ? testModel.trim() : (preset.defaultTestModel ?? '');
        if (isCustom && !effectiveTestModel) {
          verifyError = new GatewayError('Test model is required for custom endpoints.', {
            category: 'format',
            provider: 'openai-compat'
          });
          verifying = false;
          return;
        }
        const record: Extract<ProviderRecord, { id: 'openai-compat' }> = {
          id: 'openai-compat',
          instanceId: crypto.randomUUID(),
          name: name.trim() || preset.name,
          presetId: preset.id,
          baseURL: baseURL.trim() || preset.baseURL,
          apiKey: trimmed,
          testModel: effectiveTestModel,
          enabled: true
        };
        await openaiCompatAdapter(record).validateKey(trimmed, abortCtrl.signal);
      }
      // Validation succeeded — build the record and persist via the right
      // backing store (encrypted vault when signed in, plaintext otherwise).
      const record = buildRecord();
      if (!record) return;
      const ok = await persistRecord(record);
      if (ok) close();
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      verifyError =
        e instanceof GatewayError
          ? e
          : new GatewayError('Verification failed', { category: 'unknown', provider: 'openrouter' });
    } finally {
      verifying = false;
    }
  }

  function reset() {
    step = 'picker';
    chosen = null;
    apiKey = '';
    name = '';
    baseURL = '';
    testModel = '';
    verifyError = null;
    abortCtrl?.abort();
    abortCtrl = null;
  }
  function close() { reset(); onClose(); }

  const saveDisabled = $derived(
    verifying ||
    !apiKey.trim() ||
    (chosen === 'custom-preset' && chosenPresetId === 'custom' && !testModel.trim())
  );
</script>

{#if open}
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Add a provider" tabindex="-1" onclick={close} onkeydown={(e) => e.key === 'Escape' && close()}>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div role="document" class="glass w-full max-w-md rounded-xl border border-white/10 p-5 space-y-4" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Add a provider</h2>
        <button type="button" onclick={close} aria-label="Close"><X class="h-4 w-4" /></button>
      </div>

      {#if step === 'picker'}
        <div class="space-y-1">
          <p class="text-xs uppercase text-muted-foreground">Direct</p>
          {#if !hasOpenRouter}
            <button type="button" onclick={pickOpenRouter} class="w-full rounded-md px-3 py-2 text-left hover:bg-white/5">OpenRouter</button>
          {/if}
          {#if !hasAnthropic}
            <button type="button" onclick={pickAnthropic} class="w-full rounded-md px-3 py-2 text-left hover:bg-white/5">Anthropic</button>
          {/if}
          {#if hasOpenRouter && hasAnthropic}
            <p class="px-3 py-1 text-xs text-muted-foreground italic">All direct providers already configured.</p>
          {/if}

          <p class="mt-4 text-xs uppercase text-muted-foreground">OpenAI-compatible</p>
          {#each OPENAI_COMPAT_PRESETS.filter((p) => p.id !== 'custom') as p (p.id)}
            <button type="button" onclick={() => pickPreset(p.id)} class="w-full rounded-md px-3 py-2 text-left hover:bg-white/5">{p.name}</button>
          {/each}
          <button type="button" onclick={() => pickPreset('custom')} class="w-full rounded-md px-3 py-2 text-left hover:bg-white/5">Custom endpoint</button>
        </div>
        <p class="mt-4 text-xs text-muted-foreground">
          Every provider above works direct from your browser. Paste your API key from the provider's own dashboard — it stays on this device.
        </p>
      {:else if chosen === 'openrouter'}
        <label class="block text-sm">
          OpenRouter API key
          <input type="password" bind:value={apiKey} class="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-xs" />
        </label>
        {#if verifyError}
          <ErrorBanner error={verifyError} providerName="OpenRouter" />
        {/if}
        <div class="flex flex-wrap justify-end gap-2">
          <button type="button" class="px-3 py-1.5 text-sm" onclick={reset}>Back</button>
          {#if verifyError && (verifyError.category === 'network' || verifyError.category === 'cors' || verifyError.category === 'server_unavailable' || verifyError.category === 'unknown')}
            <button type="button" class="rounded-md border border-border/60 px-3 py-1.5 text-sm hover:bg-muted/40" onclick={saveWithoutVerify}>
              Save without verification
            </button>
          {/if}
          <button type="button" class="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50" onclick={save} disabled={saveDisabled}>
            {verifying ? 'Verifying…' : (verifyError ? 'Retry' : 'Save')}
          </button>
        </div>
      {:else if chosen === 'anthropic'}
        <label class="block text-sm">
          Anthropic API key
          <input type="password" bind:value={apiKey} class="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-xs" />
        </label>
        {#if verifyError}
          <ErrorBanner error={verifyError} providerName="Anthropic" />
        {/if}
        <div class="flex flex-wrap justify-end gap-2">
          <button type="button" class="px-3 py-1.5 text-sm" onclick={reset}>Back</button>
          {#if verifyError && (verifyError.category === 'network' || verifyError.category === 'cors' || verifyError.category === 'server_unavailable' || verifyError.category === 'unknown')}
            <button type="button" class="rounded-md border border-border/60 px-3 py-1.5 text-sm hover:bg-muted/40" onclick={saveWithoutVerify}>
              Save without verification
            </button>
          {/if}
          <button type="button" class="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50" onclick={save} disabled={saveDisabled}>
            {verifying ? 'Verifying…' : (verifyError ? 'Retry' : 'Save')}
          </button>
        </div>
      {:else if chosen === 'custom-preset'}
        <label class="block text-sm">
          Name
          <input type="text" bind:value={name} class="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-1.5 text-sm" />
        </label>
        <label class="block text-sm">
          Base URL
          <input type="url" bind:value={baseURL} class="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-xs" />
        </label>
        <label class="block text-sm">
          API key
          <input type="password" bind:value={apiKey} class="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-xs" />
        </label>
        {#if chosenPresetId === 'custom'}
          <label class="block text-sm">
            Test model <span class="text-muted-foreground">(required — used to probe the key before saving)</span>
            <input type="text" bind:value={testModel} placeholder="e.g. gpt-3.5-turbo" class="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-xs" />
          </label>
        {/if}
        {#if verifyError}
          <ErrorBanner error={verifyError} providerName={name.trim() || 'the endpoint'} />
        {/if}
        <div class="flex flex-wrap justify-end gap-2">
          <button type="button" class="px-3 py-1.5 text-sm" onclick={reset}>Back</button>
          {#if verifyError && (verifyError.category === 'network' || verifyError.category === 'cors' || verifyError.category === 'server_unavailable' || verifyError.category === 'unknown')}
            <button type="button" class="rounded-md border border-border/60 px-3 py-1.5 text-sm hover:bg-muted/40" onclick={saveWithoutVerify}>
              Save without verification
            </button>
          {/if}
          <button type="button" class="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50" onclick={save} disabled={saveDisabled || !baseURL.trim()}>
            {verifying ? 'Verifying…' : (verifyError ? 'Retry' : 'Save')}
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Vault passphrase prompt: shown when persistKeyToVault throws
       "Vault locked" / "Vault empty". Modal-on-modal — sits on top of
       the AddProviderDialog so the validated apiKey state is preserved. -->
  {#if vaultPromptOpen}
    <div
      class="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Vault passphrase"
      tabindex="-1"
      onclick={() => { vaultPromptOpen = false; pendingRecord = null; }}
      onkeydown={(e) => { if (e.key === 'Escape') { vaultPromptOpen = false; pendingRecord = null; } }}
    >
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div
        role="document"
        class="glass w-full max-w-sm space-y-4 rounded-xl border border-white/10 p-5"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
      >
        <div class="flex items-center gap-2">
          <KeyRound size={16} class="text-primary" />
          <h3 class="font-serif text-lg">
            {vaultPromptMode === 'setup' ? 'Set vault passphrase' : 'Unlock vault'}
          </h3>
        </div>
        <p class="text-xs text-muted-foreground">
          {#if vaultPromptMode === 'setup'}
            Choose a passphrase to encrypt your API keys. Keys are stored as
            ciphertext in your account; the server never sees plaintext.
            You'll need this passphrase to use AI tools after sign-in.
          {:else}
            Enter the passphrase you set when first adding a key. Keys live
            encrypted in your account and only this passphrase can decrypt them.
          {/if}
        </p>
        <input
          type="password"
          bind:value={vaultPassphrase}
          placeholder={vaultPromptMode === 'setup' ? 'New passphrase' : 'Passphrase'}
          autocomplete={vaultPromptMode === 'setup' ? 'new-password' : 'current-password'}
          class="w-full rounded-md border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-xs"
          onkeydown={(e) => { if (e.key === 'Enter') submitVaultPassphrase(); }}
        />
        {#if vaultError}
          <p class="text-xs text-destructive">{vaultError}</p>
        {/if}
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="px-3 py-1.5 text-sm"
            onclick={() => { vaultPromptOpen = false; pendingRecord = null; vaultError = null; }}
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
            onclick={submitVaultPassphrase}
            disabled={vaultPassphrase.length === 0}
          >
            {vaultPromptMode === 'setup' ? 'Save and encrypt' : 'Unlock'}
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}
