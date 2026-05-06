<script lang="ts">
  import {
    renderOcrPayload,
    OCR_PRESETS,
    DEFAULT_OCR_OPTIONS,
    type OcrMode,
    type OcrPayloadPreset
  } from '$lib/redteam/ocr-injection';
  import { notify } from '$lib/stores/toast.svelte';
  import { onMount } from 'svelte';
  import Copy from 'lucide-svelte/icons/copy';
  import Download from 'lucide-svelte/icons/download';
  import ImageIcon from 'lucide-svelte/icons/image';
  import RefreshCw from 'lucide-svelte/icons/refresh-cw';

  // Form state
  let payload = $state<string>(OCR_PRESETS[0].text);
  let mode = $state<OcrMode>(OCR_PRESETS[0].recommendedMode);
  let decoyText = $state<string>('A photograph of a quiet park at dawn.');
  let width = $state<number>(DEFAULT_OCR_OPTIONS.width);
  let height = $state<number>(DEFAULT_OCR_OPTIONS.height);
  let fontSize = $state<number>(DEFAULT_OCR_OPTIONS.fontSize);
  let imageDataUrl = $state<string | null>(null);
  let busy = $state(false);
  let errorMsg = $state<string>('');
  let isBrowser = $state(false);

  onMount(() => {
    isBrowser = true;
    void generate();
  });

  function applyPreset(preset: OcrPayloadPreset) {
    payload = preset.text;
    mode = preset.recommendedMode;
    void generate();
  }

  async function generate() {
    if (!isBrowser) return;
    if (!payload.trim()) {
      imageDataUrl = null;
      return;
    }
    busy = true;
    errorMsg = '';
    try {
      imageDataUrl = renderOcrPayload({
        text: payload,
        mode,
        decoyText: mode === 'typographic' ? decoyText : undefined,
        width,
        height,
        fontSize
      });
    } catch (e) {
      errorMsg = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  async function copyDataUrl() {
    if (!imageDataUrl) return;
    try {
      await navigator.clipboard.writeText(imageDataUrl);
      notify.success('Data URL copied');
    } catch {
      notify.error('Copy failed');
    }
  }

  function downloadPng() {
    if (!imageDataUrl) return;
    const link = document.createElement('a');
    link.href = imageDataUrl;
    link.download = `ocr-payload-${mode}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify.success('Downloaded');
  }

  const modeOptions: { value: OcrMode; label: string; hint: string }[] = [
    { value: 'covert', label: 'Covert', hint: 'Light gray text on white — invisible to humans, OCR reads.' },
    { value: 'overt', label: 'Overt', hint: 'Pure black text on white — fully visible.' },
    { value: 'typographic', label: 'Typographic', hint: 'Decoy on top + fainter payload below.' },
    { value: 'micro', label: 'Micro', hint: 'Tiny font (~6px) — humans skim past, OCR reads.' },
    { value: 'edge', label: 'Edge', hint: 'Single-row band at the canvas bottom edge.' }
  ];
</script>

<svelte:head><title>OCR Injection · Cryptex</title></svelte:head>

<section class="space-y-6">
  <header class="space-y-2">
    <h1 class="font-serif text-3xl sm:text-4xl tracking-tight text-balance">
      OCR <span class="text-primary italic">injection</span> generator
    </h1>
    <p class="text-muted-foreground max-w-2xl text-sm sm:text-base">
      Renders adversarial text into a PNG that vision-capable models OCR + execute. Use covert
      or typographic mode to hide the instruction from a human reviewing the image; the OCR layer
      of vision LLMs still picks it up.
    </p>
  </header>

  <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
    <!-- Sidebar — controls -->
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass lg:sticky lg:top-20 lg:self-start">
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Render mode</span>
        <select
          bind:value={mode}
          onchange={generate}
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {#each modeOptions as m}
            <option value={m.value}>{m.label}</option>
          {/each}
        </select>
        <span class="text-[10px] text-muted-foreground">
          {modeOptions.find((m) => m.value === mode)?.hint}
        </span>
      </label>

      {#if mode === 'typographic'}
        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">Decoy text (visible)</span>
          <input
            bind:value={decoyText}
            oninput={generate}
            type="text"
            class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      {/if}

      <div class="grid grid-cols-2 gap-2">
        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">Width</span>
          <input
            bind:value={width}
            onchange={generate}
            type="number"
            min="256"
            max="4096"
            class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">Height</span>
          <input
            bind:value={height}
            onchange={generate}
            type="number"
            min="64"
            max="2048"
            class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </div>

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Font size: {fontSize}px</span>
        <input
          type="range"
          min="6"
          max="64"
          step="1"
          bind:value={fontSize}
          oninput={generate}
          class="w-full accent-primary"
        />
      </label>

      <button
        type="button"
        onclick={generate}
        disabled={busy}
        class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {#if busy}
          <RefreshCw size={14} class="animate-spin" /> Rendering…
        {:else}
          <ImageIcon size={14} /> Re-render
        {/if}
      </button>

      {#if errorMsg}
        <p class="text-xs text-destructive">{errorMsg}</p>
      {/if}

      <div class="space-y-1.5 rounded-md border border-border/40 bg-background/40 p-2 text-[11px] leading-relaxed text-muted-foreground">
        <p class="flex items-center gap-1.5">
          <ImageIcon size={11} class="text-primary" />
          <span class="font-medium text-foreground">Usage</span>
        </p>
        <p>
          Save the PNG and attach to a chat with a vision-capable model. The model OCRs the image
          and may execute the embedded instruction.
        </p>
      </div>
    </div>

    <!-- Right — payload editor + image preview -->
    <div class="space-y-4">
      <!-- Presets -->
      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <h2 class="font-serif text-sm">Payload presets</h2>
        <div class="flex flex-wrap gap-1.5">
          {#each OCR_PRESETS as preset}
            <button
              type="button"
              onclick={() => applyPreset(preset)}
              class="inline-flex items-center gap-1 rounded-md border border-border bg-card/40 px-2 py-1 text-[11px] text-muted-foreground hover:border-border/70 hover:bg-muted hover:text-foreground"
              title={preset.text}
            >
              {preset.label}
              <span class="rounded bg-muted/40 px-1 font-mono text-[9px]">{preset.recommendedMode}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Editor -->
      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <h2 class="font-serif text-sm">Adversarial text payload</h2>
        <textarea
          bind:value={payload}
          oninput={generate}
          rows="5"
          placeholder="Adversarial instruction to embed in the image…"
          class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        ></textarea>
      </div>

      <!-- Preview -->
      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <div class="flex items-center justify-between">
          <h2 class="font-serif text-sm">Image preview</h2>
          <div class="flex items-center gap-2">
            <button
              type="button"
              onclick={downloadPng}
              disabled={!imageDataUrl}
              class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <Download size={11} /> PNG
            </button>
            <button
              type="button"
              onclick={copyDataUrl}
              disabled={!imageDataUrl}
              class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <Copy size={11} /> Data URL
            </button>
          </div>
        </div>
        {#if imageDataUrl}
          <div class="rounded-lg border border-input bg-background/70 p-2">
            <img
              src={imageDataUrl}
              alt="OCR injection preview"
              class="block max-w-full rounded border border-border/40"
            />
          </div>
          <p class="text-[10px] text-muted-foreground">
            Mode: <code class="rounded bg-muted/40 px-1 py-0.5 font-mono text-[10px]">{mode}</code> · {width}×{height}px · {fontSize}px font
          </p>
        {:else}
          <div class="rounded-lg border border-dashed border-border/40 bg-background/20 p-6 text-center text-xs text-muted-foreground">
            Enter payload text in the editor above. Image renders automatically.
          </div>
        {/if}
      </div>
    </div>
  </div>
</section>
