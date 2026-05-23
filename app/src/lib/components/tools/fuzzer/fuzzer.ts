/**
 * Mutation Lab / Fuzzer orchestrator.
 *
 * Iterates a configurable count of variants. For each variant, applies
 * every enabled strategy in declared order; each application gets a
 * fresh draw from the seeded RNG, so the (seed + enabled strategies)
 * tuple deterministically reproduces the same variant set.
 *
 * Returns an array of `FuzzVariant` records — each carries the final
 * output string and the list of strategy IDs that touched it, so the
 * UI can render a "mutation log" line per variant.
 */
import { STRATEGIES, getStrategy } from './strategies';
import type { Strategy } from './strategies';

/**
 * Options carry one boolean per strategy id plus the shared `count` and
 * `seed` knobs. Keys are typed as a Record<string, boolean | …> to keep
 * the orchestrator strategy-agnostic — adding a new strategy to the
 * registry surfaces it automatically.
 */
export interface FuzzerOptions {
  count: number;
  seed: string;
  // Boolean per-strategy toggle. Keys mirror Strategy.id.
  [strategyId: string]: number | string | boolean;
}

/**
 * Output variant + the list of strategy IDs that produced it.
 * The `sources` array preserves application order (basic→advanced).
 */
export interface FuzzVariant {
  readonly output: string;
  readonly sources: readonly string[];
}

/** Default options: enable the original sensible defaults; advanced off. */
export const DEFAULT_FUZZER: FuzzerOptions = {
  count: 20,
  seed: '',
  useRandomMix: true,
  zeroWidth: true,
  unicodeNoise: true,
  whitespace: true,
  casing: true,
  zalgo: false,
  encodeShuffle: false,
  // Advanced (v2.0) — opt-in:
  grammarMutation: false,
  synonymReplacement: false,
  promptInjectionMutation: false,
  structuredNoise: false
};

// xorshift-ish seeded PRNG — produces a Math.random-compatible callable.
export function seededRandomFactory(seedStr: string): () => number {
  if (!seedStr) return Math.random;
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h ^= h >>> 16;
    h = Math.imul(h, 2246822507);
    h ^= h >>> 13;
    h = Math.imul(h, 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/**
 * Generate N variants. Each variant runs every enabled strategy in
 * registry order; each strategy gets a tag in the returned `sources`
 * list. Returns `[]` for empty input.
 *
 * The legacy entry-point that returns `string[]` is kept below for
 * tools that don't need source tagging.
 */
export function generateFuzzVariants(input: string, opts: FuzzerOptions): FuzzVariant[] {
  const src = String(input || '');
  if (!src) return [];
  const rnd = seededRandomFactory(String(opts.seed || ''));
  const count = Math.max(1, Math.min(500, Number(opts.count) || 1));

  // Snapshot the enabled strategies once per run.
  const enabled: Strategy[] = STRATEGIES.filter((s) => opts[s.id] === true);

  const out: FuzzVariant[] = [];
  for (let i = 0; i < count; i++) {
    let cur = src;
    const sources: string[] = [];
    for (const strat of enabled) {
      try {
        const next = strat.apply(cur, rnd, opts);
        // Tag the source even when output is unchanged (the strategy ran).
        sources.push(strat.id);
        cur = next;
      } catch {
        // Strategy crashed — skip silently so a buggy single strategy
        // doesn't take down the entire batch.
      }
    }
    out.push({ output: cur, sources });
  }
  return out;
}

/**
 * Legacy entry-point — returns just the output strings, dropping the
 * source tags. Kept for compatibility with existing tests and the
 * cli_bridge boundary.
 */
export function generateFuzzCases(input: string, opts: FuzzerOptions): string[] {
  return generateFuzzVariants(input, opts).map((v) => v.output);
}

// Re-export the strategy registry for the UI's checkbox listing.
export { STRATEGIES, getStrategy };
export type { Strategy } from './strategies';
