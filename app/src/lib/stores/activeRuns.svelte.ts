/**
 * Module-level registry of in-flight tool runs.
 *
 * Survives route navigation because runs are NOT tied to any component
 * lifecycle — once a tool calls `activeRuns.start(...)`, the run keeps
 * receiving updates from its async producer even after the tool's
 * `+page.svelte` unmounts. When the component remounts, it just reads
 * `activeRuns.get(toolId)` and renders whatever state is current.
 *
 * Each `ActiveRun` carries an `AbortController` so cancellation is
 * uniform across tools — `activeRuns.cancel(toolId)` does the right
 * thing regardless of who started the run.
 *
 * The `data` field is generic per-tool. The registry doesn't know or
 * care what's inside — it just keeps the run alive.
 */

export type ToolRunStatus = 'running' | 'done' | 'error' | 'cancelled';

export interface ActiveRun<TData = unknown> {
  toolId: string;
  status: ToolRunStatus;
  startedAt: number;
  finishedAt?: number;
  /** Last meaningful update timestamp. Used for "X seconds ago" hints. */
  updatedAt: number;
  /** AbortController so any consumer can cancel the run. */
  controller: AbortController;
  /** Tool-specific data — leaderboard rows, diff entries, etc. */
  data: TData;
  /** Optional summary line for the global indicator hover. */
  summary?: string;
  /** Optional error message if status === 'error'. */
  error?: string;
}

class ActiveRunsRegistry {
  private _runs = $state<Map<string, ActiveRun>>(new Map());

  /** All active runs. Reactive. */
  get values(): ActiveRun[] {
    return [...this._runs.values()];
  }

  /** Number of currently-running runs. Reactive. */
  get runningCount(): number {
    let n = 0;
    for (const r of this._runs.values()) if (r.status === 'running') n++;
    return n;
  }

  /** Get the run for a specific tool, if any. Reactive. */
  get<T = unknown>(toolId: string): ActiveRun<T> | undefined {
    return this._runs.get(toolId) as ActiveRun<T> | undefined;
  }

  /** True if a tool has a currently-running run. Reactive. */
  isRunning(toolId: string): boolean {
    const r = this._runs.get(toolId);
    return r?.status === 'running';
  }

  /**
   * Start a new run. Replaces any existing run for the same toolId
   * (cancelling it first via its AbortController).
   */
  start<T>(toolId: string, initialData: T, summary?: string): ActiveRun<T> {
    const existing = this._runs.get(toolId);
    if (existing && existing.status === 'running') {
      try {
        existing.controller.abort();
      } catch {
        /* ignore */
      }
    }
    const run: ActiveRun<T> = {
      toolId,
      status: 'running',
      startedAt: Date.now(),
      updatedAt: Date.now(),
      controller: new AbortController(),
      data: initialData,
      summary
    };
    this._runs.set(toolId, run as ActiveRun);
    this._runs = new Map(this._runs); // trigger Svelte reactivity
    return run;
  }

  /**
   * Update an in-flight run's data. The mutator receives the current
   * `data` and may return a new value (or mutate in-place and return undefined).
   */
  update<T>(toolId: string, mutator: (data: T) => T | void, summary?: string): void {
    const run = this._runs.get(toolId);
    if (!run) return;
    const next = mutator(run.data as T);
    if (next !== undefined) (run as ActiveRun<T>).data = next;
    run.updatedAt = Date.now();
    if (summary !== undefined) run.summary = summary;
    this._runs = new Map(this._runs);
  }

  /** Mark a run as finished successfully. */
  finish(toolId: string, summary?: string): void {
    const run = this._runs.get(toolId);
    if (!run) return;
    run.status = 'done';
    run.finishedAt = Date.now();
    run.updatedAt = Date.now();
    if (summary !== undefined) run.summary = summary;
    this._runs = new Map(this._runs);
  }

  /** Mark a run as failed. */
  fail(toolId: string, error: string): void {
    const run = this._runs.get(toolId);
    if (!run) return;
    run.status = 'error';
    run.finishedAt = Date.now();
    run.updatedAt = Date.now();
    run.error = error;
    this._runs = new Map(this._runs);
  }

  /**
   * Cancel a running run via its AbortController. The tool's own logic
   * should handle the abort and call .fail() or rely on this method's
   * status update to mark the run cancelled.
   */
  cancel(toolId: string): void {
    const run = this._runs.get(toolId);
    if (!run) return;
    try {
      run.controller.abort();
    } catch {
      /* ignore */
    }
    run.status = 'cancelled';
    run.finishedAt = Date.now();
    run.updatedAt = Date.now();
    this._runs = new Map(this._runs);
  }

  /** Drop a run from the registry entirely (e.g., when user dismisses results). */
  clear(toolId: string): void {
    this._runs.delete(toolId);
    this._runs = new Map(this._runs);
  }
}

export const activeRuns = new ActiveRunsRegistry();
