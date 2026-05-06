<script lang="ts">
  import {
    buildExfilPayload,
    PAYLOAD_TYPES,
    PAYLOAD_TYPE_LABELS,
    DEFAULT_HIDDEN_INSTRUCTION,
    type ExfilPayloadType,
    type ExfilResult
  } from '$lib/redteam/markdown-exfil';
  import { notify } from '$lib/stores/toast.svelte';
  import Copy from 'lucide-svelte/icons/copy';
  import Link from 'lucide-svelte/icons/link';
  import RefreshCw from 'lucide-svelte/icons/refresh-cw';

  let hiddenInstruction = $state<string>(DEFAULT_HIDDEN_INSTRUCTION);
  let canaryUrl = $state<string>('https://canary.example.test');
  let payloadType = $state<ExfilPayloadType>('image-canary');
  let token = $state<string>('');
  let result = $state<ExfilResult | null>(null);

  function regenerate() {
    if (!hiddenInstruction.trim()) {
      result = null;
      return;
    }
    result = buildExfilPayload({
      hiddenInstruction,
      canaryUrl: canaryUrl.trim() || undefined,
      token: token.trim() || undefined,
      payloadType
    });
  }

  // Auto-regenerate on input changes.
  $effect(() => {
    void hiddenInstruction;
    void canaryUrl;
    void payloadType;
    void token;
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

  function rerollToken() {
    token = '';
    regenerate();
  }
</script>

<svelte:head><title>Markdown Exfil · Cryptex</title></svelte:head>

<section class="space-y-6">
  <header class="space-y-2">
    <h1 class="font-serif text-3xl sm:text-4xl tracking-tight text-balance">
      Markdown <span class="text-primary italic">exfil</span> lab
    </h1>
    <p class="text-muted-foreground max-w-2xl text-sm sm:text-base">
      Synthesize indirect-injection payloads — markdown, HTML, citation blocks, document bodies,
      CSV cells, data: URIs. Tests whether a downstream chat UI fetches embedded images on render
      (data exfil), or whether a summarizer re-emits hidden instructions when paraphrasing content.
    </p>
  </header>

  <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
    <!-- Sidebar -->
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass lg:sticky lg:top-20 lg:self-start">
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Payload type</span>
        <select
          bind:value={payloadType}
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {#each PAYLOAD_TYPES as t}
            <option value={t}>{PAYLOAD_TYPE_LABELS[t]}</option>
          {/each}
        </select>
      </label>

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Canary URL</span>
        <input
          bind:value={canaryUrl}
          type="url"
          placeholder="https://your-canary.example"
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span class="text-[10px] text-muted-foreground">
          Use a domain you control (canarytokens.org / your subdomain) to log fetch requests.
        </span>
      </label>

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Token (optional)</span>
        <div class="flex gap-1">
          <input
            bind:value={token}
            type="text"
            placeholder="auto-generate"
            class="flex-1 rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="button"
            onclick={rerollToken}
            title="Re-roll token"
            class="inline-flex items-center justify-center rounded-md border border-border bg-card/60 px-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RefreshCw size={12} />
          </button>
        </div>
        <span class="text-[10px] text-muted-foreground">
          Logged with the canary fetch; identifies which payload fired.
        </span>
      </label>

      <div class="space-y-1.5 rounded-md border border-border/40 bg-background/40 p-2 text-[11px] leading-relaxed text-muted-foreground">
        <p class="flex items-center gap-1.5">
          <Link size={11} class="text-primary" />
          <span class="font-medium text-foreground">Usage</span>
        </p>
        <p>
          Paste the synthesized payload into a chat composer or attach as document content.
          If the canary URL gets hit, the renderer auto-fetches markdown images (exfil-capable).
        </p>
        <p>
          The <code class="rounded bg-muted/40 px-1 py-0.5 font-mono text-[10px]">markdown_exfil</code> + <code class="rounded bg-muted/40 px-1 py-0.5 font-mono text-[10px]">doc_injection</code> chain mutators reference this builder.
        </p>
      </div>
    </div>

    <!-- Right — instruction editor + result -->
    <div class="space-y-4">
      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <h2 class="font-serif text-sm">Hidden instruction</h2>
        <textarea
          bind:value={hiddenInstruction}
          rows="4"
          placeholder="Adversarial instruction to embed in the payload…"
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
            Enter a hidden instruction above. Payload regenerates automatically.
          </div>
        {:else}
          <pre class="whitespace-pre-wrap break-all rounded-lg border border-input bg-background/40 p-3 font-mono text-xs leading-relaxed text-foreground">{result.payload}</pre>
          <div class="text-[11px] text-muted-foreground">
            <span class="font-medium text-foreground">Token:</span>
            <code class="rounded bg-muted/40 px-1 py-0.5 font-mono text-[10px]">{result.token}</code>
            <span class="mx-1.5">·</span>
            <span class="font-medium text-foreground">Type:</span>
            <code class="rounded bg-muted/40 px-1 py-0.5 font-mono text-[10px]">{payloadType}</code>
          </div>
          <p class="rounded-md border border-border/40 bg-background/40 p-2 text-[11px] italic leading-relaxed text-muted-foreground">
            {result.notes}
          </p>
        {/if}
      </div>
    </div>
  </div>
</section>
