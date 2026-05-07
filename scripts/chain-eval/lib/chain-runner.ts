/**
 * Driver wrapping `runAttackSession` for the chain-eval CLI.
 *
 * Drives the orchestrator generator to completion, accumulating the
 * metrics we care about for the empirical comparison:
 *
 *   maxProgress       — the highest objectiveProgress (0..10) the judge
 *                       awarded any target turn.
 *   finalOutcome      — extracted | partial | abandoned, from the
 *                       'finished' event.
 *   turnsUsed         — count of orchestrator+target round trips.
 *   refusalCount      — target turns the judge tagged as 'refusal'.
 *   strategyLeapCount — emitted once Track A.1 lands; pre-A.1 always 0.
 *   plateauPivotCount — emitted once Track A.4 lands; pre-A.4 always 0.
 *   error             — first non-aborted engine error message, if any.
 *   firstReachAt      — turn index at which maxProgress was first achieved.
 */
import { runAttackSession, type AttackSessionContext } from '$lib/chat/chain/orchestrator';
import type { OrchEvent } from '$lib/chat/types';

export interface CellMetrics {
  maxProgress: number;
  firstReachAt: number; // 1-indexed turn number; 0 if never scored
  finalOutcome: 'extracted' | 'partial' | 'abandoned' | 'crashed';
  turnsUsed: number;
  refusalCount: number;
  strategyLeapCount: number;
  plateauPivotCount: number;
  dossierUsed: boolean;
  error: string | null;
  /** Walltime in ms across the entire chain run. */
  durationMs: number;
}

export async function runEvalCell(
  ctx: Omit<AttackSessionContext, 'mainChatHistory'> & { mainChatHistory?: AttackSessionContext['mainChatHistory'] }
): Promise<CellMetrics> {
  const started = Date.now();
  const fullCtx: AttackSessionContext = {
    ...ctx,
    mainChatHistory: ctx.mainChatHistory ?? []
  };
  let maxProgress = 0;
  let firstReachAt = 0;
  let turnsUsed = 0;
  let refusalCount = 0;
  let strategyLeapCount = 0;
  let plateauPivotCount = 0;
  let dossierUsed = false;
  let error: string | null = null;
  let finalOutcome: CellMetrics['finalOutcome'] = 'abandoned';

  try {
    for await (const ev of runAttackSession(fullCtx)) {
      switch (ev.type) {
        case 'turn_started':
          turnsUsed = Math.max(turnsUsed, ev.iteration);
          break;
        case 'turn_scored':
          if (ev.progress > maxProgress) {
            maxProgress = ev.progress;
            firstReachAt = ev.iteration;
          }
          if (ev.tier === 'refusal') refusalCount++;
          break;
        case 'dossier_completed':
          dossierUsed = true;
          break;
        case 'finished':
          finalOutcome = ev.outcome;
          break;
        case 'error':
          // Capture the first non-aborted engine error we see; the
          // orchestrator continues past target_stream errors via the
          // circuit breaker, so we don't bail here.
          if (!error && ev.code !== 'aborted') error = ev.message;
          break;
        // A.1 + A.4 events — orchestrator may emit these once the
        // adaptive switching + plateau-detection fixes land. Pre-fix
        // these counters stay at 0.
        default:
          if ((ev as { type: string }).type === 'strategy_leaped') strategyLeapCount++;
          if ((ev as { type: string }).type === 'progress_plateau_detected') plateauPivotCount++;
          break;
      }
    }
  } catch (e) {
    finalOutcome = 'crashed';
    error = (e as Error)?.message ?? String(e);
  }

  return {
    maxProgress,
    firstReachAt,
    finalOutcome,
    turnsUsed,
    refusalCount,
    strategyLeapCount,
    plateauPivotCount,
    dossierUsed,
    error,
    durationMs: Date.now() - started
  };
}
