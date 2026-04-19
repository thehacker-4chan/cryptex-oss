<script lang="ts">
  import { runChain } from '$lib/chat/attack-chain';
  import type { LayerResultRow } from '$lib/chat/attack-chain';
  import type { ChatRow } from '$lib/chat/types';
  import { chat as gatewayChat } from '$lib/ai/gateway';
  import type { ChatMessage } from '$lib/ai/types';
  import * as Dialog from '$lib/components/ui/dialog';
  import LayerPicker from './LayerPicker.svelte';
  import LayerResult from './LayerResult.svelte';
  import Plus from 'lucide-svelte/icons/plus';
  import Play from 'lucide-svelte/icons/play';
  import Square from 'lucide-svelte/icons/square';
  import ArrowRight from 'lucide-svelte/icons/arrow-right';

  type Props = {
    open: boolean;
    chat: ChatRow;
    onInsertToComposer: (text: string) => void;
  };
  let { open = $bindable(), chat, onInsertToComposer }: Props = $props();

  const MAX_LAYERS = 4;

  let input = $state('');
  let layers = $state<string[]>(['', '']);
  let results = $state<LayerResultRow[]>([]);
  let running = $state(false);
  let ctrl = $state<AbortController | null>(null);

  const canRun = $derived(
    input.trim().length > 0 &&
    layers.length >= 2 &&
    layers.every((id) => id.trim().length > 0) &&
    !running
  );

  const finalOutput = $derived(
    results.length > 0 && !results[results.length - 1].error
      ? results[results.length - 1].output
      : null
  );

  function addLayer() {
    if (layers.length < MAX_LAYERS) layers = [...layers, ''];
  }

  function removeLayer(i: number) {
    layers = layers.filter((_, idx) => idx !== i);
  }

  function setLayer(i: number, id: string) {
    layers = layers.map((v, idx) => (idx === i ? id : v));
  }

  async function run() {
    if (!canRun) return;
    results = [];
    running = true;
    const abort = new AbortController();
    ctrl = abort;

    const signal = abort.signal;
    const modelId = chat.modelQualifiedId;

    const ctx = {
      model: modelId,
      callLLM: async (req: { system?: string; user: string; temperature?: number }) => {
        const msgs: ChatMessage[] = [];
        if (req.system) msgs.push({ role: 'system' as const, content: req.system });
        msgs.push({ role: 'user' as const, content: req.user });
        const resp = await gatewayChat({
          model: modelId,
          messages: msgs,
          temperature: req.temperature,
          signal
        });
        return resp.content;
      },
      signal
    };

    try {
      for await (const row of runChain(input, layers, ctx, signal)) {
        results = [...results, row];
        if (row.error) break;
      }
    } finally {
      running = false;
      ctrl = null;
    }
  }

  function abort() {
    ctrl?.abort();
  }

  function sendToComposer() {
    if (!finalOutput) return;
    onInsertToComposer(finalOutput);
    open = false;
  }
</script>

<Dialog.Root {open} onOpenChange={(v) => { open = v; }}>
  <Dialog.Content class="flex max-h-[90vh] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0">
    <Dialog.Header class="shrink-0 border-b border-border/50 px-5 py-4">
      <Dialog.Title class="flex items-center gap-2 text-base">
        <span>⚡</span> Attack Chain
      </Dialog.Title>
      <Dialog.Description class="text-xs text-muted-foreground">
        Compose 2–4 techniques in sequence and inspect each intermediate layer output.
      </Dialog.Description>
    </Dialog.Header>

    <div class="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 cryptex-scroll">
      <!-- Input -->
      <div class="flex flex-col gap-1.5">
        <label for="chain-input" class="text-xs font-semibold text-muted-foreground">
          Input prompt
        </label>
        <textarea
          id="chain-input"
          bind:value={input}
          rows="4"
          placeholder="Paste the raw attack prompt to layer through the chain…"
          class="w-full resize-none rounded-md border border-border/50 bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
        ></textarea>
      </div>

      <!-- Layer chain -->
      <div class="flex flex-col gap-2">
        <span class="text-xs font-semibold text-muted-foreground">
          Chain ({layers.length}/{MAX_LAYERS} layers)
        </span>
        {#each layers as id, i (i)}
          <LayerPicker
            index={i}
            value={id}
            onChange={(v) => setLayer(i, v)}
            onRemove={() => removeLayer(i)}
          />
        {/each}
        <button
          type="button"
          onclick={addLayer}
          disabled={layers.length >= MAX_LAYERS}
          class="flex items-center gap-1.5 self-start rounded-md border border-dashed border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus size={12} /> Add layer
        </button>
      </div>

      <!-- Run / abort -->
      <div class="flex items-center gap-3">
        {#if running}
          <button
            type="button"
            onclick={abort}
            class="flex items-center gap-1.5 rounded-md bg-destructive/90 px-4 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive"
          >
            <Square size={12} /> Cancel
          </button>
          <span class="text-xs text-muted-foreground">Running…</span>
        {:else}
          <button
            type="button"
            onclick={run}
            disabled={!canRun}
            class="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-40"
          >
            <Play size={12} /> Run chain
          </button>
        {/if}
      </div>

      <!-- Results -->
      {#if results.length > 0}
        <div class="flex flex-col gap-1.5">
          <span class="text-xs font-semibold text-muted-foreground">Results</span>
          {#each results as row (row.layerIndex)}
            <LayerResult {row} />
          {/each}
        </div>

        {#if finalOutput !== null}
          <button
            type="button"
            onclick={sendToComposer}
            class="flex items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <ArrowRight size={12} /> Send final output to current chat
          </button>
        {/if}
      {/if}
    </div>
  </Dialog.Content>
</Dialog.Root>
