<script lang="ts">
  import {
    buildIndirectPayload,
    KIND_LIST,
    KIND_LABELS,
    PLACEMENT_LIST,
    PLACEMENT_LABELS,
    DEFAULT_INSTRUCTION,
    type IndirectPayloadKind,
    type Placement,
    type IndirectInjectionResult
  } from '$lib/redteam/indirect-injection';
  import { notify } from '$lib/stores/toast.svelte';
  import Copy from 'lucide-svelte/icons/copy';
  import FileText from 'lucide-svelte/icons/file-text';

  let kind = $state<IndirectPayloadKind>('web-article');
  let placement = $state<Placement>('footer');
  let topic = $state<string>('quarterly-business-review');
  let hiddenInstruction = $state<string>(DEFAULT_INSTRUCTION);
  let result = $state<IndirectInjectionResult | null>(null);

  function regenerate() {
    if (!hiddenInstruction.trim()) {
      result = null;
      return;
    }
    try {
      result = buildIndirectPayload({ kind, placement, topic, hiddenInstruction });
    } catch (e) {
      notify.error((e as Error).message);
      result = null;
    }
  }

  $effect(() => {
    void kind; void placement; void topic; void hiddenInstruction;
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
</script>

<svelte:head><title>Indirect Injection · Cryptex</title></svelte:head>

<section class="space-y-6">
  <header class="space-y-2">
    <h1 class="font-serif text-3xl sm:text-4xl tracking-tight text-balance">
      Indirect <span class="text-primary italic">injection</span> lab
    </h1>
    <p class="text-muted-foreground max-w-2xl text-sm sm:text-base">
      Synthesize document-class payloads — articles, wikis, emails, source code, RSS feeds, PDFs,
      forum threads, READMEs, changelogs, configs — with hidden instructions placed in headers,
      bodies, footers, comments, or metadata. Tests summarization / RAG agents that ingest
      attacker-supplied content.
    </p>
  </header>

  <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
    <!-- Sidebar -->
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass lg:sticky lg:top-20 lg:self-start">
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Document shape</span>
        <select
          bind:value={kind}
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {#each KIND_LIST as k}
            <option value={k}>{KIND_LABELS[k]}</option>
          {/each}
        </select>
      </label>

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Instruction placement</span>
        <select
          bind:value={placement}
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {#each PLACEMENT_LIST as p}
            <option value={p}>{PLACEMENT_LABELS[p]}</option>
          {/each}
        </select>
      </label>

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Cover topic</span>
        <input
          bind:value={topic}
          type="text"
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span class="text-[10px] text-muted-foreground">Flavors the cover content; the hidden instruction is what really matters.</span>
      </label>

      {#if result}
        <div class="rounded-md border border-border/40 bg-background/40 p-2 text-[11px] leading-relaxed text-muted-foreground">
          <p class="flex items-center gap-1.5">
            <FileText size={11} class="text-primary" />
            <span class="font-medium text-foreground">Test hint</span>
          </p>
          <p>{result.hint}</p>
        </div>
      {/if}
    </div>

    <!-- Right -->
    <div class="space-y-4">
      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <h2 class="font-serif text-sm">Hidden instruction</h2>
        <textarea
          bind:value={hiddenInstruction}
          rows="3"
          placeholder="What the attacker wants the summarizer to do…"
          class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        ></textarea>
      </div>

      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <div class="flex items-center justify-between">
          <h2 class="font-serif text-sm">Synthesized {KIND_LABELS[kind].toLowerCase()}</h2>
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
            Enter a hidden instruction. Payload regenerates automatically.
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
