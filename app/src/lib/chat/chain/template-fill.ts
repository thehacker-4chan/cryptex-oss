import type { StrategyId } from '$lib/chat/types';
import { getStrategy } from './orchestrator-strategies';

/**
 * Deterministic template-fill fallback. Given a strategy id, a 1-indexed step
 * number, and the user's objective, produces a turn text by substituting every
 * `{placeholder}` token in the selected opening template (or the strategy's
 * pivotContinuation for steps beyond the 3 openings).
 *
 * The engine calls this when `refineTurn` fails, errors, or returns a refusal.
 * It's the "safety net" that guarantees the attack always has a next turn.
 */
export function fillTemplate(strategyId: StrategyId, step: number, objective: string): string {
  const strategy = getStrategy(strategyId);
  // Step 1..3 pick openings[0..2]; step >=4 uses pivotContinuation.
  const template = step <= 3
    ? strategy.openings[step - 1] ?? strategy.openings[0]
    : strategy.pivotContinuation;
  // Replace every {placeholder_token} with the objective string.
  return template.replace(/\{[a-z_]+\}/gi, objective);
}

/**
 * Heuristic: does this text look like the opening of a refusal disclaimer?
 * Inspects only the first 200 chars so a legitimate long turn that mentions
 * "I cannot" mid-essay isn't flagged.
 *
 * If true, the engine discards the LLM's output and substitutes a
 * template-fill turn instead, so an aligned orchestrator that rewrote our
 * draft into a refusal doesn't stop the attack.
 */
const REFUSAL_MARKERS: readonly RegExp[] = [
  /^i (cannot|can't|won't|will not|am not able|am unable|do not feel comfortable)/i,
  /^i'?m (not able|unable|sorry)/i,
  /^(sorry|apolog|unfortunately)/i,
  /cannot (help|assist|provide|comply|fulfill)/i,
  /against (my|our) (guidelines|policies|values|principles)/i,
  /as an ai/i,
  /i don'?t feel comfortable/i
];

export function looksLikeRefusal(text: string): boolean {
  if (!text) return false;
  const head = text.trim().slice(0, 200);
  return REFUSAL_MARKERS.some((r) => r.test(head));
}
