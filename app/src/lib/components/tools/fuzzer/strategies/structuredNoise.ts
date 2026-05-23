/**
 * Structured noise — regex-targeted insertion of invisible characters or
 * homoglyphs *only* at semantically meaningful positions (verbs and
 * noun-phrase heads), rather than randomly throughout the string.
 *
 * Why: random zero-width injection (the `zeroWidth` strategy) is easy
 * to detect by clustering invisible chars; structuredNoise injects
 * surgically — typically one or two characters per verb — which can
 * survive heuristic filters that flag dense invisible-char regions.
 *
 * Approach:
 *   - Tokenize via a verb list (50 common English verbs) and a simple
 *     determiner+noun pattern ("the X", "a X", "an X").
 *   - At each matched position, insert one zero-width-joiner or
 *     homoglyph swap with 80% probability.
 *   - Untouched: everything else (punctuation, function words, numbers).
 *
 * Deterministic given the RNG seed. Returns the input unchanged when
 * no verbs or NPs are found.
 */
import type { Strategy } from './types';

// Hand-curated subset of high-frequency English verbs commonly seen in
// imperative and instruction-following prompts.
const VERBS = new Set<string>([
  'attack', 'help', 'create', 'make', 'do', 'tell', 'show', 'give', 'send',
  'write', 'build', 'break', 'use', 'find', 'see', 'look', 'think', 'know',
  'explain', 'describe', 'provide', 'generate', 'produce', 'compose', 'draft',
  'analyze', 'inspect', 'review', 'check', 'verify', 'test', 'probe',
  'discuss', 'consider', 'design', 'develop', 'craft', 'compile', 'list',
  'extract', 'parse', 'decode', 'encode', 'translate', 'paraphrase',
  'rewrite', 'simulate', 'demonstrate', 'request', 'reply', 'respond'
]);

const ZERO_WIDTH = ['​', '‌', '‍', '⁠']; // U+200B U+200C U+200D U+2060
const HOMOGLYPH: Record<string, string> = {
  a: 'а', // U+0430
  e: 'е', // U+0435
  o: 'о', // U+043E
  c: 'с', // U+0441
  p: 'р'  // U+0440
};

function pick<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length)];
}

function surgicalInject(token: string, rnd: () => number): string {
  // Prefer homoglyph swap on a single letter if available; else inject a ZWJ.
  const letters = Array.from(token);
  for (let attempt = 0; attempt < 3; attempt++) {
    const idx = Math.floor(rnd() * letters.length);
    const ch = letters[idx];
    if (HOMOGLYPH[ch.toLowerCase()] && rnd() < 0.5) {
      letters[idx] = HOMOGLYPH[ch.toLowerCase()];
      return letters.join('');
    }
  }
  // Fallback: insert one zero-width char near the middle.
  const mid = Math.max(1, Math.floor(letters.length / 2));
  return letters.slice(0, mid).join('') + pick(ZERO_WIDTH, rnd) + letters.slice(mid).join('');
}

export const structuredNoise: Strategy = {
  id: 'structuredNoise',
  name: 'Structured noise',
  description: 'Surgical zero-width / homoglyph insertion at verbs and noun-phrase heads only',
  badge: 'advanced',
  apply(input, rnd) {
    if (!input) return input;

    let touchedAny = false;

    // Pass 1 — verbs (case-insensitive match against the verb list).
    let out = input.replace(/[A-Za-z']+/g, (token) => {
      if (!VERBS.has(token.toLowerCase())) return token;
      if (rnd() >= 0.8) return token;
      touchedAny = true;
      return surgicalInject(token, rnd);
    });

    // Pass 2 — noun phrase heads ("the X", "a X", "an X"); inject in X only.
    out = out.replace(/\b(the|a|an)\s+([A-Za-z']+)/gi, (_full, det, noun) => {
      if (rnd() >= 0.8) return `${det} ${noun}`;
      touchedAny = true;
      return `${det} ${surgicalInject(noun, rnd)}`;
    });

    // If no targets matched at all, return the input unchanged.
    return touchedAny ? out : input;
  }
};

/** Exposed for tests — the size of the verb list. */
export const STRUCTURED_NOISE_VERB_COUNT = VERBS.size;
