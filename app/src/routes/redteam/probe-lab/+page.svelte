<script lang="ts">
  import { fanout, type FanoutResult, type FanoutItem } from '$lib/redteam/fanout';
  import { mutatorTechniques } from '$lib/chat/techniques/from-mutators';
  import { chat as gatewayChat, streamChat as gatewayStreamChat, hasAnyKey as hasApiKey } from '$lib/ai/gateway';
  import ModelPickerV2 from '$lib/components/ai/ModelPickerV2.svelte';
  import NoProviderBanner from '$lib/components/ai/NoProviderBanner.svelte';
  import { createPersistedState } from '$lib/stores/_persisted.svelte';
  import { useToolState } from '$lib/stores/tool-state.svelte';
  import { notify } from '$lib/stores/toast.svelte';
  import Loader from 'lucide-svelte/icons/loader-circle';
  import Play from 'lucide-svelte/icons/play';
  import Square from 'lucide-svelte/icons/square';
  import Copy from 'lucide-svelte/icons/copy';
  import UsageHint from '$lib/components/shell/UsageHint.svelte';

  const targetModelPref = createPersistedState<string>('cryptex.probelab.target', 'openrouter:openrouter/auto');
  const judgeModelPref = createPersistedState<string>('cryptex.probelab.judge', 'openrouter:openai/gpt-4o-mini');

  const task = useToolState<string>('probe-lab', 'task', '');
  let running = $state(false);
  let controller: AbortController | null = null;
  let results = $state<FanoutResult[]>([]);
  let progress = $state(0);
  let total = $state(0);
  let errorMsg = $state('');

  const keyConfigured = $derived(hasApiKey());

  // Build the candidate list from all mutators that expose a localTemplate
  // (so we can deterministically synthesize the prompt without an extra LLM
  // round-trip per mutator). Excludes the meta `custom` mutator which needs
  // user-supplied instruction.
  const candidates = $derived.by<FanoutItem[]>(() => {
    if (!task.value.trim()) return [];
    const muts = mutatorTechniques().filter(
      (m) => m.id !== 'custom' && typeof m.localTemplate === 'function'
    );
    return muts.map((m) => ({
      id: m.id,
      name: m.name,
      prompt: m.localTemplate!(task.value, {}, task.value)
    }));
  });

  // Mutators that exist in the registry but get skipped because they don't
  // expose a localTemplate (e.g. tap_seeder, many_shot — those need an
  // LLM round-trip to generate the variant). Surfaced in the UI so users
  // know why the leaderboard is shorter than the full mutator catalog.
  const skippedMutators = $derived.by(() => {
    return mutatorTechniques().filter(
      (m) => m.id !== 'custom' && typeof m.localTemplate !== 'function'
    );
  });

  async function runProbe() {
    if (!task.value.trim()) {
      errorMsg = 'Enter a task to probe.';
      return;
    }
    if (!keyConfigured) {
      errorMsg = 'No provider configured. Add one in Settings.';
      return;
    }
    running = true;
    errorMsg = '';
    results = [];
    progress = 0;
    total = candidates.length;
    controller = new AbortController();

    try {
      await fanout({
        task: task.value,
        items: candidates,
        targetModelId: targetModelPref.value,
        judgeModelId: judgeModelPref.value,
        signal: controller.signal,
        gateway: { chat: gatewayChat, streamChat: gatewayStreamChat },
        concurrency: 5,
        onResult: (r) => {
          // Push the streaming result + maintain sort order live.
          results = [...results, r].sort((a, b) => b.judgeScore - a.judgeScore);
          progress = results.length;
        }
      });
      notify.success(`Probed ${total} techniques`);
    } catch (err) {
      errorMsg = (err as Error).message ?? 'Probe failed';
    } finally {
      running = false;
      controller = null;
    }
  }

  function stop() {
    controller?.abort();
    running = false;
  }

  async function copyReply(r: FanoutResult) {
    try {
      await navigator.clipboard.writeText(r.targetReply);
      notify.success('Reply copied');
    } catch {
      notify.error('Copy failed');
    }
  }

  function scoreColor(s: number): string {
    if (s >= 0.7) return 'text-emerald-400';
    if (s >= 0.4) return 'text-amber-400';
    return 'text-muted-foreground';
  }
</script>

<svelte:head><title>Probe Lab · Cryptex</title></svelte:head>

<section class="space-y-6">
  <header class="space-y-2">
    <div class="flex items-center gap-2">
      <h1 class="font-serif text-3xl sm:text-4xl tracking-tight text-balance">
        Probe <span class="text-primary italic">lab</span>
      </h1>
      <UsageHint
        title="Probe lab · Usage"
        bullets={[
          'Paste a task; every mutator fans out in parallel against one target.',
          'Local templates for deterministic mutators; LLM call for generative ones.',
          'Judge scores each response; leaderboard sorts highest-first.',
          'Stop button cancels in-flight requests safely.'
        ]}
      />
    </div>
    <p class="text-muted-foreground max-w-2xl text-sm sm:text-base">
      Paste a task, fan out to every mutator with a deterministic local template, score each
      response with a judge model, see the leaderboard. One target model, all techniques in
      parallel — fastest way to see which framings break a target.
    </p>
  </header>

  <NoProviderBanner context="tool" />

  <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
    <!-- Sidebar -->
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass lg:sticky lg:top-20 lg:self-start">
      <div class="space-y-1">
        <span class="text-xs text-muted-foreground">Target model</span>
        <ModelPickerV2
          value={targetModelPref.value}
          onChange={(v) => (targetModelPref.value = v)}
          recentsKey="cryptex.probelab.recentTarget"
        />
      </div>

      <div class="space-y-1">
        <span class="text-xs text-muted-foreground">Judge model</span>
        <ModelPickerV2
          value={judgeModelPref.value}
          onChange={(v) => (judgeModelPref.value = v)}
          recentsKey="cryptex.probelab.recentJudge"
        />
      </div>

      <div class="border-t border-border/40 pt-3">
        <div class="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Probes ready</span>
          <span class="font-mono text-foreground">{candidates.length}</span>
        </div>
        {#if skippedMutators.length > 0}
          <p class="mb-2 text-[10px] leading-snug text-muted-foreground">
            {skippedMutators.length} mutator{skippedMutators.length === 1 ? '' : 's'} need an LLM round-trip and aren't probed locally:
            <span class="font-mono text-[10px]">{skippedMutators.map((m) => m.id).join(', ')}</span>
          </p>
        {/if}
        {#if running}
          <div class="mb-2 text-xs text-muted-foreground">
            <span>Progress</span>
            <span class="ml-2 font-mono text-foreground">{progress} / {total}</span>
            <div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
              <div class="h-full bg-primary transition-all" style="width: {total > 0 ? (progress / total) * 100 : 0}%"></div>
            </div>
          </div>
        {/if}
        {#if running}
          <button
            type="button"
            onclick={stop}
            class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card/40 px-3.5 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Square size={14} /> Stop
          </button>
        {:else}
          <button
            type="button"
            onclick={runProbe}
            disabled={!task.value.trim() || !keyConfigured}
            class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play size={14} /> Probe all
          </button>
        {/if}
      </div>

      {#if errorMsg}
        <p class="text-xs text-destructive">{errorMsg}</p>
      {/if}

      <div class="rounded-md border border-border/40 bg-background/40 p-2 text-[11px] leading-relaxed text-muted-foreground">
        Each mutator's <code class="rounded bg-muted/40 px-1 py-0.5 font-mono text-[10px]">localTemplate</code> generates the prompt; target streams the reply; judge scores it 0-1.
      </div>
    </div>

    <!-- Right — task + leaderboard -->
    <div class="space-y-4">
      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <h2 class="font-serif text-sm">Task</h2>
        <textarea
          bind:value={task.value}
          rows="4"
          placeholder="What do you want to probe across all techniques?"
          disabled={running}
          class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        ></textarea>
      </div>

      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <div class="flex items-center justify-between">
          <h2 class="font-serif text-sm">Leaderboard</h2>
          <span class="font-mono text-[11px] text-muted-foreground">{results.length} scored</span>
        </div>

        {#if results.length === 0 && !running}
          <div class="rounded-lg border border-dashed border-border/40 bg-background/20 p-6 text-center text-xs text-muted-foreground">
            Enter a task and click <strong class="text-foreground">Probe all</strong> to fan out across {candidates.length} techniques.
          </div>
        {:else if results.length === 0 && running}
          <div class="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border/40 bg-background/20 p-6 text-xs text-muted-foreground">
            <Loader size={14} class="animate-spin" /> Streaming responses…
          </div>
        {:else}
          <ul class="flex max-h-[calc(100vh-26rem)] flex-col gap-1.5 overflow-y-auto pr-1 cryptex-scroll">
            {#each results as r, i (r.id)}
              <li class="rounded-lg border border-input bg-background/70 p-2.5">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1 space-y-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="font-mono text-[11px] text-muted-foreground">#{i + 1}</span>
                      <code class="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-foreground">{r.id}</code>
                      <span class={'font-mono text-[11px] ' + scoreColor(r.judgeScore)}>
                        {(r.judgeScore * 100).toFixed(0)}%
                      </span>
                      <span class="font-mono text-[10px] text-muted-foreground">{r.durationMs}ms</span>
                    </div>
                    {#if r.error}
                      <p class="text-[11px] text-destructive break-words">error: {r.error}</p>
                    {:else}
                      <p class="line-clamp-3 text-[11px] leading-relaxed text-foreground break-words">{r.targetReply}</p>
                      {#if r.judgeRationale}
                        <p class="text-[10px] italic text-muted-foreground">judge: {r.judgeRationale}</p>
                      {/if}
                    {/if}
                  </div>
                  {#if r.targetReply && !r.error}
                    <button
                      type="button"
                      onclick={() => copyReply(r)}
                      class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Copy reply"
                    >
                      <Copy size={11} /> Copy
                    </button>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  </div>
</section>
