<script lang="ts">
  import { Popover as PopoverPrimitive } from 'bits-ui';
  import { chainUsage } from '$lib/stores/chainUsage.svelte';
  import { friendlyModelName } from '$lib/ai/model-label';

  // Tick state forces the chip + popover to re-render every second so
  // the elapsed clock and tok/s rate advance during a live run.
  let tick = $state(0);
  $effect(() => {
    if (!chainUsage.running) return;
    const id = setInterval(() => {
      tick++;
    }, 1000);
    return () => clearInterval(id);
  });

  /** Format a token count compactly: 12,345 → "12.3K", 1,234,567 → "1.2M". */
  function formatTokens(n: number): string {
    if (n < 1000) return n.toString();
    if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
    return `${(n / 1_000_000).toFixed(1)}M`;
  }

  /** Format elapsed time from `startedAt` as M:SS (e.g., "0:42", "12:03"). */
  function formatElapsed(startedAt: number | null): string {
    if (!startedAt) return '—';
    void tick; // recompute every second when running
    const ms = Date.now() - startedAt;
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /** Output tokens per second across the whole run. */
  function tokRate(outputTokens: number, startedAt: number | null): string {
    if (!startedAt) return '—';
    void tick;
    const sec = (Date.now() - startedAt) / 1000;
    if (sec < 1) return '—';
    return `${(outputTokens / sec).toFixed(0)} tok/s`;
  }

  // Headline: total tokens across input + output for the chip itself.
  const headline = $derived.by(() => {
    const total = chainUsage.totalInputTokens + chainUsage.totalOutputTokens;
    return `${formatTokens(total)} tok`;
  });

  // Per-role rows for the popover detail table.
  const roleRows = $derived(
    (['orchestrator', 'target', 'judge'] as const).map((role) => {
      const u = chainUsage.byRole[role];
      return {
        role,
        label:
          role === 'orchestrator' ? 'Orchestrator'
          : role === 'target' ? 'Target'
          : 'Judge',
        ...u
      };
    })
  );
</script>

{#if !chainUsage.isEmpty}
  <PopoverPrimitive.Root>
    <PopoverPrimitive.Trigger
      aria-label={`Chain run usage: ${headline}`}
      class="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/50 bg-card/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {#if chainUsage.running}
        <span class="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></span>
      {/if}
      <span>{headline}</span>
    </PopoverPrimitive.Trigger>

    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={6}
        align="end"
        class="z-50 w-80 rounded-md border border-border/60 bg-popover p-3 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
      >
        <div class="mb-2 flex items-center justify-between text-[11px]">
          <span class="font-semibold text-foreground">Chain run usage</span>
          {#if chainUsage.startedAt}
            <span class="font-mono text-[10px] text-muted-foreground">
              elapsed {formatElapsed(chainUsage.startedAt)}
            </span>
          {/if}
        </div>

        <table class="w-full table-fixed border-collapse text-[10px]">
          <thead>
            <tr class="text-left text-muted-foreground">
              <th class="w-1/3 pb-1 font-medium">Role</th>
              <th class="pb-1 text-right font-medium">In</th>
              <th class="pb-1 text-right font-medium">Out</th>
              <th class="pb-1 text-right font-medium">Calls</th>
            </tr>
          </thead>
          <tbody class="font-mono">
            {#each roleRows as r (r.role)}
              <tr class="border-t border-border/30">
                <td class="py-0.5 text-foreground">
                  {r.label}
                  {#if r.unreportedCalls > 0}
                    <span class="ml-0.5 font-mono text-[9px] text-amber-400" title="Calls where the upstream didn't report token counts">
                      · {r.unreportedCalls}?
                    </span>
                  {/if}
                </td>
                <td class="py-0.5 text-right text-muted-foreground">
                  {r.calls === 0 ? '—' : formatTokens(r.inputTokens)}
                </td>
                <td class="py-0.5 text-right text-muted-foreground">
                  {r.calls === 0 ? '—' : formatTokens(r.outputTokens)}
                </td>
                <td class="py-0.5 text-right text-muted-foreground">{r.calls}</td>
              </tr>
            {/each}
            <tr class="border-t border-border/60 font-semibold">
              <td class="pt-1.5 text-foreground">Total</td>
              <td class="pt-1.5 text-right text-foreground">{formatTokens(chainUsage.totalInputTokens)}</td>
              <td class="pt-1.5 text-right text-foreground">{formatTokens(chainUsage.totalOutputTokens)}</td>
              <td class="pt-1.5 text-right text-foreground">{chainUsage.totalCalls}</td>
            </tr>
          </tbody>
        </table>

        <!-- Speed + cached/reasoning sub-row -->
        <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <span class="font-mono">Speed: <span class="text-foreground">{tokRate(chainUsage.totalOutputTokens, chainUsage.startedAt)}</span></span>
          {#if chainUsage.totalCachedInputTokens > 0}
            <span class="font-mono">Cached in: <span class="text-foreground">{formatTokens(chainUsage.totalCachedInputTokens)}</span></span>
          {/if}
          {#if chainUsage.totalReasoningTokens > 0}
            <span class="font-mono">Reasoning: <span class="text-foreground">{formatTokens(chainUsage.totalReasoningTokens)}</span></span>
          {/if}
        </div>

        {#if chainUsage.totalUnreportedCalls > 0}
          <p class="mt-2 rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-[9px] italic leading-relaxed text-amber-300">
            <span class="font-mono">{chainUsage.totalUnreportedCalls}</span> call{chainUsage.totalUnreportedCalls === 1 ? '' : 's'}
            had no token usage reported by the upstream — actual count is higher than shown.
          </p>
        {/if}

        {#if chainUsage.byModel.size > 1}
          <div class="mt-2 border-t border-border/30 pt-2">
            <p class="mb-1 text-[10px] font-medium text-muted-foreground">By model</p>
            <ul class="space-y-0.5">
              {#each [...chainUsage.byModel.entries()] as [modelId, usage] (modelId)}
                <li class="flex items-center justify-between gap-2 text-[10px]">
                  <code class="truncate font-mono text-muted-foreground" title={modelId}>{friendlyModelName(modelId)}</code>
                  <span class="shrink-0 font-mono text-muted-foreground">
                    {formatTokens(usage.inputTokens + usage.outputTokens)} tok · {usage.calls} call{usage.calls === 1 ? '' : 's'}
                  </span>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  </PopoverPrimitive.Root>
{/if}
