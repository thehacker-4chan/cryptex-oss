/**
 * Fuzzer strategy registry.
 *
 * Re-exports each strategy module so the orchestrator and UI can iterate
 * the catalog and look up an individual strategy by id. The order of the
 * STRATEGIES array dictates the UI listing order — basic strategies
 * first (original 7), advanced strategies after (new 4 in v2.0).
 *
 * Adding a new strategy: create the module under this directory, import
 * here, and append to STRATEGIES.
 */
import type { Strategy } from './types';

import { useRandomMix } from './useRandomMix';
import { zeroWidth } from './zeroWidth';
import { unicodeNoise } from './unicodeNoise';
import { whitespace } from './whitespace';
import { casing } from './casing';
import { zalgo } from './zalgo';
import { encodeShuffle } from './encodeShuffle';
import { grammarMutation } from './grammarMutation';
import { synonymReplacement } from './synonymReplacement';
import { promptInjectionMutation } from './promptInjectionMutation';
import { structuredNoise } from './structuredNoise';

export const STRATEGIES: readonly Strategy[] = [
  useRandomMix,
  zeroWidth,
  unicodeNoise,
  whitespace,
  casing,
  zalgo,
  encodeShuffle,
  grammarMutation,
  synonymReplacement,
  promptInjectionMutation,
  structuredNoise
];

export function getStrategy(id: string): Strategy | undefined {
  return STRATEGIES.find((s) => s.id === id);
}

export type { Strategy } from './types';
