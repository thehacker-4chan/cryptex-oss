<script lang="ts">
  import {
    buildToolPayload,
    TOOL_NAME_PRESETS,
    PROVIDER_LABELS,
    KIND_LABELS,
    KIND_DESCRIPTIONS,
    DEFAULT_INSTRUCTION,
    type ToolPayloadProvider,
    type ToolPayloadKind,
    type ToolInjectionResult
  } from '$lib/redteam/tool-injection';
  import { notify } from '$lib/stores/toast.svelte';
  import { useToolState } from '$lib/stores/tool-state.svelte';
  import Copy from 'lucide-svelte/icons/copy';
  import Wrench from 'lucide-svelte/icons/wrench';
  import UsageHint from '$lib/components/shell/UsageHint.svelte';

  const kind = useToolState<ToolPayloadKind>('tool-result-lab', 'kind', 'tool-result-injection');
  const provider = useToolState<ToolPayloadProvider>('tool-result-lab', 'provider', 'openai');
  const toolName = useToolState<string>('tool-result-lab', 'toolName', 'web_search');
  const hiddenInstruction = useToolState<string>('tool-result-lab', 'hiddenInstruction', DEFAULT_INSTRUCTION);
  const argsJson = useToolState<string>('tool-result-lab', 'argsJson', '{"query": "context"}');
  let argsParseError = $state<string>('');
  let result = $state<ToolInjectionResult | null>(null);

  function regenerate() {
    let parsedArgs: Record<string, unknown> | undefined;
    if (argsJson.value.trim()) {
      try {
        parsedArgs = JSON.parse(argsJson.value);
        argsParseError = '';
      } catch (e) {
        argsParseError = (e as Error).message;
        result = null;
        return;
      }
    }
    if (!hiddenInstruction.value.trim()) {
      result = null;
      return;
    }
    try {
      result = buildToolPayload({
        kind: kind.value,
        provider: provider.value,
        toolName: toolName.value.trim() || 'web_search',
        hiddenInstruction: hiddenInstruction.value,
        toolArgs: parsedArgs
      });
    } catch (e) {
      argsParseError = (e as Error).message;
      result = null;
    }
  }

  $effect(() => {
    void kind.value; void provider.value; void toolName.value; void hiddenInstruction.value; void argsJson.value;
    regenerate();
  });

  async function copyPayload() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.payload);
      notify.success('Payload copied');
    } catch {
      notify.error('Copy failed');
    }
  }

  const kinds: ToolPayloadKind[] = ['tool-result-injection', 'tool-desc-rewrite', 'tool-arg-coerce'];
  const providers: ToolPayloadProvider[] = ['openai', 'anthropic', 'generic'];
</script>

<svelte:head><title>Tool-Result Lab · Cryptex</title></svelte:head>

<section class="space-y-6">
  <header class="space-y-2">
    <div class="flex items-center gap-2">
      <h1 class="font-serif text-3xl sm:text-4xl tracking-tight text-balance">
        Tool-result <span class="text-primary italic">lab</span>
      </h1>
      <UsageHint
        title="Tool-result lab · Usage"
        bullets={[
          'Pick a provider format (Anthropic, OpenAI, Google).',
          'Pick injection kind — fake_result, rewrite_description, adversarial_args.',
          'Generates a tool_result block with the hidden instruction inside.',
          'Tests whether agent loops trust attacker-supplied tool output.'
        ]}
      />
    </div>
    <p class="text-muted-foreground max-w-2xl text-sm sm:text-base">
      Synthesize fake tool-call result blocks across provider formats. Tests whether agent loops
      trust attacker-supplied tool_result content, adopt rewritten tool descriptions
      mid-conversation, or call tools with adversarial arguments.
    </p>
  </header>

  <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
    <!-- Sidebar -->
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass lg:sticky lg:top-20 lg:self-start">
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Attack kind</span>
        <select
          bind:value={kind.value}
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {#each kinds as k}
            <option value={k}>{KIND_LABELS[k]}</option>
          {/each}
        </select>
        <span class="text-[10px] text-muted-foreground">{KIND_DESCRIPTIONS[kind.value]}</span>
      </label>

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Provider format</span>
        <select
          bind:value={provider.value}
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {#each providers as p}
            <option value={p}>{PROVIDER_LABELS[p]}</option>
          {/each}
        </select>
      </label>

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Tool name</span>
        <input
          bind:value={toolName.value}
          list="tool-presets"
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <datalist id="tool-presets">
          {#each TOOL_NAME_PRESETS as n}
            <option value={n}></option>
          {/each}
        </datalist>
      </label>

      {#if kind.value !== 'tool-desc-rewrite'}
        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">Tool args (JSON)</span>
          <textarea
            bind:value={argsJson.value}
            rows="3"
            class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-xs focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          ></textarea>
          {#if argsParseError}
            <span class="text-[10px] text-destructive">parse: {argsParseError}</span>
          {/if}
        </label>
      {/if}

      <div class="space-y-1.5 rounded-md border border-border/40 bg-background/40 p-2 text-[11px] leading-relaxed text-muted-foreground">
        <p class="flex items-center gap-1.5">
          <Wrench size={11} class="text-primary" />
          <span class="font-medium text-foreground">Usage</span>
        </p>
        <p>
          Paste the synthesized block into a chat composer or agent input. The
          <code class="rounded bg-muted/40 px-1 py-0.5 font-mono text-[10px]">tool_arg_hijack</code> + <code class="rounded bg-muted/40 px-1 py-0.5 font-mono text-[10px]">tool_desc_rewrite</code> chain mutators reference these patterns.
        </p>
      </div>
    </div>

    <!-- Right -->
    <div class="space-y-4">
      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <h2 class="font-serif text-sm">Hidden instruction</h2>
        <textarea
          bind:value={hiddenInstruction.value}
          rows="3"
          placeholder="What the attacker wants the model to do…"
          class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        ></textarea>
      </div>

      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <div class="flex items-center justify-between">
          <h2 class="font-serif text-sm">Synthesized payload</h2>
          {#if result}
            <button
              type="button"
              onclick={copyPayload}
              class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Copy size={11} /> Copy
            </button>
          {/if}
        </div>

        {#if !result}
          <div class="rounded-lg border border-dashed border-border/40 bg-background/20 p-6 text-center text-xs text-muted-foreground">
            Enter an instruction; payload regenerates automatically.
          </div>
        {:else}
          <pre class="max-h-[calc(100vh-30rem)] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-input bg-background/40 p-3 font-mono text-xs leading-relaxed text-foreground cryptex-scroll">{result.payload}</pre>
          <p class="rounded-md border border-border/40 bg-background/40 p-2 text-[11px] italic leading-relaxed text-muted-foreground">
            {result.notes}
          </p>
        {/if}
      </div>
    </div>
  </div>
</section>
