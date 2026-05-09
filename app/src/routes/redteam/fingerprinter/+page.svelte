<script lang="ts">
  import { fanout, type FanoutResult, type FanoutItem } from '$lib/redteam/fanout';
  import { FINGERPRINT_PROBES, fingerprintResponse, DEFENSE_CLASS_LABELS, type DefenseClass } from '$lib/redteam/defense-fingerprinter';
  import { chat as gatewayChat, streamChat as gatewayStreamChat, hasAnyKey as hasApiKey } from '$lib/ai/gateway';
  import ModelPickerV2 from '$lib/components/ai/ModelPickerV2.svelte';
  import NoProviderBanner from '$lib/components/ai/NoProviderBanner.svelte';
  import { createPersistedState } from '$lib/stores/_persisted.svelte';
  import { activeRuns } from '$lib/stores/activeRuns.svelte';
  import { notify } from '$lib/stores/toast.svelte';
  import Loader from 'lucide-svelte/icons/loader-circle';
  import Play from 'lucide-svelte/icons/play';
  import Square from 'lucide-svelte/icons/square';
  import Fingerprint from 'lucide-svelte/icons/fingerprint';
  import UsageHint from '$lib/components/shell/UsageHint.svelte';

  type FingerprintData = { results: FanoutResult[]; progress: number; total: number };
  const TOOL_ID = 'fingerprinter';

  const targetPref = createPersistedState<string>('cryptex.fingerprinter.target', 'openrouter:openrouter/auto');
  const judgePref = createPersistedState<string>('cryptex.fingerprinter.judge', 'openrouter:openai/gpt-4o-mini');

  const run = $derived(activeRuns.get<FingerprintData>(TOOL_ID));
  const running = $derived(activeRuns.isRunning(TOOL_ID));
  const results = $derived(run?.data.results ?? []);
  const progress = $derived(run?.data.progress ?? 0);
  const total = $derived(run?.data.total ?? 0);
  const errorMsg = $derived(run?.error ?? '');
  const keyConfigured = $derived(hasApiKey());

  const items: FanoutItem[] = FINGERPRINT_PROBES.map((p) => ({
    id: p.id,
    name: p.id,
    prompt: p.prompt,
    meta: { expectedRefuse: p.expectedRefuse, notes: p.notes }
  }));

  // Aggregate fingerprint signals across all probes.
  const aggregate = $derived.by(() => {
    const counts = new Map<DefenseClass, number>();
    let totalRefusals = 0;
    for (const r of results) {
      const expectedRefuse = r.meta?.expectedRefuse as boolean;
      const refused = r.judgeScore < 0.4;
      if (refused) totalRefusals++;
      const fp = fingerprintResponse(r.targetReply, refused);
      counts.set(fp.classifier, (counts.get(fp.classifier) ?? 0) + 1);
      void expectedRefuse;
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    return { topClass: sorted[0]?.[0] ?? 'unknown' as DefenseClass, counts: sorted, totalRefusals };
  });

  function runFingerprint() {
    if (!keyConfigured) {
      activeRuns.start<FingerprintData>(TOOL_ID, { results: [], progress: 0, total: 0 });
      activeRuns.fail(TOOL_ID, 'No provider configured.');
      return;
    }
    const totalCount = items.length;
    const r = activeRuns.start<FingerprintData>(
      TOOL_ID,
      { results: [], progress: 0, total: totalCount },
      `0 / ${totalCount}`
    );

    void (async () => {
      try {
        await fanout({
          task: 'defense fingerprint',
          items,
          targetModelId: targetPref.value,
          judgeModelId: judgePref.value,
          signal: r.controller.signal,
          gateway: { chat: gatewayChat, streamChat: gatewayStreamChat },
          concurrency: 3,
          onResult: (res) => {
            activeRuns.update<FingerprintData>(TOOL_ID, (d) => ({
              results: [...d.results, res],
              progress: d.results.length + 1,
              total: d.total
            }));
          }
        });
        activeRuns.finish(TOOL_ID, 'Fingerprint complete');
        notify.success('Fingerprint complete');
      } catch (err) {
        const msg = (err as Error).message ?? 'Fingerprint failed';
        if (r.controller.signal.aborted) {
          if (activeRuns.get(TOOL_ID)?.status === 'running') activeRuns.cancel(TOOL_ID);
        } else {
          activeRuns.fail(TOOL_ID, msg);
        }
      }
    })();
  }

  function stop() { activeRuns.cancel(TOOL_ID); }
</script>

<svelte:head><title>Defense Fingerprinter · Cryptex</title></svelte:head>

<section class="space-y-6">
  <header class="space-y-2">
    <div class="flex items-center gap-2">
      <h1 class="font-serif text-3xl sm:text-4xl tracking-tight text-balance">
        Defense <span class="text-primary italic">fingerprinter</span>
      </h1>
      <UsageHint
        title="Defense fingerprinter · Usage"
        bullets={[
          'Sends 10 calibrated probes (benign + moderate + adversarial) to the target.',
          'Pattern-matches refusal shape against known classifier signatures.',
          'Identifies Llama Guard, OpenAI Moderation, Anthropic HH, Azure Content Safety.',
          'Heuristic — confidence reported per match, not definitive.'
        ]}
      />
    </div>
    <p class="text-muted-foreground max-w-2xl text-sm sm:text-base">
      Fires a calibrated set of 10 benign + moderate + adversarial probes at a target,
      pattern-matches the response shapes against known classifier signatures (Llama Guard,
      OpenAI Moderation, Anthropic HH, Azure Content Safety, generic refusal, output filter).
    </p>
  </header>

  <NoProviderBanner context="tool" />

  <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass lg:sticky lg:top-20 lg:self-start">
      <div class="space-y-1">
        <span class="text-xs text-muted-foreground">Target model</span>
        <ModelPickerV2 value={targetPref.value} onChange={(v) => (targetPref.value = v)} recentsKey="cryptex.fingerprinter.recentTarget" />
      </div>
      <div class="space-y-1">
        <span class="text-xs text-muted-foreground">Judge model</span>
        <ModelPickerV2 value={judgePref.value} onChange={(v) => (judgePref.value = v)} recentsKey="cryptex.fingerprinter.recentJudge" />
      </div>

      <div class="border-t border-border/40 pt-3">
        {#if running}
          <div class="mb-2 text-xs text-muted-foreground">
            <span>Progress</span><span class="ml-2 font-mono text-foreground">{progress} / {total}</span>
            <div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted/40"><div class="h-full bg-primary transition-all" style="width: {total > 0 ? (progress / total) * 100 : 0}%"></div></div>
          </div>
          <button type="button" onclick={stop} class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card/40 px-3.5 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Square size={14} /> Stop</button>
        {:else}
          <button type="button" onclick={runFingerprint} disabled={!keyConfigured} class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"><Play size={14} /> Fingerprint ({items.length} probes)</button>
        {/if}
      </div>

      {#if errorMsg}<p class="text-xs text-destructive">{errorMsg}</p>{/if}

      <div class="rounded-md border border-border/40 bg-background/40 p-2 text-[11px] leading-relaxed text-muted-foreground">
        <p class="flex items-center gap-1.5"><Fingerprint size={11} class="text-primary" /><span class="font-medium text-foreground">Heuristic</span></p>
        <p>Pattern-matchers over response strings — useful triage signal, not definitive identification.</p>
      </div>
    </div>

    <div class="space-y-4">
      {#if results.length > 0}
        <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
          <h2 class="font-serif text-sm">Detected defense</h2>
          <div class="rounded-lg border border-input bg-background/70 p-4 text-center">
            <div class="font-mono text-xl text-foreground">{DEFENSE_CLASS_LABELS[aggregate.topClass]}</div>
            <div class="mt-1 text-[11px] text-muted-foreground">Most-common signature across {results.length} probes · {aggregate.totalRefusals} refusal(s)</div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            {#each aggregate.counts as [klass, n]}
              <div class="flex items-center justify-between rounded-md border border-border/40 bg-background/40 px-2 py-1 text-[11px]">
                <span class="text-muted-foreground">{DEFENSE_CLASS_LABELS[klass]}</span>
                <span class="font-mono text-foreground">{n}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <div class="flex items-center justify-between">
          <h2 class="font-serif text-sm">Per-probe signals</h2>
          <span class="font-mono text-[11px] text-muted-foreground">{results.length} / {total}</span>
        </div>
        {#if results.length === 0 && !running}
          <div class="rounded-lg border border-dashed border-border/40 bg-background/20 p-6 text-center text-xs text-muted-foreground">Click <strong class="text-foreground">Fingerprint</strong> to fire the 10-probe set.</div>
        {:else}
          <ul class="flex max-h-[calc(100vh-30rem)] flex-col gap-1.5 overflow-y-auto pr-1 cryptex-scroll">
            {#each results as r (r.id)}
              {@const refused = r.judgeScore < 0.4}
              {@const fp = fingerprintResponse(r.targetReply, refused)}
              <li class="rounded-lg border border-input bg-background/70 p-2.5">
                <div class="flex items-center gap-2">
                  <code class="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[11px]">{r.id}</code>
                  <span class={'rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ' + (refused ? 'border-red-500/30 bg-red-500/5 text-red-400' : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400')}>
                    {refused ? 'refused' : 'allowed'}
                  </span>
                  <span class="ml-auto font-mono text-[10px] text-muted-foreground">{DEFENSE_CLASS_LABELS[fp.classifier]} · {fp.confidence}</span>
                </div>
                {#if fp.signals.length > 0}
                  <p class="mt-1 text-[10px] italic text-muted-foreground">{fp.signals.join('; ')}</p>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  </div>
</section>
