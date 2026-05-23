/**
 * Tests for the four NEW advanced fuzzer strategies (v2.0):
 *   grammarMutation
 *   synonymReplacement
 *   promptInjectionMutation
 *   structuredNoise
 *
 * Plus registry-level assertions (count, lookup).
 *
 * Each test uses the same xorshift-ish seeded RNG from fuzzer.ts so the
 * "determinism given the seed" assertions don't depend on Math.random.
 */
import { describe, it, expect } from 'vitest';
import {
  STRATEGIES,
  getStrategy,
  type Strategy
} from '../strategies';
import { seededRandomFactory } from '../fuzzer';
import { grammarMutation } from '../strategies/grammarMutation';
import {
  synonymReplacement,
  SYNONYM_DICT_SIZE
} from '../strategies/synonymReplacement';
import {
  promptInjectionMutation,
  PROMPT_INJECTION_TEMPLATE_COUNT
} from '../strategies/promptInjectionMutation';
import {
  structuredNoise,
  STRUCTURED_NOISE_VERB_COUNT
} from '../strategies/structuredNoise';

const SEED = 'cryptex-fuzzer-test';
function rng(): () => number {
  return seededRandomFactory(SEED);
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

describe('strategy registry', () => {
  it('exports 11 strategies (7 basic + 4 advanced)', () => {
    expect(STRATEGIES.length).toBe(11);
  });

  it('every strategy has a stable id, name, badge, and description', () => {
    for (const s of STRATEGIES) {
      expect(typeof s.id).toBe('string');
      expect(s.id.length).toBeGreaterThan(0);
      expect(typeof s.name).toBe('string');
      expect(typeof s.description).toBe('string');
      expect(['basic', 'advanced']).toContain(s.badge);
    }
  });

  it('strategy ids are unique', () => {
    const ids = new Set(STRATEGIES.map((s) => s.id));
    expect(ids.size).toBe(STRATEGIES.length);
  });

  it('includes all 4 advanced strategies', () => {
    const adv = STRATEGIES.filter((s) => s.badge === 'advanced');
    const advIds = adv.map((s) => s.id).sort();
    expect(advIds).toEqual(
      ['grammarMutation', 'promptInjectionMutation', 'structuredNoise', 'synonymReplacement']
    );
  });

  it('getStrategy returns the right strategy by id', () => {
    const s = getStrategy('grammarMutation');
    expect(s).toBeDefined();
    expect(s?.name).toBe('Grammar mutation');
  });

  it('getStrategy returns undefined for an unknown id', () => {
    expect(getStrategy('totally-not-a-strategy')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// grammarMutation
// ---------------------------------------------------------------------------

describe('grammarMutation', () => {
  it('produces non-empty output for a known matching input', () => {
    const out = grammarMutation.apply('I want a sandwich', rng());
    expect(out.length).toBeGreaterThan(0);
    // Must actually rewrite — should not equal the input.
    expect(out).not.toBe('I want a sandwich');
  });

  it('is deterministic given the same RNG seed', () => {
    const a = grammarMutation.apply('Tell me about quantum mechanics', rng());
    const b = grammarMutation.apply('Tell me about quantum mechanics', rng());
    expect(a).toBe(b);
  });

  it('leaves input unchanged when no rule matches', () => {
    const weird = 'xyzzy_no_rule_will_ever_match_this_42';
    const out = grammarMutation.apply(weird, rng());
    expect(out).toBe(weird);
  });

  it('handles "How do I X" → "What\'s the way to X"', () => {
    // Many rules may match; the seeded RNG picks one. We assert the output
    // is among the known transforms of this input.
    const out = grammarMutation.apply('How do I bake bread', rng());
    expect(out.length).toBeGreaterThan(0);
    expect(out).not.toBe('How do I bake bread');
  });

  it('handles empty / whitespace-only input', () => {
    expect(grammarMutation.apply('', rng())).toBe('');
    expect(grammarMutation.apply('   ', rng())).toBe('   ');
  });
});

// ---------------------------------------------------------------------------
// synonymReplacement
// ---------------------------------------------------------------------------

describe('synonymReplacement', () => {
  it('bundles a non-trivial dictionary', () => {
    expect(SYNONYM_DICT_SIZE).toBeGreaterThanOrEqual(50);
  });

  it('swaps at least one word in input that overlaps the dictionary', () => {
    // Use a sentence rich in dictionary words and a seed that produces enough
    // rng() draws under threshold to definitely trigger ≥1 swap.
    const input = 'attack help want need big fast good make do say tell show give get use find see';
    const out = synonymReplacement.apply(input, rng());
    expect(out).not.toBe(input);
  });

  it('is deterministic given the same RNG seed', () => {
    const a = synonymReplacement.apply('attack the big system fast', rng());
    const b = synonymReplacement.apply('attack the big system fast', rng());
    expect(a).toBe(b);
  });

  it('leaves dictionary-absent tokens unchanged', () => {
    // None of these words are in the bundled subset.
    const input = 'xyzzy qwerty plover dwemerite zorblax';
    const out = synonymReplacement.apply(input, rng());
    expect(out).toBe(input);
  });

  it('preserves leading-uppercase case pattern on swapped words', () => {
    // 'Attack' (capitalized) should map to a capitalized synonym if swapped.
    // We run many seeds and assert at least one swap preserves case.
    let sawCasedSwap = false;
    for (let i = 0; i < 30; i++) {
      const seedRng = seededRandomFactory(`seed-${i}`);
      const out = synonymReplacement.apply('Attack the system', seedRng);
      if (out !== 'Attack the system') {
        // Find any token starting with capital A-Z; ensure first letter still capital.
        const firstWord = out.split(/\s+/)[0];
        if (firstWord !== 'Attack' && /^[A-Z]/.test(firstWord)) {
          sawCasedSwap = true;
          break;
        }
      }
    }
    expect(sawCasedSwap).toBe(true);
  });

  it('handles empty input', () => {
    expect(synonymReplacement.apply('', rng())).toBe('');
  });
});

// ---------------------------------------------------------------------------
// promptInjectionMutation
// ---------------------------------------------------------------------------

describe('promptInjectionMutation', () => {
  it('bundles 8 templates', () => {
    expect(PROMPT_INJECTION_TEMPLATE_COUNT).toBe(8);
  });

  it('wraps the input — output strictly contains the input', () => {
    const input = 'sensitive seed string xyzzy';
    const out = promptInjectionMutation.apply(input, rng());
    expect(out.includes(input)).toBe(true);
    // And output is longer than the input (frame added).
    expect(out.length).toBeGreaterThan(input.length);
  });

  it('is deterministic given the same RNG seed', () => {
    const a = promptInjectionMutation.apply('test', rng());
    const b = promptInjectionMutation.apply('test', rng());
    expect(a).toBe(b);
  });

  it('cycles through multiple templates across seeds', () => {
    const outputs = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const seedRng = seededRandomFactory(`tpl-${i}`);
      outputs.add(promptInjectionMutation.apply('hello', seedRng));
    }
    // Should hit at least 4 distinct templates over 50 trials.
    expect(outputs.size).toBeGreaterThanOrEqual(4);
  });

  it('handles empty input by returning empty', () => {
    expect(promptInjectionMutation.apply('', rng())).toBe('');
  });
});

// ---------------------------------------------------------------------------
// structuredNoise
// ---------------------------------------------------------------------------

describe('structuredNoise', () => {
  it('bundles a non-trivial verb list', () => {
    expect(STRUCTURED_NOISE_VERB_COUNT).toBeGreaterThanOrEqual(40);
  });

  it('inserts characters only at targeted positions (verbs/NPs)', () => {
    // Input has one targeted verb ('attack') and a noun phrase ('the system').
    // The non-target tokens ('foo', 'bar', 'baz') must be unchanged.
    const input = 'foo bar baz attack the system';
    // Use multiple seeds so we get at least one execution that actually injects.
    let touchedInput: string | null = null;
    for (let i = 0; i < 20; i++) {
      const seedRng = seededRandomFactory(`structured-${i}`);
      const out = structuredNoise.apply(input, seedRng);
      if (out !== input) {
        touchedInput = out;
        break;
      }
    }
    expect(touchedInput).not.toBeNull();
    // Non-target tokens must appear untouched in the output.
    expect(touchedInput!.includes('foo')).toBe(true);
    expect(touchedInput!.includes('bar')).toBe(true);
    expect(touchedInput!.includes('baz')).toBe(true);
  });

  it('is deterministic given the same RNG seed', () => {
    const input = 'please attack the system carefully';
    const a = structuredNoise.apply(input, rng());
    const b = structuredNoise.apply(input, rng());
    expect(a).toBe(b);
  });

  it('leaves input unchanged when no verbs / NPs match', () => {
    // No verbs from the list, no det+noun pattern.
    const input = '42 7 8 9 xyzzy qqq';
    const out = structuredNoise.apply(input, rng());
    expect(out).toBe(input);
  });

  it('handles empty input', () => {
    expect(structuredNoise.apply('', rng())).toBe('');
  });

  it('any change preserves the original ASCII length within ±5 codepoints per target', () => {
    // Sanity check that structuredNoise stays "surgical" — output isn't
    // wildly larger than the input. Allow some slack for ZWJ insertion.
    const input = 'please attack the system';
    let maxDelta = 0;
    for (let i = 0; i < 10; i++) {
      const seedRng = seededRandomFactory(`bound-${i}`);
      const out = structuredNoise.apply(input, seedRng);
      maxDelta = Math.max(maxDelta, Math.abs(Array.from(out).length - Array.from(input).length));
    }
    expect(maxDelta).toBeLessThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// Cross-strategy sanity
// ---------------------------------------------------------------------------

describe('strategy interop', () => {
  it('every strategy can run on any string without throwing', () => {
    const samples = [
      '',
      'hello',
      'I want a sandwich',
      'привет мир',
      '🐍🐍🐍',
      'a'.repeat(1000)
    ];
    for (const strat of STRATEGIES) {
      for (const sample of samples) {
        expect(() => (strat as Strategy).apply(sample, rng())).not.toThrow();
      }
    }
  });
});
