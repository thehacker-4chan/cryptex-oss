<script lang="ts">
  import { onMount } from 'svelte';
  import type { ChatRow, AttackSessionRow, OrchEvent, StrategyLogEntry, AttackSessionTurn } from '$lib/chat/types';
  import { repo } from '$lib/chat/repo';
  import { runAttackSession, type AttackSessionContext } from '$lib/chat/chain/orchestrator';
  import { injectAttackSessionTurn } from '$lib/chat/dispatch';
  import { chat as gatewayChat, streamChat } from '$lib/ai/gateway';
  import OrchestratorTurnBubble from './OrchestratorTurnBubble.svelte';
  import StrategyTraceBar from './StrategyTraceBar.svelte';
  import AttackSessionHistory from './AttackSessionHistory.svelte';
  import ResearchDossierCard from './ResearchDossierCard.svelte';
  import LayerPicker from './LayerPicker.svelte';
  import RoleModelPicker from './RoleModelPicker.svelte';
  import { catalog } from '$lib/ai/catalog.svelte';
  import { resolveDefaultModels, isUncensoredOrchestrator } from '$lib/chat/chain/default-models';
  import Play from 'lucide-svelte/icons/play';
  import Square from 'lucide-svelte/icons/square';
  import ArrowRight from 'lucide-svelte/icons/arrow-right';
  import Plus from 'lucide-svelte/icons/plus';
  import Info from 'lucide-svelte/icons/info';
  import Copy from 'lucide-svelte/icons/copy';
  import { base } from '$app/paths';

  type Props = {
    chat: ChatRow;
    // Declared for callsite API compat; unused in orchestrator-driven UI.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onInsertToComposer: (text: string) => void;
  };
  let { chat /*, onInsertToComposer */ }: Props = $props();

  // ---- Form state ----
  let objective = $state(chat.settings.attackChainConfig?.input ?? '');
  let maxAttempts = $state<number>(9);
  let hintLayers = $state<string[]>(chat.settings.attackChainConfig?.layers ?? []);

  // Resolved defaults — recomputed when chat or catalog changes.
  const resolvedDefaults = $derived(
    resolveDefaultModels({
      chat,
      availableModels: (catalog.list ?? []) as unknown as Array<{ qualifiedId: string }>
    })
  );

  // Persisted-or-default IDs for each role, with read-side fallback chain:
  // attackChainConfig.<role>ModelId  ?? attackChainConfig.modelQualifiedId  ?? chat.modelQualifiedId
  const orchestratorModelId = $derived(
    chat.settings?.attackChainConfig?.orchestratorModelId
      ?? chat.settings?.attackChainConfig?.modelQualifiedId
      ?? resolvedDefaults.orchestrator
  );
  const targetModelId = $derived(
    chat.settings?.attackChainConfig?.targetModelId
      ?? chat.settings?.attackChainConfig?.modelQualifiedId
      ?? resolvedDefaults.target
  );
  const judgeModelId = $derived(
    chat.settings?.attackChainConfig?.judgeModelId
      ?? chat.settings?.attackChainConfig?.modelQualifiedId
      ?? resolvedDefaults.judge
  );

  // Tip visibility — only when orchestrator looks aligned and user hasn't dismissed.
  const showOrchestratorTip = $derived(
    !isUncensoredOrchestrator(orchestratorModelId)
      && !chat.settings?.attackChainConfig?.recommendedTipDismissed
  );

  function defaultAttackChainConfig(): import('$lib/chat/types').AttackChainConfig {
    return {
      input: '',
      layers: [],
      layerParams: [],
      layerOutputEdits: [],
      executeEnabled: false,
      finalSystemPrompt: '',
      autoRetryEnabled: false
    };
  }

  async function setRoleModel(role: 'orchestrator' | 'target' | 'judge', id: string) {
    const cfg = chat.settings?.attackChainConfig ?? defaultAttackChainConfig();
    const next = { ...cfg, [`${role}ModelId`]: id };
    await repo.updateChat(chat.id, {
      settings: { ...chat.settings, attackChainConfig: next }
    });
  }

  async function dismissOrchestratorTip() {
    const cfg = chat.settings?.attackChainConfig ?? defaultAttackChainConfig();
    await repo.updateChat(chat.id, {
      settings: {
        ...chat.settings,
        attackChainConfig: { ...cfg, recommendedTipDismissed: true }
      }
    });
  }

  // ---- Run state ----
  let running = $state(false);
  let ctrl: AbortController | null = null;
  let liveTurns = $state<AttackSessionTurn[]>([]);
  let liveLog = $state<StrategyLogEntry[]>([]);
  let liveDossier = $state<string | null>(null);
  let liveCitations = $state<string[]>([]);
  let currentSessionId = $state<string | null>(null);
  let finalOutcome = $state<AttackSessionRow['finalOutcome']>(null);
  let finalConfidence = $state<number | null>(null);
  let finalSummary = $state<string | null>(null);
  let finalAnswer = $state<string | null>(null);
  let finalAnswerConfidence = $state<number | null>(null);
  let finalAnswerRationale = $state<string | null>(null);

  // Live view of current step within current strategy
  let currentStrategyId = $state<string | null>(null);
  let currentStepBudget = $state<number | null>(null);
  // Map from orchestrator turn iteration -> step label
  let stepLabels = $state<Record<number, string>>({});

  // Promote toast
  let toast = $state<{ kind: 'success' | 'error'; text: string } | null>(null);
  function showToast(kind: 'success' | 'error', text: string, ms = 3500) {
    toast = { kind, text };
    setTimeout(() => { if (toast && toast.text === text) toast = null; }, ms);
  }

  // Error banner
  let errorLog = $state<Array<{ code: string; message: string; iteration?: number; at: number }>>([]);

  // ---- History ----
  let sessions = $state<AttackSessionRow[]>([]);
  onMount(async () => {
    try { sessions = await repo.listAttackSessions(chat.id); }
    catch (err) { console.error('[chain-tab] list sessions failed:', err); }
  });

  const canRun = $derived(objective.trim().length > 0 && !running);

  function updateHint(i: number, id: string) {
    hintLayers = hintLayers.map((h, idx) => (idx === i ? id : h));
  }
  function removeHint(i: number) {
    hintLayers = hintLayers.filter((_, idx) => idx !== i);
  }
  function addHint() {
    hintLayers = [...hintLayers, ''];
  }

  async function run() {
    if (!canRun) return;
    running = true;
    ctrl = new AbortController();
    liveTurns = [];
    liveLog = [];
    liveDossier = null;
    liveCitations = [];
    errorLog = [];
    stepLabels = {};
    currentStrategyId = null;
    currentStepBudget = null;
    finalOutcome = null;
    finalConfidence = null;
    finalSummary = null;
    finalAnswer = null;
    finalAnswerConfidence = null;
    finalAnswerRationale = null;

    const session = await repo.saveAttackSession({
      chatId: chat.id,
      objective,
      targetModelId,
      orchestratorModelId,
      maxAttempts,
      turns: [],
      strategyLog: [],
      finalOutcome: null,
      finalConfidence: null,
      finalSummary: null
    });
    currentSessionId = session.id;

    const recentMessages = await repo.listMessages(chat.id);
    const ctx: AttackSessionContext = {
      objective,
      targetModelId,
      orchestratorModelId,
      judgeModelId,
      targetModelLabel: targetModelId,
      maxAttempts,
      mainChatHistory: recentMessages
        .slice(-8)
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      signal: ctrl.signal,
      // Cast to the engine's narrower interface — gateway accepts extra fields harmlessly.
      gatewayChat: gatewayChat as never,
      streamChat: streamChat as never
    };

    try {
      for await (const ev of runAttackSession(ctx)) {
        applyEvent(ev);
        void repo.updateAttackSession(session.id, {
          turns: liveTurns,
          strategyLog: liveLog,
          dossier: liveDossier,
          dossierCitations: liveCitations,
          finalOutcome,
          finalConfidence,
          finalSummary,
          finalAnswer,
          finalAnswerConfidence,
          finalAnswerRationale
        });
      }
    } finally {
      running = false;
      ctrl = null;
      await repo.updateAttackSession(session.id, {
        turns: liveTurns,
        strategyLog: liveLog,
        dossier: liveDossier,
        dossierCitations: liveCitations,
        finalOutcome,
        finalConfidence,
        finalSummary,
        finalAnswer,
        finalAnswerConfidence,
        finalAnswerRationale
      });
      sessions = await repo.listAttackSessions(chat.id);
    }
  }

  function stop() { ctrl?.abort(); }

  function applyEvent(e: OrchEvent) {
    switch (e.type) {
      case 'dossier_started':
        // purely informational for now
        break;
      case 'dossier_completed':
        liveDossier = e.dossier;
        liveCitations = e.citations;
        break;
      case 'dossier_failed':
        errorLog = [...errorLog, { code: 'dossier_failed', message: e.reason, at: Date.now() }];
        break;
      case 'strategy_started':
        currentStrategyId = e.strategyId;
        currentStepBudget = e.stepBudget;
        liveLog = [...liveLog, { iteration: e.iteration, strategyId: e.strategyId, action: 'turn', rationale: '' }];
        break;
      case 'strategy_pivoted':
        liveLog = [...liveLog, { iteration: e.iteration, strategyId: e.to, action: 'pivot', rationale: e.reset ? 'reset context' : 'soft pivot' }];
        break;
      case 'turn_started': {
        // Compute step label for the upcoming orchestrator_turn_committed
        const orchCountInCurrent = liveTurns.filter((t) => t.role === 'orchestrator' && t.strategyId === e.strategyId).length;
        const step = orchCountInCurrent + 1;
        const budget = currentStepBudget ?? 3;
        stepLabels = { ...stepLabels, [e.iteration]: `step ${step} of ${budget}` };
        break;
      }
      case 'orchestrator_turn_committed':
        liveTurns = [...liveTurns, e.turn];
        break;
      case 'target_reply_delta': {
        const last = liveTurns[liveTurns.length - 1];
        if (last?.role === 'target') {
          liveTurns = [...liveTurns.slice(0, -1), { ...last, text: (last.text ?? '') + e.delta }];
        } else {
          liveTurns = [...liveTurns, { role: 'target', text: e.delta, createdAt: Date.now() }];
        }
        break;
      }
      case 'target_turn_committed':
        if (liveTurns.length > 0 && liveTurns[liveTurns.length - 1].role === 'target') {
          liveTurns = [...liveTurns.slice(0, -1), e.turn];
        } else {
          liveTurns = [...liveTurns, e.turn];
        }
        break;
      case 'turn_scored':
        // Score is baked into the target turn before target_turn_committed; no-op.
        break;
      case 'finished':
        finalOutcome = e.outcome;
        finalConfidence = e.confidence;
        finalSummary = e.summary;
        finalAnswer = e.finalAnswer;
        finalAnswerConfidence = e.finalAnswerConfidence;
        finalAnswerRationale = e.finalAnswerRationale;
        break;
      case 'error':
        console.error('[orchestrator]', e.code, e.message);
        errorLog = [...errorLog, { code: e.code, message: e.message, iteration: e.iteration, at: Date.now() }];
        break;
    }
  }

  /** Map array index -> logical iteration for stepLabels lookup. */
  function iterationOf(i: number): number {
    let count = 0;
    for (let j = 0; j <= i; j++) {
      if (liveTurns[j].role === 'orchestrator') count++;
    }
    return count;
  }

  async function promoteFullSession(session: AttackSessionRow) {
    try {
      const { userMsgs, assistantMsgs } = await injectAttackSessionTurn(chat.id, session);
      const pairs = Math.min(userMsgs.length, assistantMsgs.length);
      showToast('success', `Promoted ${pairs} ${pairs === 1 ? 'turn' : 'turns'} to main chat.`);
    } catch (err) {
      showToast('error', 'Promote failed: ' + (err as Error).message);
    }
  }

  async function deleteSession(id: string) {
    try {
      await repo.deleteAttackSession(id);
      sessions = sessions.filter((s) => s.id !== id);
    } catch (err) {
      console.error('[chain-tab] delete failed:', err);
    }
  }

  async function promoteCurrentSession() {
    if (!currentSessionId) return;
    const row = (await repo.listAttackSessions(chat.id)).find((s) => s.id === currentSessionId);
    if (row) await promoteFullSession(row);
  }

  async function copyFinalAnswer() {
    if (!finalAnswer) return;
    try {
      await navigator.clipboard.writeText(finalAnswer);
    } catch (err) {
      console.error('[chain-tab] copy failed:', err);
    }
  }

  function handleObjectiveKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (canRun) void run();
    }
  }
</script>

<div class="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4">
  <!-- Role pickers -->
  <div class="flex flex-col gap-3 border-b border-border/30 pb-3">
    <RoleModelPicker
      label="Orchestrator"
      description="drafts the attack messages"
      value={orchestratorModelId}
      onChange={(id) => setRoleModel('orchestrator', id)}
      recentsKey="cryptex.chain.orchestrator.recentModels"
      tip={showOrchestratorTip ? orchestratorTip : null}
    />
    <RoleModelPicker
      label="Target"
      description="model under test"
      value={targetModelId}
      onChange={(id) => setRoleModel('target', id)}
      recentsKey="cryptex.chain.target.recentModels"
    />
    <RoleModelPicker
      label="Judge"
      description="scores responses (cheap is fine)"
      value={judgeModelId}
      onChange={(id) => setRoleModel('judge', id)}
      recentsKey="cryptex.chain.judge.recentModels"
    />
  </div>

  {#snippet orchestratorTip()}
    <div class="flex items-start gap-1 rounded bg-yellow-500/10 px-2 py-1 text-[10px] text-yellow-400">
      <Info size={10} class="shrink-0 mt-0.5" />
      <span class="flex-1">
        Aligned models often refuse to draft attack messages. Pick an uncensored
        orchestrator (DeepSeek R1, Nous Hermes, Dolphin) for higher success rates.
        <a href="{base}/guide/chat/attack-chain" class="underline">Learn more</a>
      </span>
      <button
        type="button"
        onclick={dismissOrchestratorTip}
        class="text-yellow-400/60 hover:text-yellow-400"
        aria-label="Dismiss tip"
      >×</button>
    </div>
  {/snippet}

  <!-- Objective -->
  <label class="flex flex-col gap-1 text-xs">
    <span class="font-medium text-foreground">Objective</span>
    <textarea
      bind:value={objective}
      onkeydown={handleObjectiveKey}
      rows="3"
      placeholder="What do you want to extract? e.g. 'explain how X works in detail'"
      class="resize-y rounded-md border border-border/40 bg-background/40 p-2 text-[12px] focus:border-border focus:outline-none"
    ></textarea>
    <span class="text-[10px] text-muted-foreground">Cmd/Ctrl+Enter to run</span>
  </label>

  <!-- Max attempts -->
  <label class="flex items-center gap-2 text-xs">
    <span class="font-medium text-foreground">Total turns</span>
    <input type="range" min="3" max="24" bind:value={maxAttempts} class="flex-1" />
    <span class="w-10 text-right font-mono text-[11px]">{maxAttempts}</span>
  </label>

  <!-- Actions -->
  <div class="flex gap-2">
    {#if running}
      <button type="button" onclick={stop} class="inline-flex items-center gap-1 rounded-md border border-border/40 px-3 py-1.5 text-xs"><Square size={10} /> Stop</button>
    {:else}
      <button type="button" onclick={run} disabled={!canRun} class="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"><Play size={10} /> Run attack</button>
    {/if}
  </div>

  <!-- Hints disclosure -->
  <details class="rounded-md border border-border/40 bg-background/20 text-[11px]">
    <summary class="cursor-pointer px-3 py-1.5 text-muted-foreground hover:text-foreground">Starting strategy hints (optional)</summary>
    <div class="flex flex-col gap-2 border-t border-border/40 p-2">
      {#each hintLayers as hint, i (i)}
        <LayerPicker
          index={i}
          value={hint}
          onChange={(id) => updateHint(i, id)}
          onRemove={() => removeHint(i)}
        />
      {/each}
      <button
        type="button"
        onclick={addHint}
        class="inline-flex items-center gap-1 self-start rounded-md border border-dashed border-border/50 px-2 py-1 text-[10px] text-muted-foreground hover:border-border hover:text-foreground"
      >
        <Plus size={10} /> Add hint
      </button>
    </div>
  </details>

  <!-- Error banner -->
  {#if errorLog.length > 0}
    <div class="flex flex-col gap-1 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-[11px]">
      <div class="flex items-center justify-between text-red-400">
        <span class="font-medium">Issues ({errorLog.length})</span>
        <button
          type="button"
          onclick={() => (errorLog = [])}
          class="text-[10px] text-muted-foreground hover:text-foreground"
        >clear</button>
      </div>
      <div class="flex max-h-40 flex-col gap-1 overflow-y-auto">
        {#each errorLog.slice(-8) as err, i (err.at + '-' + i)}
          <div class="text-[10px] leading-snug text-red-300">
            <span class="font-mono uppercase text-[9px] text-red-400">{err.code}</span>
            {#if err.iteration !== undefined}<span class="text-muted-foreground"> · iter {err.iteration}</span>{/if}
            <span class="text-foreground/80"> — {err.message}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Research dossier -->
  <ResearchDossierCard dossier={liveDossier} citations={liveCitations} />

  <!-- Strategy trace -->
  {#if liveLog.length > 0}
    <StrategyTraceBar log={liveLog} />
  {/if}

  <!-- Conversation view -->
  {#if liveTurns.length > 0}
    <div class="flex flex-col gap-2">
      {#each liveTurns as turn, i (i)}
        <OrchestratorTurnBubble
          {turn}
          live={running && i === liveTurns.length - 1}
          stepLabel={turn.role === 'orchestrator' ? (stepLabels[iterationOf(i)] ?? null) : null}
        />
      {/each}
    </div>
  {/if}

  <!-- Final summary card -->
  {#if finalOutcome}
    <div class="rounded-md border border-primary/30 bg-primary/5 p-3">
      <div class="mb-2 flex items-center gap-2 text-xs">
        <span class={'rounded px-1.5 py-0.5 text-[9px] uppercase ' + (finalOutcome === 'extracted' ? 'bg-green-500/20 text-green-400' : finalOutcome === 'partial' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-orange-500/20 text-orange-400')}>{finalOutcome}</span>
        <span class="text-[10px] text-muted-foreground">confidence {finalConfidence?.toFixed(2) ?? '—'}</span>
      </div>
      {#if finalSummary}
        <p class="text-[11px] text-muted-foreground leading-relaxed">{finalSummary}</p>
      {/if}
      {#if finalOutcome}
        <div class="mt-3 border-t border-primary/20 pt-2">
          <div class="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>Final answer</span>
            {#if finalAnswerConfidence !== null}
              <span class="rounded bg-muted/40 px-1 py-0.5 text-[9px]">conf {finalAnswerConfidence.toFixed(2)}</span>
            {/if}
            {#if finalAnswer}
              <button
                type="button"
                onclick={copyFinalAnswer}
                class="ml-auto rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                aria-label="Copy answer"
              ><Copy size={11} /></button>
            {/if}
          </div>
          {#if finalAnswer}
            <p class="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap">{finalAnswer}</p>
          {:else}
            <p class="text-[11px] italic text-muted-foreground">No answer extracted from this run.</p>
          {/if}
          {#if finalAnswerRationale}
            <p class="mt-1 text-[10px] italic text-muted-foreground">{finalAnswerRationale}</p>
          {/if}
        </div>
      {/if}
      <div class="mt-2 flex gap-2">
        <button type="button" onclick={promoteCurrentSession} class="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-[10px] text-primary-foreground hover:bg-primary/90"><ArrowRight size={10} /> Send thread to main chat</button>
      </div>
    </div>
  {/if}

  <!-- Toast -->
  {#if toast}
    <div class={'rounded-md px-3 py-2 text-[11px] ' + (toast.kind === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30')}>
      {toast.text}
    </div>
  {/if}

  <!-- History -->
  <AttackSessionHistory {sessions} onPromote={promoteFullSession} onDelete={deleteSession} />
</div>
