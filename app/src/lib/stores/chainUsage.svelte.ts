/**
 * Per-run token-usage accumulator for the chain workspace.
 *
 * The chain engines (v3 + v4 PAIR / TAP / Crescendo) emit `usage`
 * OrchEvents after every gateway call. AttackChainTab.svelte forwards
 * each event into `chainUsageActions.accumulate()`, which sums tokens
 * per role + per model. The compact `UsageChip.svelte` in the chain
 * sidebar header reads `chainUsage` directly to render the live
 * total + breakdown popover.
 *
 * Track D-2 cleanup: dropped all pricing / USD math. Token counts
 * only. The `tokenUsage` field of each call is recorded honestly:
 * undefined input/output tokens (some openai-compat servers don't
 * report) are tracked as "unreported" rather than collapsed to 0.
 */

type Role = 'orchestrator' | 'target' | 'judge';

export type RoleUsage = {
  /** Sum of reported input tokens (excludes calls that didn't report). */
  inputTokens: number;
  /** Sum of reported output tokens. */
  outputTokens: number;
  /** Sum of reported cached input tokens (subset of inputTokens). */
  cachedInputTokens: number;
  /** Sum of reported reasoning tokens (subset of outputTokens for most providers). */
  reasoningTokens: number;
  /** Number of calls accumulated for this bucket. */
  calls: number;
  /** Number of calls where the upstream didn't report token counts.
   *  Surfaced in the chip's footer so the user knows actual usage
   *  is higher than displayed. */
  unreportedCalls: number;
};

export type ChainUsageState = {
  /** True while a run is actively emitting usage events. */
  running: boolean;
  /** The AttackSessionRow.id of the run we're tracking, or null. */
  sessionId: string | null;
  /** Sum of all roles' input tokens (reported only). */
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedInputTokens: number;
  totalReasoningTokens: number;
  /** Total calls across all roles. */
  totalCalls: number;
  /** Total calls where tokens weren't reported. */
  totalUnreportedCalls: number;
  /** Per-role accumulated usage. */
  byRole: Record<Role, RoleUsage>;
  /** Per-model accumulated usage (model id → totals). */
  byModel: Map<string, RoleUsage>;
  /** When the run started, for elapsed-time + tok/s display. Null when idle. */
  startedAt: number | null;
};

function emptyRoleUsage(): RoleUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    reasoningTokens: 0,
    calls: 0,
    unreportedCalls: 0
  };
}

function emptyState(): ChainUsageState {
  return {
    running: false,
    sessionId: null,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCachedInputTokens: 0,
    totalReasoningTokens: 0,
    totalCalls: 0,
    totalUnreportedCalls: 0,
    byRole: {
      orchestrator: emptyRoleUsage(),
      target: emptyRoleUsage(),
      judge: emptyRoleUsage()
    },
    byModel: new Map(),
    startedAt: null
  };
}

let _state = $state<ChainUsageState>(emptyState());

export const chainUsage = {
  get running() { return _state.running; },
  get sessionId() { return _state.sessionId; },
  get totalInputTokens() { return _state.totalInputTokens; },
  get totalOutputTokens() { return _state.totalOutputTokens; },
  get totalCachedInputTokens() { return _state.totalCachedInputTokens; },
  get totalReasoningTokens() { return _state.totalReasoningTokens; },
  get totalCalls() { return _state.totalCalls; },
  get totalUnreportedCalls() { return _state.totalUnreportedCalls; },
  get byRole() { return _state.byRole; },
  get byModel() { return _state.byModel; },
  get startedAt() { return _state.startedAt; },
  /** True when the chip should be hidden (no calls yet, no active run). */
  get isEmpty() {
    return !_state.running && _state.totalCalls === 0;
  }
};

export type UsageEvent = {
  role: Role;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
};

/** Add a usage event into a per-bucket RoleUsage, tracking
 *  reported-vs-unreported separately. */
function addToBucket(prev: RoleUsage, ev: UsageEvent): RoleUsage {
  const reportedSomething =
    ev.inputTokens !== undefined || ev.outputTokens !== undefined;
  return {
    inputTokens: prev.inputTokens + (ev.inputTokens ?? 0),
    outputTokens: prev.outputTokens + (ev.outputTokens ?? 0),
    cachedInputTokens: prev.cachedInputTokens + (ev.cachedInputTokens ?? 0),
    reasoningTokens: prev.reasoningTokens + (ev.reasoningTokens ?? 0),
    calls: prev.calls + 1,
    unreportedCalls: prev.unreportedCalls + (reportedSomething ? 0 : 1)
  };
}

export const chainUsageActions = {
  /** Reset for a new run. Called from AttackChainTab.run(). */
  resetForRun(sessionId: string): void {
    _state = {
      ...emptyState(),
      running: true,
      sessionId,
      startedAt: Date.now()
    };
  },

  /** Accumulate one `usage` OrchEvent into the current run state. */
  accumulate(ev: UsageEvent): void {
    if (!ev) return;
    const reportedSomething =
      ev.inputTokens !== undefined || ev.outputTokens !== undefined;

    const prevRole = _state.byRole[ev.role];
    const nextRole = addToBucket(prevRole, ev);

    const prevModel = _state.byModel.get(ev.model) ?? emptyRoleUsage();
    const nextModel = addToBucket(prevModel, ev);

    const nextByModel = new Map(_state.byModel);
    nextByModel.set(ev.model, nextModel);

    _state = {
      ..._state,
      totalInputTokens: _state.totalInputTokens + (ev.inputTokens ?? 0),
      totalOutputTokens: _state.totalOutputTokens + (ev.outputTokens ?? 0),
      totalCachedInputTokens: _state.totalCachedInputTokens + (ev.cachedInputTokens ?? 0),
      totalReasoningTokens: _state.totalReasoningTokens + (ev.reasoningTokens ?? 0),
      totalCalls: _state.totalCalls + 1,
      totalUnreportedCalls: _state.totalUnreportedCalls + (reportedSomething ? 0 : 1),
      byRole: { ..._state.byRole, [ev.role]: nextRole },
      byModel: nextByModel
    };
  },

  /** Mark the run as finished — stops the elapsed-time clock from
   *  advancing in the chip but keeps the totals visible. */
  markFinished(): void {
    _state = { ..._state, running: false };
  },

  /** Clear all state — used when the user closes the chain workspace
   *  or the chat is unmounted. */
  clear(): void {
    _state = emptyState();
  }
};
