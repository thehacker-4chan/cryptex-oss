/**
 * Anti-Classifier modelPref normalization stability · v2.1.1
 *
 * /anticlassifier carries the same legacy-id normalization pattern as
 * /promptcraft and was hit by the same reactivity loop pre-v2.1.1.
 * See sibling test in promptcraft/__tests__/modelPref-stability.test.ts
 * for the full rationale.
 */

import { describe, test, expect } from 'vitest';

function normalizeUnqualified(v: string): string {
  if (v && !v.includes(':')) return `openrouter:${v}`;
  return v;
}

describe('Anti-Classifier modelPref normalization · v2.1.1', () => {
  test('legacy unqualified id gets the openrouter prefix', () => {
    expect(normalizeUnqualified('gpt-4o-mini')).toBe('openrouter:gpt-4o-mini');
  });

  test('already-qualified id passes through unchanged', () => {
    expect(normalizeUnqualified('openrouter:gpt-4o-mini')).toBe('openrouter:gpt-4o-mini');
  });

  test('empty string is left alone', () => {
    expect(normalizeUnqualified('')).toBe('');
  });

  test('idempotent on second pass (loop-safety probe)', () => {
    const once = normalizeUnqualified('gpt-4o-mini');
    const twice = normalizeUnqualified(once);
    expect(twice).toBe(once);
  });
});
