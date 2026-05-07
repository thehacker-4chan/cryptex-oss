<script lang="ts">
  import { listProviders } from '$lib/ai/providers.svelte';
  import {
    isEphemeralStorage,
    setEphemeralStorage,
    BYOK_STORAGE_KEYS
  } from '$lib/ai/storage-strategy';
  import ProviderCard from './ProviderCard.svelte';
  import AddProviderDialog from './AddProviderDialog.svelte';
  import Plus from 'lucide-svelte/icons/plus';
  import ShieldAlert from 'lucide-svelte/icons/shield-alert';

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
</script>

<section class="space-y-4" id="providers">
  <header>
    <h2 class="font-serif text-xl font-semibold">Providers</h2>
    <p class="text-sm text-muted-foreground">Use your own API keys. Keys are stored only in your browser.</p>
  </header>

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
