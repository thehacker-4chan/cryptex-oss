/**
 * Vault auto-promotion (v2.2 Wave 10.3).
 *
 * When a multi-step orchestrator (TAP / PAIR / Crescendo / Many-Shot)
 * produces a "winning" chain against a target, capture the winning
 * configuration (params + winning prompt + target family) and push it
 * into the PromptCraft Vault as a `source: 'user'` entry so future runs
 * benefit from past wins.
 *
 * "Winning" threshold: `scoreBypass >= 0.75` per the orchestrator types.ts
 * heuristic. Conservative on purpose — every borderline-pass becoming a
 * vault entry would generate noise.
 *
 * The Vault store reference is optional. If the caller does not pass one
 * (testing, or a user who turned auto-promotion off), this becomes a no-op.
 */

import type { VaultItem } from '$lib/vault/types';
import { inferModelFamily, type ModelFamily } from '$lib/ai/model-family';

/** Type-narrow surface of the per-tool Vault store we need. */
export interface VaultPromoter {
  add(init: Omit<VaultItem<unknown>, 'id' | 'schemaVersion' | 'source' | 'addedAt'>): unknown;
}

/** Payload shape we write into the PromptCraft Vault for an auto-promoted chain. */
export interface AutoPromotedChain {
  orchestratorType: 'tap' | 'pair' | 'crescendo' | 'many_shot';
  params: Record<string, unknown>;
  winningPrompt: string;
  /** Final response text from the target. Truncated to 2 KB to keep Vault row small. */
  responseSummary: string;
  score: number;
  targetModel: string;
  targetFamily: ModelFamily;
  capturedAt: number;
}

/** Truncate the response so a single winning chain never bloats the Vault. */
function truncate(s: string, max = 2048): string {
  if (!s) return '';
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}

/**
 * Threshold above which a chain auto-promotes to Vault. Mirrors
 * scoreBypass return values in orchestrators/types.ts.
 */
export const AUTO_PROMOTE_THRESHOLD = 0.75;

/**
 * Promote a winning chain to the Vault. No-op if `vault` is undefined or
 * the score is below the threshold. Never throws (failures are logged
 * but do not interrupt the orchestrator run).
 */
export function autoPromoteChain(
  vault: VaultPromoter | undefined,
  chain: Omit<AutoPromotedChain, 'targetFamily' | 'capturedAt'>
): void {
  if (!vault) return;
  if (typeof chain.score !== 'number' || chain.score < AUTO_PROMOTE_THRESHOLD) return;

  const targetFamily = inferModelFamily(chain.targetModel);
  const payload: AutoPromotedChain = {
    ...chain,
    responseSummary: truncate(chain.responseSummary),
    winningPrompt: truncate(chain.winningPrompt, 8192),
    targetFamily,
    capturedAt: Date.now()
  };

  try {
    vault.add({
      title: `[auto] ${chain.orchestratorType.toUpperCase()} winner on ${targetFamily}`,
      description: `Auto-promoted from a winning ${chain.orchestratorType} run (score ${chain.score.toFixed(2)}) against ${chain.targetModel}.`,
      payload: payload as unknown,
      tags: ['auto-promoted', chain.orchestratorType, targetFamily.toLowerCase()],
      notes:
        'Auto-captured by the PromptCraft self-evolution layer (v2.2 Wave 10.3). ' +
        'Edit the payload, retitle, or delete from the Vault drawer if it is not useful.'
    });
  } catch (err) {
    // Don't crash the orchestrator on a Vault failure. Surface to console in dev.
    if (typeof console !== 'undefined') {
      console.warn('[auto-promote] vault.add failed', err);
    }
  }
}
