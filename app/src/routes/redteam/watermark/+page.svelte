<script lang="ts">
  /**
   * Watermark Detector · Wave 3.3
   *
   * Extends the existing heuristic analyzer (ZWSP / EOS leaks / provider tells /
   * bigram entropy) with a Kirchenbauer Z-score test on a hash-based green-list.
   * Both cards are visible — they're complementary signals, not alternatives.
   *
   * - Yellow heuristic caveat banner above results (matches Wave 3.1/3.2 pattern).
   * - Tunable seed input (default 0x5EED) — we don't have the real watermark
   *   key, so the user tries seeds and looks for a hit.
   * - Three-bucket verdict pill (likely-watermarked / inconclusive / likely-clean).
   * - Vault drawer with 5 illustrative test fixtures.
   */
  import { analyzeResponse, SCHEME_LABELS, type WatermarkAnalysis } from '$lib/redteam/watermark-detector';
  import {
    kirchenbauerZScore,
    KIRCHENBAUER_DEFAULT_SEED,
    MIN_TOKENS,
    type KirchenbauerScore
  } from '$lib/redteam/watermark-kirchenbauer';
  import { useToolState } from '$lib/stores/tool-state.svelte';
  import { notify } from '$lib/stores/toast.svelte';
  import { createVaultStore } from '$lib/vault/store.svelte';
  import { loadBundledSeeds } from '$lib/vault/seed-loader';
  import VaultSection from '$lib/components/vault/VaultSection.svelte';
  import UsageHint from '$lib/components/shell/UsageHint.svelte';
  import Droplet from 'lucide-svelte/icons/droplet';
  import ShieldAlert from 'lucide-svelte/icons/shield-alert';
  import ShieldCheck from 'lucide-svelte/icons/shield-check';
  import HelpCircle from 'lucide-svelte/icons/circle-help';

  const TOOL_ID = 'watermark';

  type WatermarkVaultPayload = { text: string };

  const response = useToolState<string>(TOOL_ID, 'response', '');
  // Seed persisted in tool state — user-tunable; default 0x5EED.
  const seed = useToolState<number>(TOOL_ID, 'kirchenbauerSeed', KIRCHENBAUER_DEFAULT_SEED);

  const analysis = $derived<WatermarkAnalysis | null>(
    response.value.trim().length > 0 ? analyzeResponse(response.value) : null
  );
  const kbScore = $derived<KirchenbauerScore | null>(
    response.value.trim().length > 0 ? kirchenbauerZScore(response.value, seed.value) : null
  );

  // ------------------------------------------------------------------
  // Vault store
  // ------------------------------------------------------------------
  const vaultStore = createVaultStore<WatermarkVaultPayload>(
    TOOL_ID,
    loadBundledSeeds<WatermarkVaultPayload>(TOOL_ID)
  );

  function onVaultUse(payload: WatermarkVaultPayload): void {
    response.value = payload.text;
    notify.success('Loaded sample into textarea');
  }

  function confidenceClass(c: 'high' | 'medium' | 'low'): string {
    if (c === 'high') return 'border-red-500/40 bg-red-500/10 text-red-400';
    if (c === 'medium') return 'border-amber-500/40 bg-amber-500/10 text-amber-400';
    return 'border-border bg-card/60 text-muted-foreground';
  }

  function verdictClass(v: KirchenbauerScore['verdict']): string {
    if (v === 'likely-watermarked') return 'border-red-500/40 bg-red-500/10 text-red-400';
    if (v === 'inconclusive') return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  }

  function verdictLabel(v: KirchenbauerScore['verdict']): string {
    if (v === 'likely-watermarked') return 'Likely watermarked';
    if (v === 'inconclusive') return 'Inconclusive';
    return 'Likely clean';
  }

  function verdictIcon(v: KirchenbauerScore['verdict']) {
    if (v === 'likely-watermarked') return ShieldAlert;
    if (v === 'inconclusive') return HelpCircle;
    return ShieldCheck;
  }

  function formatSeedHex(n: number): string {
    return '0x' + (n >>> 0).toString(16).toUpperCase();
  }

  function onSeedInput(ev: Event): void {
    const v = (ev.currentTarget as HTMLInputElement).value.trim();
    if (!v) return;
    // Accept decimal or 0x-prefixed hex.
    const n = v.startsWith('0x') || v.startsWith('0X') ? parseInt(v.slice(2), 16) : parseInt(v, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 0xffffffff) {
      seed.value = n >>> 0;
    }
  }
</script>

<svelte:head><title>Watermark Detector · Cryptex</title></svelte:head>

<section class="space-y-6">
  <header class="space-y-2">
    <div class="flex items-center gap-2">
      <h1 class="font-serif text-3xl sm:text-4xl tracking-tight text-balance">
        Watermark <span class="text-primary italic">detector</span>
      </h1>
      <UsageHint
        title="Watermark detector · Usage"
        bullets={[
          'Paste any model response into the textarea.',
          'Heuristic analyzer scans for ZWSP / role-marker leaks / provider self-ID / low bigram entropy.',
          'Kirchenbauer Z-test runs a green-list test using a tunable seed (default 0x5EED).',
          'Try several seeds since the real watermark key is unknown; the analyzer approximates with seed search.',
          'Both signals are complementary triage cues; combine with your own validation.'
        ]}
      />
    </div>
    <p class="text-muted-foreground max-w-2xl text-sm sm:text-base">
      Heuristic pattern-matchers for known LLM watermark schemes (Kirchenbauer green-list,
      Aaronson/OpenAI experimental) plus provider tells (chat-template markers leaking, model
      self-identification, zero-width-character injection). Not definitive — a triage signal.
    </p>
  </header>

  <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass lg:sticky lg:top-20 lg:self-start">
      <div class="rounded-md border border-border/40 bg-background/40 p-2 text-[11px] leading-relaxed text-muted-foreground">
        <p class="flex items-center gap-1.5">
          <Droplet size={11} class="text-primary" />
          <span class="font-medium text-foreground">What gets flagged</span>
        </p>
        <ul class="mt-1 space-y-0.5">
          <li>• Zero-width / control-char injection (some watermarks use this)</li>
          <li>• EOS / role-marker leaks (LLaMA, DeepSeek, Qwen, Anthropic)</li>
          <li>• Provider self-identification phrases (OpenAI, Claude, Gemini)</li>
          <li>• Low bigram entropy (possible green-list bias)</li>
          <li>• Kirchenbauer Z-score test on hash-seeded green list</li>
        </ul>
      </div>

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Kirchenbauer seed</span>
        <input
          type="text"
          value={formatSeedHex(seed.value)}
          oninput={onSeedInput}
          placeholder="0x5EED"
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span class="text-[10px] text-muted-foreground">
          Tunable; default 0x5EED. Try multiple — we approximate without the real key.
        </span>
      </label>
    </div>

    <div class="space-y-4">
      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <h2 class="font-serif text-sm">Response to scan</h2>
        <textarea
          bind:value={response.value}
          rows="10"
          placeholder="Paste a target model response here…"
          class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        ></textarea>
      </div>

      {#if analysis}
        <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
          <div class="flex items-center justify-between">
            <h2 class="font-serif text-sm">Analysis</h2>
            <span class={'rounded-full border px-2 py-0.5 text-[11px] ' + (analysis.likelyWatermarked ? 'border-red-500/40 bg-red-500/10 text-red-400' : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400')}>
              {analysis.likelyWatermarked ? 'Likely watermarked' : 'No strong signal'}
            </span>
          </div>

          <div class="grid grid-cols-4 gap-3 text-center">
            <div class="rounded-lg border border-input bg-background/70 p-3">
              <div class="font-mono text-2xl text-foreground">{analysis.stats.length}</div>
              <div class="text-[11px] text-muted-foreground">Length</div>
            </div>
            <div class="rounded-lg border border-input bg-background/70 p-3">
              <div class={'font-mono text-2xl ' + (analysis.stats.zeroWidthChars > 0 ? 'text-red-400' : 'text-foreground')}>{analysis.stats.zeroWidthChars}</div>
              <div class="text-[11px] text-muted-foreground">ZWSP</div>
            </div>
            <div class="rounded-lg border border-input bg-background/70 p-3">
              <div class="font-mono text-2xl text-foreground">{analysis.stats.bigramEntropy.toFixed(2)}</div>
              <div class="text-[11px] text-muted-foreground">Bigram entropy</div>
            </div>
            <div class="rounded-lg border border-input bg-background/70 p-3">
              <div class="font-mono text-2xl text-foreground">{(analysis.stats.punctuationRatio * 100).toFixed(1)}%</div>
              <div class="text-[11px] text-muted-foreground">Punct. density</div>
            </div>
          </div>

          {#if analysis.signals.length > 0}
            <div class="space-y-1">
              <h3 class="text-[11px] uppercase tracking-wider text-muted-foreground">Signals</h3>
              <ul class="space-y-1">
                {#each analysis.signals as s}
                  <li class="flex items-start gap-2 rounded-md border border-input bg-background/70 px-2 py-1.5 text-[11px]">
                    <span class={'shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ' + confidenceClass(s.confidence)}>
                      {s.confidence}
                    </span>
                    <div class="min-w-0 flex-1">
                      <div class="font-mono text-foreground">{SCHEME_LABELS[s.scheme]}</div>
                      <div class="text-[10px] italic text-muted-foreground">{s.detail}</div>
                    </div>
                  </li>
                {/each}
              </ul>
            </div>
          {:else}
            <div class="rounded-lg border border-dashed border-border/40 bg-background/20 p-3 text-center text-xs text-muted-foreground">
              No watermark / tell signals detected.
            </div>
          {/if}
        </div>

        <!-- Kirchenbauer Z-test card -->
        {#if kbScore}
          {@const VerdictIcon = verdictIcon(kbScore.verdict)}
          <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
            <div class="flex items-center justify-between">
              <h2 class="font-serif text-sm">Kirchenbauer Z-test</h2>
              <span class={'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ' + verdictClass(kbScore.verdict)}>
                <VerdictIcon size={12} />
                {verdictLabel(kbScore.verdict)}
              </span>
            </div>

            <div class="grid grid-cols-4 gap-3 text-center">
              <div class="rounded-lg border border-input bg-background/70 p-3">
                <div class="font-mono text-2xl text-foreground">
                  {Number.isFinite(kbScore.zScore) ? kbScore.zScore.toFixed(2) : '—'}
                </div>
                <div class="text-[11px] text-muted-foreground">Z-score</div>
              </div>
              <div class="rounded-lg border border-input bg-background/70 p-3">
                <div class="font-mono text-2xl text-foreground">
                  {kbScore.tokenCount > 0 ? (kbScore.greenFraction * 100).toFixed(1) + '%' : '—'}
                </div>
                <div class="text-[11px] text-muted-foreground">Green fraction</div>
              </div>
              <div class="rounded-lg border border-input bg-background/70 p-3">
                <div class="font-mono text-2xl text-foreground">{kbScore.tokenCount}</div>
                <div class="text-[11px] text-muted-foreground">Tokens scored</div>
              </div>
              <div class="rounded-lg border border-input bg-background/70 p-3">
                <div class="font-mono text-sm text-foreground">{formatSeedHex(kbScore.seed)}</div>
                <div class="text-[11px] text-muted-foreground">Seed</div>
              </div>
            </div>

            <p class="rounded-md border border-border/40 bg-background/40 px-2 py-1.5 text-[11px] italic text-muted-foreground">
              {kbScore.rationale}
            </p>

            {#if kbScore.verdict === 'inconclusive' && kbScore.tokenCount < MIN_TOKENS}
              <p class="text-[10px] text-muted-foreground">
                Need ≥{MIN_TOKENS} tokens for a reliable Z-test. Paste a longer sample.
              </p>
            {/if}
          </div>
        {/if}
      {/if}

      <!-- Vault drawer -->
      <VaultSection
        store={vaultStore}
        label="Watermark test fixtures"
        onUse={(payload) => onVaultUse(payload)}
        payloadPlaceholder={'{"text":"...sample response text..."}'}
      />
    </div>
  </div>
</section>
