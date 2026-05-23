/**
 * Synonym replacement — walks word tokens in the input and, at ~30%
 * probability per word, swaps each token for a random synonym from a
 * bundled WordNet-derived subset (Princeton WordNet, BSD-equivalent
 * license; ~55 hand-curated entries focused on terms common to
 * adversarial prompts and red-team workflows).
 *
 * The token regex preserves punctuation, whitespace, and capitalization
 * (it copies the original token's leading-uppercase pattern onto the
 * replacement). Words with no entry in the dictionary pass through
 * unchanged.
 *
 * Deterministic given the RNG seed.
 */
import type { Strategy } from './types';
import wordnetData from '$lib/fuzzer/wordnet-subset.json';

interface WordNetEntry {
  readonly word: string;
  readonly synonyms: readonly string[];
}

const ENTRIES = wordnetData as WordNetEntry[];

// Build lookup once at module load — O(1) per token.
const LOOKUP = new Map<string, readonly string[]>();
for (const e of ENTRIES) {
  LOOKUP.set(e.word.toLowerCase(), e.synonyms);
}

const REPLACE_PROBABILITY = 0.3;

function matchCase(template: string, candidate: string): string {
  // Preserve case pattern from the original token:
  //   ALL_CAPS  → CANDIDATE
  //   Initial   → Candidate
  //   default   → candidate
  if (template.length === 0) return candidate;
  if (template === template.toUpperCase() && /[A-Z]/.test(template)) {
    return candidate.toUpperCase();
  }
  if (template[0] === template[0].toUpperCase()) {
    return candidate.charAt(0).toUpperCase() + candidate.slice(1);
  }
  return candidate;
}

export const synonymReplacement: Strategy = {
  id: 'synonymReplacement',
  name: 'Synonym replacement',
  description: 'Walk word tokens; ~30% swap for a synonym from the bundled WordNet subset',
  badge: 'advanced',
  apply(input, rng) {
    if (!input) return input;

    // Split on word boundaries; keep separators in result so we can rejoin.
    // Captures preserve original punctuation/whitespace placement.
    return input.replace(/[A-Za-z']+/g, (token) => {
      if (rng() >= REPLACE_PROBABILITY) return token;
      const lookup = LOOKUP.get(token.toLowerCase());
      if (!lookup || lookup.length === 0) return token;
      const pick = lookup[Math.floor(rng() * lookup.length)];
      return matchCase(token, pick);
    });
  }
};

/** Exposed for tests — count of dictionary entries actually bundled. */
export const SYNONYM_DICT_SIZE = ENTRIES.length;
