<script lang="ts">
  /**
   * Fuzzer (Mutation Lab) tool — Wave 1.2.
   *
   * Generates N seeded variants of a seed prompt by applying any subset of
   * 11 strategies (7 basic char/word-level, 4 advanced linguistic). Each
   * variant ships with a `sources` list for the optional mutation-log
   * rendering mode.
   *
   * Wrapped in <ToolShell> for status badge, error panel, and the
   * HistoryFooter. Bundles a Vault of 50 pre-tested weak-prompt seeds
   * (lib/vault/seeds/fuzzer.json) via VaultSection.
   */
  import { generateFuzzVariants, STRATEGIES, type FuzzVariant } from './fuzzer';
  import { notify } from '$lib/stores/toast.svelte';
  import { history } from '$lib/history/store.svelte';
  import { Errors, isCryptexError, type CryptexError } from '$lib/errors/types';
  import { errorLogger } from '$lib/errors/logger';
  import FlaskConical from 'lucide-svelte/icons/flask-conical';
  import Copy from 'lucide-svelte/icons/copy';
  import Download from 'lucide-svelte/icons/download';
  import { fuzzerState } from './fuzzer.state.svelte';
  import ToolShell from '$lib/components/shell/ToolShell.svelte';
  import VaultSection from '$lib/components/vault/VaultSection.svelte';
  import { createVaultStore } from '$lib/vault/store.svelte';
  import { loadBundledSeeds } from '$lib/vault/seed-loader';

  const TOOL_ID = 'fuzzer';
  const MAX_INPUT_BYTES = 1_048_576; // 1 MB

  type FuzzerSeed = {
    seed: string;
    recommendedStrategies: string[];
  };

  const vaultStore = createVaultStore<FuzzerSeed>(
    TOOL_ID,
    loadBundledSeeds<FuzzerSeed>(TOOL_ID)
  );

  const s = fuzzerState;
  let toolError = $state<CryptexError | undefined>(undefined);

  // --- size guard --------------------------------------------------------

  function checkSize(text: string): boolean {
    const bytes = new Blob([text]).size;
    if (bytes > MAX_INPUT_BYTES) {
      toolError = Errors.badInput(
        `Seed input exceeds 1 MB cap (got ${bytes.toLocaleString()} bytes).`
      );
      return false;
    }
    return true;
  }

  // --- run ---------------------------------------------------------------

  function run() {
    if (!s.input) {
      s.variants = [];
      notify.warn('Enter a seed first');
      return;
    }
    if (!checkSize(s.input)) { s.variants = []; return; }
    const startedAt = Date.now();
    try {
      const out = generateFuzzVariants(s.input, s.opts);
      s.variants = out;
      toolError = undefined;
      notify.success(`Generated ${out.length} variants`);
      void history.record({
        toolId: TOOL_ID,
        startedAt,
        status: 'done',
        input: s.input,
        output: out.map((v, i) => `#${i + 1} [${v.sources.join(',')}] ${v.output}`).join('\n'),
        params: { ...s.opts }
      });
    } catch (err) {
      const ce = isCryptexError(err) ? err : Errors.tool('Fuzzer run failed', err);
      toolError = ce;
      errorLogger.report(ce, { toast: false });
      s.variants = [];
    }
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify.success(label);
    } catch {
      notify.error('Copy failed');
    }
  }

  function copyAll() {
    if (s.variants.length === 0) return;
    const text = s.showMutationLog
      ? s.variants.map((v, i) => `#${i + 1} [${v.sources.join(', ')}] ${v.output}`).join('\n')
      : s.variants.map((v) => v.output).join('\n');
    copy(text, `Copied ${s.variants.length} variants`);
  }

  function download() {
    if (s.variants.length === 0) return;
    const activeStrategies = STRATEGIES.filter((st) => s.opts[st.id] === true)
      .map((st) => st.id)
      .join(',');
    const header =
      `# Cryptex fuzzer output\n` +
      `# count=${s.variants.length}\n` +
      `# seed=${s.opts.seed || ''}\n` +
      `# strategies=${activeStrategies}\n` +
      `# mutation_log=${s.showMutationLog}\n\n`;
    const lines = s.variants
      .map((v, i) =>
        s.showMutationLog
          ? `#${i + 1}\t[${v.sources.join(', ')}]\t${v.output}`
          : `#${i + 1}\t${v.output}`
      )
      .join('\n');
    const blob = new Blob([header + lines + '\n'], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fuzz_cases.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 200);
  }

  // --- vault application -------------------------------------------------

  function onVaultUse(payload: FuzzerSeed) {
    s.input = payload.seed;
    // Enable any recommended strategies; keep user's current selections too.
    for (const stratId of payload.recommendedStrategies || []) {
      if (stratId in s.opts) s.opts[stratId] = true;
    }
    notify.info(`Loaded seed (${(payload.recommendedStrategies ?? []).length} suggested strategies enabled)`);
  }

  // --- replay (HistoryFooter) -------------------------------------------

  function onReplay(input: string, params: Record<string, unknown>) {
    s.input = input;
    // Merge replay params into the current opts shape, defensively.
    const next = { ...s.opts };
    for (const k of Object.keys(params)) {
      if (k in next) {
        // Type-erase; opts is a wide record with mixed primitives.
        (next as Record<string, unknown>)[k] = params[k];
      }
    }
    s.opts = next as typeof s.opts;
  }

  // Tooltip helpers
  function strategyTipClass(badge: 'basic' | 'advanced'): string {
    return badge === 'advanced'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
      : 'border-muted text-muted-foreground';
  }
</script>

<ToolShell
  toolId={TOOL_ID}
  title="Mutation lab"
  accent="lab"
  description="Generate up to 500 mutated variants from a single seed. 11 strategies: 7 char-level (zero-width, Unicode noise, whitespace, casing, homoglyph, Zalgo, random-mix) and 4 linguistic (grammar, synonym, prompt-injection, structured noise). Seeded for reproducibility."
  usage={{
    title: 'Mutation lab · Usage',
    bullets: [
      'Toggle strategies; variants count controls how many come out.',
      'Each variant tagged with the strategies that produced it (toggle Mutation log).',
      'Seeded — same seed + same strategies → same outputs.',
      'Pipe variants into PromptCraft or HarmBench for scoring.',
      'Vault carries 50 pre-tested weak-prompt seeds with recommended strategies.'
    ]
  }}
  error={toolError}
  onErrorDismiss={() => (toolError = undefined)}
  {onReplay}
>
  <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass lg:sticky lg:top-20 lg:self-start">
      <h2 class="font-serif text-sm">Strategies</h2>
      <div class="space-y-1.5">
        {#each STRATEGIES as strat (strat.id)}
          <label class="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              bind:checked={s.opts[strat.id] as boolean}
              class="h-4 w-4 mt-0.5 rounded accent-primary"
            />
            <span class="flex-1">
              <span class="flex items-center gap-1.5">
                <span class="font-medium">{strat.name}</span>
                <span
                  class={'inline-flex items-center rounded-full border px-1.5 py-0 text-[9px] uppercase tracking-wider ' +
                    strategyTipClass(strat.badge)}
                >
                  {strat.badge}
                </span>
              </span>
              <span class="block text-[11px] text-muted-foreground">{strat.description}</span>
            </span>
          </label>
        {/each}
      </div>

      <div class="space-y-2 pt-2 border-t border-border/50">
        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">Variants (1-500)</span>
          <input
            type="number"
            min="1"
            max="500"
            bind:value={s.opts.count}
            class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm"
          />
        </label>
        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">Seed (optional — deterministic)</span>
          <input
            type="text"
            bind:value={s.opts.seed}
            placeholder="leave empty for random"
            class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm"
          />
        </label>
        <label class="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            bind:checked={s.showMutationLog}
            class="h-4 w-4 mt-0.5 rounded accent-primary"
          />
          <span class="flex-1">
            <span class="font-medium">Mutation log</span>
            <span class="block text-[11px] text-muted-foreground">Annotate each variant with the strategies that produced it</span>
          </span>
        </label>
      </div>

      <button
        type="button"
        onclick={run}
        class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5"
      >
        <FlaskConical size={14} /> Generate variants
      </button>
    </div>

    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
      <h2 class="font-serif text-sm">Seed input</h2>
      <textarea
        bind:value={s.input}
        rows="4"
        placeholder="The single string mutated into many…"
        class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      ></textarea>
      <div class="text-xs text-muted-foreground">
        {s.input.length.toLocaleString()} chars · {new Blob([s.input]).size.toLocaleString()} bytes UTF-8
      </div>

      {#if s.variants.length > 0}
        <div class="flex items-center justify-between pt-2 border-t border-border/50">
          <h3 class="font-serif text-sm">{s.variants.length} variants</h3>
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              onclick={copyAll}
              class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Copy size={11} /> Copy all
            </button>
            <button
              type="button"
              onclick={download}
              class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Download size={11} /> Download
            </button>
          </div>
        </div>
        <ol class="space-y-1 max-h-[520px] overflow-y-auto cryptex-scroll pr-1">
          {#each s.variants as variant, i (i)}
            <li class="group flex items-start gap-3 rounded-md border border-border/50 bg-background/40 px-3 py-2">
              <span class="shrink-0 font-mono text-[10px] text-muted-foreground pt-0.5 w-6 text-right">{i + 1}</span>
              <span class="flex-1 min-w-0 space-y-1">
                {#if s.showMutationLog}
                  <div class="flex flex-wrap gap-1">
                    {#each variant.sources as src (src)}
                      <span class="rounded bg-muted/40 px-1 py-0 text-[9px] font-mono">{src}</span>
                    {/each}
                  </div>
                {/if}
                <span class="block font-mono text-xs break-all whitespace-pre-wrap">{variant.output}</span>
              </span>
              <button
                type="button"
                onclick={() => copy(variant.output, `Variant ${i + 1} copied`)}
                class="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                aria-label="Copy variant"
              >
                <Copy size={13} />
              </button>
            </li>
          {/each}
        </ol>
      {/if}
    </div>
  </div>

  {#snippet vault()}
    <VaultSection
      store={vaultStore}
      label="Seed vault"
      onUse={(payload) => onVaultUse(payload)}
      payloadPlaceholder={'{"seed":"...","recommendedStrategies":["grammarMutation"]}'}
    />
  {/snippet}
</ToolShell>
