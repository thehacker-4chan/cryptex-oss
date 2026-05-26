<script lang="ts">
  /**
   * Anti-Classifier Tool · Wave 3.3
   *
   * Upgraded from a single-variant rewriter to an N-variant fan-out (default 5)
   * with heuristic linguistic-feature scoring per variant + aggregate
   * evasion-rate chip. We do NOT call GPTZero / Originality.ai / Copyleaks —
   * see `anticlassifier-scorer.ts` for the product rationale.
   *
   * Each variant call uses a slightly perturbed temperature (base ± 0.1·n) to
   * encourage diversity in the rewrites. Concurrency is capped at 3 to avoid
   * spiking provider rate-limits.
   *
   * Errors funnel through `errorLogger.report()`; the existing GatewayError
   * → ErrorBanner flow is preserved.
   */
  import { ANTICLASSIFIER_SYSTEM_PROMPT, buildAntiClassifierUserMessage } from './prompt';
  import { unwrap, tuneParams } from '$lib/ai/prompt-scaffold';
  import { chat, hasAnyKey as hasApiKey } from '$lib/ai/gateway';
  import { GatewayError } from '$lib/ai/types';
  import ModelPickerV2 from '$lib/components/ai/ModelPickerV2.svelte';
  import { createPersistedState } from '$lib/stores/_persisted.svelte';
  import { activeRuns } from '$lib/stores/activeRuns.svelte';
  import { goto } from '$app/navigation';
  import { notify } from '$lib/stores/toast.svelte';
  import { sessionLog } from '$lib/stores/sessionLog.svelte';
  import { errorLogger } from '$lib/errors/logger';
  import { isCryptexError } from '$lib/errors/types';
  import { untrack } from 'svelte';
  import Shield from 'lucide-svelte/icons/shield';
  import Copy from 'lucide-svelte/icons/copy';
  import Loader from 'lucide-svelte/icons/loader-circle';
  import ChevronDown from 'lucide-svelte/icons/chevron-down';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import TriangleAlert from 'lucide-svelte/icons/triangle-alert';
  import NoProviderBanner from '$lib/components/ai/NoProviderBanner.svelte';
  import UsageHint from '$lib/components/shell/UsageHint.svelte';
  import VaultSection from '$lib/components/vault/VaultSection.svelte';
  import { anticlassifierState, type VariantEntry } from './anticlassifier.state.svelte';
  import ErrorBanner from '$lib/components/ai/ErrorBanner.svelte';
  import { scoreVariant, aggregateEvasionRate, EVASION_THRESHOLDS } from '$lib/redteam/anticlassifier-scorer';
  import { createVaultStore } from '$lib/vault/store.svelte';
  import { loadBundledSeeds } from '$lib/vault/seed-loader';

  type AntiClassifierData = { lastError: GatewayError | null };
  type AntiClassifierVaultPayload = { input: string };
  const TOOL_ID = 'anticlassifier';

  const modelPref = createPersistedState<string>('cryptex.ac.model', 'openrouter:openrouter/auto');

  // One-shot mount-time normalizer for legacy unqualified model ids.
  // Wrapped in untrack so the effect does not loop through createPersistedState's
  // localStorage round-trip. Otherwise navigating to /anticlassifier from a
  // legacy localStorage value pegs the main thread.
  $effect(() => {
    untrack(() => {
      const v = modelPref.value;
      if (v && !v.includes(':')) modelPref.value = `openrouter:${v}`;
    });
  });
  const tempPref = createPersistedState<number>('cryptex.ac.temperature', 0.7);

  const s = anticlassifierState;

  const run_ = $derived(activeRuns.get<AntiClassifierData>(TOOL_ID));
  const loading = $derived(activeRuns.isRunning(TOOL_ID));
  const errorMsg = $derived(run_?.error ?? '');
  const lastError = $derived(run_?.data.lastError ?? null);

  const keyConfigured = $derived(hasApiKey());

  // ------------------------------------------------------------------
  // Vault store
  // ------------------------------------------------------------------
  const vaultStore = createVaultStore<AntiClassifierVaultPayload>(
    TOOL_ID,
    loadBundledSeeds<AntiClassifierVaultPayload>(TOOL_ID)
  );

  // Collapsible state per variant (expand long rewrites on click)
  let expandedVariants = $state<Record<number, boolean>>({});
  function toggleExpand(idx: number): void {
    expandedVariants = { ...expandedVariants, [idx]: !expandedVariants[idx] };
  }

  // ------------------------------------------------------------------
  // Aggregate stats over the variants
  // ------------------------------------------------------------------
  const aggregate = $derived(
    s.variants.length > 0
      ? aggregateEvasionRate(s.variants.map((v) => v.score))
      : { highEvasionRate: 0, meanEvasionScore: 0, meanSimilarity: 0 }
  );
  const highEvasionCount = $derived(
    s.variants.filter((v) => v.score.label === 'high-evasion').length
  );

  // ------------------------------------------------------------------
  // Per-call concurrency pool
  // ------------------------------------------------------------------
  const CONCURRENCY = 3;

  async function fanoutVariants(opts: {
    n: number;
    input: string;
    baseTemp: number;
    signal: AbortSignal;
  }): Promise<{ ok: VariantEntry[]; errors: unknown[] }> {
    const { n, input, baseTemp, signal } = opts;
    const userMessage = buildAntiClassifierUserMessage(input);
    const requests: Array<{ idx: number; temperature: number }> = [];
    for (let i = 0; i < n; i++) {
      // Spread temperature ±0.1·i around the base; clamp to [0, 2].
      const offset = (i - (n - 1) / 2) * 0.1;
      const t = Math.max(0, Math.min(2, baseTemp + offset));
      requests.push({ idx: i, temperature: t });
    }

    const ok: VariantEntry[] = [];
    const errors: unknown[] = [];

    let cursor = 0;
    async function worker(): Promise<void> {
      while (cursor < requests.length) {
        if (signal.aborted) return;
        const idx = cursor++;
        const req = requests[idx];
        try {
          const res = await chat({
            model: modelPref.value,
            temperature: req.temperature,
            max_tokens: s.maxTokens,
            title: 'Cryptex/AntiClassifier-v3',
            messages: [
              {
                role: 'system',
                content: ANTICLASSIFIER_SYSTEM_PROMPT,
                providerOptions: {
                  anthropic: { cacheControl: { type: 'ephemeral', ttl: '1h' } }
                }
              },
              { role: 'user', content: userMessage }
            ],
            signal
          });
          const raw = unwrap(res.content, 'json');
          const variantText = extractFirstRewrite(raw) ?? raw;
          const score = scoreVariant(input, variantText);
          ok.push({ text: variantText, score, temperature: req.temperature });
        } catch (err) {
          errors.push(err);
        }
      }
    }

    // Spin up `CONCURRENCY` workers in parallel.
    const workers = Array.from({ length: Math.min(CONCURRENCY, n) }, () => worker());
    await Promise.all(workers);
    return { ok, errors };
  }

  /** Pull the first rewrite text out of the JSON envelope, if present. */
  function extractFirstRewrite(raw: string): string | null {
    try {
      const parsed = JSON.parse(raw) as { rewrites?: Array<{ text?: string }> };
      const first = parsed?.rewrites?.[0]?.text;
      return typeof first === 'string' && first.length > 0 ? first : null;
    } catch {
      return null;
    }
  }

  function run() {
    if (!keyConfigured) {
      activeRuns.start<AntiClassifierData>(TOOL_ID, { lastError: null });
      activeRuns.fail(TOOL_ID, 'No provider configured. Add one in Settings to unlock this tool.');
      return;
    }
    if (!s.input.trim()) {
      activeRuns.start<AntiClassifierData>(TOOL_ID, { lastError: null });
      activeRuns.fail(TOOL_ID, 'Enter a prompt to transform.');
      return;
    }

    s.output = '';
    s.variants = [];
    expandedVariants = {};
    const r = activeRuns.start<AntiClassifierData>(
      TOOL_ID,
      { lastError: null },
      `Generating ${s.numVariants} variants…`
    );

    void (async () => {
      try {
        const { temperature } = tuneParams(modelPref.value, 'analyze');
        const baseTemp = temperature ?? tempPref.value;
        const { ok, errors } = await fanoutVariants({
          n: s.numVariants,
          input: s.input,
          baseTemp,
          signal: r.controller.signal
        });

        if (r.controller.signal.aborted) {
          if (activeRuns.get(TOOL_ID)?.status === 'running') activeRuns.cancel(TOOL_ID);
          return;
        }

        if (ok.length === 0) {
          const first = errors[0];
          if (first instanceof GatewayError) {
            activeRuns.update<AntiClassifierData>(TOOL_ID, () => ({ lastError: first }));
            activeRuns.fail(TOOL_ID, '');
          } else {
            const ce = isCryptexError(first) ? first : errorLogger.report(first, { toast: false });
            activeRuns.fail(TOOL_ID, ce.userMessage);
          }
          return;
        }

        // Sort variants by descending evasion score so the best surface first.
        s.variants = [...ok].sort((a, b) => b.score.evasionScore - a.score.evasionScore);
        // Keep legacy output field populated with the top variant for back-compat
        // (copy-button, history serialization, etc.).
        s.output = s.variants[0].text;

        sessionLog.record({
          tool: 'anticlassifier',
          operation: 'transform',
          label: modelPref.value,
          input: s.input,
          output: s.output,
          options: {
            model: modelPref.value,
            temperature: tempPref.value,
            maxTokens: s.maxTokens,
            numVariants: s.numVariants,
            variantsProduced: s.variants.length,
            errorsCount: errors.length,
            highEvasionRate: aggregateEvasionRate(s.variants.map((v) => v.score)).highEvasionRate
          }
        });

        // Surface partial failures via the error logger but don't block success.
        for (const e of errors) {
          if (e instanceof GatewayError) continue; // dropped silently for partial-success runs
          errorLogger.report(e, { toast: false });
        }

        const aggMsg = `${s.variants.length}/${s.numVariants} variants · ${(
          aggregateEvasionRate(s.variants.map((v) => v.score)).highEvasionRate * 100
        ).toFixed(0)}% high-evasion`;
        activeRuns.finish(TOOL_ID, aggMsg);
        notify.success(aggMsg);
      } catch (err) {
        if (r.controller.signal.aborted) {
          if (activeRuns.get(TOOL_ID)?.status === 'running') activeRuns.cancel(TOOL_ID);
          return;
        }
        if (err instanceof GatewayError) {
          activeRuns.update<AntiClassifierData>(TOOL_ID, () => ({ lastError: err }));
          activeRuns.fail(TOOL_ID, '');
        } else {
          const ce = isCryptexError(err) ? err : errorLogger.report(err, { toast: false });
          activeRuns.fail(TOOL_ID, ce.userMessage);
        }
      }
    })();
  }

  async function copyOutput() {
    if (!s.output) return;
    try {
      await navigator.clipboard.writeText(s.output);
      notify.success('Output copied');
    } catch (err) {
      errorLogger.report(err);
    }
  }

  async function copyVariant(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      notify.success('Variant copied');
    } catch (err) {
      errorLogger.report(err);
    }
  }

  function onVaultUse(payload: AntiClassifierVaultPayload): void {
    s.input = payload.input;
    notify.success('Loaded prompt into input');
  }

  function labelColor(label: 'high-evasion' | 'moderate-evasion' | 'low-evasion'): string {
    if (label === 'high-evasion') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
    if (label === 'moderate-evasion') return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
    return 'border-red-500/40 bg-red-500/10 text-red-300';
  }

  function barWidth(value: number, max = 1): string {
    return `${Math.round(Math.max(0, Math.min(1, value / max)) * 100)}%`;
  }

  /** Truncate to 800 chars unless expanded. Used for the variant body. */
  function displayText(text: string, idx: number): string {
    if (expandedVariants[idx] || text.length <= 800) return text;
    return text.slice(0, 800) + '…';
  }
</script>

<svelte:head><title>Anti-Classifier · Cryptex</title></svelte:head>

<section class="space-y-6">
  <header class="space-y-2">
    <div class="flex items-center gap-2">
      <h1 class="font-serif text-3xl sm:text-4xl tracking-tight text-balance">
        Anti-<span class="text-primary italic">classifier</span>
      </h1>
      <UsageHint
        title="Anti-classifier · Usage"
        bullets={[
          'Paste a research-style prompt the target classifier flags.',
          'Pick N variants (1-10, default 5) — each is generated at a slightly different temperature for diversity.',
          'Each variant is scored on five linguistic features (TTR, sentence-length variance, burstiness, punctuation entropy, length naturalness).',
          'Aggregate evasion-rate chip shows the fraction labeled "high-evasion" by these heuristics.',
          'No external API calls — no GPTZero / Originality.ai / Copyleaks. Feature heuristics only.'
        ]}
        note="Best paired with the Cross-Model Diff tab to compare classifier signal across models."
      />
    </div>
    <p class="text-muted-foreground max-w-2xl text-sm sm:text-base">
      Syntactic / paraphrase rewrites for research-style prompts. Runs N parallel rewrites through the
      gateway and scores each on linguistic features — no external detector calls.
    </p>
  </header>

  <NoProviderBanner context="tool" />

  <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass lg:sticky lg:top-20 lg:self-start">
      <ModelPickerV2
        value={modelPref.value}
        onChange={(v) => (modelPref.value = v)}
        recentsKey="cryptex.ac.recentModels"
      />

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Temperature: {tempPref.value.toFixed(2)}</span>
        <input type="range" min="0" max="2" step="0.05"
          value={tempPref.value}
          oninput={(e) => (tempPref.value = Number((e.currentTarget as HTMLInputElement).value))}
          class="w-full accent-primary" />
      </label>

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">N variants: {s.numVariants}</span>
        <input type="range" min="1" max="10" step="1"
          value={s.numVariants}
          oninput={(e) => (s.numVariants = Number((e.currentTarget as HTMLInputElement).value))}
          class="w-full accent-primary" />
      </label>

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Max tokens</span>
        <input type="number" min="128" max="8000" bind:value={s.maxTokens}
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm" />
      </label>

      <button
        type="button"
        onclick={run}
        disabled={loading || !keyConfigured}
        class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {#if loading}
          <Loader size={14} class="animate-spin" /> Rewriting…
        {:else}
          <Shield size={14} /> Generate {s.numVariants} variant{s.numVariants === 1 ? '' : 's'}
        {/if}
      </button>

      {#if lastError}
        <ErrorBanner
          error={lastError}
          onRetry={() => run()}
          onOpenSettings={() => {
            const frag = lastError?.provider === 'openai-compat' ? 'providers' : `provider-${lastError?.provider}`;
            goto(`/settings#${frag}`);
          }}
        />
      {:else if errorMsg}
        <p class="text-xs text-destructive">{errorMsg}</p>
      {/if}
    </div>

    <div class="space-y-4">
      <!-- Input -->
      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <h2 class="font-serif text-sm">Input</h2>
        <textarea
          bind:value={s.input}
          rows="6"
          placeholder="Prompt to rewrite…"
          class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        ></textarea>
      </div>

      <!-- Mandatory caveat banner -->
      <div class="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-100">
        <TriangleAlert size={16} class="mt-0.5 shrink-0 text-amber-300" />
        <div class="space-y-0.5 text-xs leading-relaxed">
          <p class="font-medium text-amber-200">Heuristic scoring — features only, no vendor verdict.</p>
          <p class="text-amber-100/80">
            We do <strong>not</strong> call GPTZero, Originality.ai, Turnitin, or Copyleaks. Scores are computed from
            five linguistic features (TTR, sentence-length variance, burstiness, punctuation entropy, length naturalness).
            Use this as a craft signal for the rewrite — not as a vendor verdict.
          </p>
        </div>
      </div>

      <!-- Variants -->
      {#if s.variants.length > 0}
        <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="font-serif text-sm">Variants</h2>
            <div class="flex flex-wrap items-center gap-2 text-[11px]">
              <span class="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-primary">
                evasion rate: {(aggregate.highEvasionRate * 100).toFixed(0)}% ({highEvasionCount}/{s.variants.length})
              </span>
              <span class="rounded-full border border-border bg-card/60 px-2 py-0.5 font-mono text-muted-foreground">
                mean score: {aggregate.meanEvasionScore.toFixed(2)}
              </span>
              <span class="rounded-full border border-border bg-card/60 px-2 py-0.5 font-mono text-muted-foreground">
                mean similarity: {aggregate.meanSimilarity.toFixed(2)}
              </span>
            </div>
          </div>

          <ul class="space-y-2">
            {#each s.variants as v, i (i)}
              <li class="rounded-lg border border-input bg-background/70 p-3">
                <div class="space-y-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-mono text-[10px] text-muted-foreground">#{i + 1}</span>
                    <span class={'rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ' + labelColor(v.score.label)}>
                      {v.score.label}
                    </span>
                    <span class="font-mono text-[11px] text-foreground">score {v.score.evasionScore.toFixed(2)}</span>
                    <span class="font-mono text-[10px] text-muted-foreground">sim {v.score.semanticSimilarity.toFixed(2)}</span>
                    <span class="font-mono text-[10px] text-muted-foreground">temp {v.temperature.toFixed(2)}</span>
                    <div class="ml-auto flex items-center gap-1">
                      {#if v.text.length > 800}
                        <button
                          type="button"
                          onclick={() => toggleExpand(i)}
                          class="inline-flex items-center gap-0.5 rounded-md border border-border bg-card/40 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          {#if expandedVariants[i]}
                            <ChevronDown size={10} /> Collapse
                          {:else}
                            <ChevronRight size={10} /> Expand
                          {/if}
                        </button>
                      {/if}
                      <button
                        type="button"
                        onclick={() => copyVariant(v.text)}
                        class="inline-flex items-center gap-1 rounded-md border border-border bg-card/40 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Copy size={10} /> Copy
                      </button>
                    </div>
                  </div>

                  <p class="whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-foreground">
                    {displayText(v.text, i)}
                  </p>

                  <!-- Feature bars -->
                  <div class="grid grid-cols-5 gap-1.5 pt-1 text-[10px]">
                    <div>
                      <div class="text-muted-foreground">TTR</div>
                      <div class="mt-0.5 h-1 overflow-hidden rounded-full bg-muted/30">
                        <div class="h-full bg-primary/80" style="width: {barWidth(v.score.features.ttr, 1)}"></div>
                      </div>
                      <div class="mt-0.5 font-mono text-[9px] text-muted-foreground">{v.score.features.ttr.toFixed(2)}</div>
                    </div>
                    <div>
                      <div class="text-muted-foreground">avg-len</div>
                      <div class="mt-0.5 h-1 overflow-hidden rounded-full bg-muted/30">
                        <div class="h-full bg-primary/80" style="width: {barWidth(v.score.features.avgSentenceLen, 30)}"></div>
                      </div>
                      <div class="mt-0.5 font-mono text-[9px] text-muted-foreground">{v.score.features.avgSentenceLen.toFixed(1)}</div>
                    </div>
                    <div>
                      <div class="text-muted-foreground">variance</div>
                      <div class="mt-0.5 h-1 overflow-hidden rounded-full bg-muted/30">
                        <div class="h-full bg-primary/80" style="width: {barWidth(v.score.features.sentenceLenVariance, 50)}"></div>
                      </div>
                      <div class="mt-0.5 font-mono text-[9px] text-muted-foreground">{v.score.features.sentenceLenVariance.toFixed(1)}</div>
                    </div>
                    <div>
                      <div class="text-muted-foreground">burst.</div>
                      <div class="mt-0.5 h-1 overflow-hidden rounded-full bg-muted/30">
                        <div class="h-full bg-primary/80" style="width: {barWidth(v.score.features.burstiness + 1, 2)}"></div>
                      </div>
                      <div class="mt-0.5 font-mono text-[9px] text-muted-foreground">{v.score.features.burstiness.toFixed(2)}</div>
                    </div>
                    <div>
                      <div class="text-muted-foreground">punct.H</div>
                      <div class="mt-0.5 h-1 overflow-hidden rounded-full bg-muted/30">
                        <div class="h-full bg-primary/80" style="width: {barWidth(v.score.features.punctuationEntropy, 3)}"></div>
                      </div>
                      <div class="mt-0.5 font-mono text-[9px] text-muted-foreground">{v.score.features.punctuationEntropy.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </li>
            {/each}
          </ul>

          <!-- Legacy single-output card retained for back-compat copy -->
          <div class="flex items-center justify-between border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
            <span>Top variant is mirrored to history as the canonical output</span>
            <button
              type="button"
              onclick={copyOutput}
              disabled={!s.output}
              class="inline-flex items-center gap-1 rounded-md border border-border bg-card/40 px-1.5 py-0.5 text-[10px] hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <Copy size={10} /> Copy top
            </button>
          </div>
        </div>
      {/if}

      <!-- Vault drawer -->
      <VaultSection
        store={vaultStore}
        label="Anti-Classifier seed prompts"
        onUse={(payload) => onVaultUse(payload)}
        payloadPlaceholder={'{"input":"Explain the etiology of..."}'}
      />
    </div>
  </div>
</section>
