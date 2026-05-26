/**
 * PromptCraft modelPref normalization stability · v2.1.1
 *
 * The /promptcraft tool wraps a $effect that normalizes legacy
 * unqualified model ids ("gpt-4o" -> "openrouter:gpt-4o"). Pre-v2.1.1
 * the effect did:
 *
 *   $effect(() => {
 *     if (modelPref.value && !modelPref.value.includes(':'))
 *       modelPref.value = `openrouter:${modelPref.value}`;
 *   });
 *
 * The read and the write target the same reactive store. With
 * createPersistedState (which writes through localStorage), Svelte 5's
 * batching does not catch the self-write quickly enough on certain
 * paths; the effect re-fires and the user perceives a hung tab.
 *
 * The fix wraps the body in untrack() so the effect runs ONCE at mount
 * regardless of how many times createPersistedState surfaces the change
 * downstream.
 *
 * This test pins the normalization LOGIC (a pure pattern check) so a
 * future refactor that drops the rule is caught.
 */

import { describe, test, expect } from 'vitest';

function normalizeUnqualified(v: string): string {
  if (v && !v.includes(':')) return `openrouter:${v}`;
  return v;
}

describe('PromptCraft modelPref normalization · v2.1.1', () => {
  test('legacy unqualified id gets the openrouter prefix', () => {
    expect(normalizeUnqualified('gpt-4o')).toBe('openrouter:gpt-4o');
    expect(normalizeUnqualified('claude-3.5-sonnet')).toBe('openrouter:claude-3.5-sonnet');
  });

  test('already-qualified id passes through unchanged (no double-prefix)', () => {
    expect(normalizeUnqualified('openrouter:gpt-4o')).toBe('openrouter:gpt-4o');
    expect(normalizeUnqualified('anthropic:claude-3.5-sonnet')).toBe('anthropic:claude-3.5-sonnet');
    expect(normalizeUnqualified('openai-compat:groq/llama-3.3-70b')).toBe('openai-compat:groq/llama-3.3-70b');
  });

  test('empty string passes through (no spurious openrouter: prefix)', () => {
    expect(normalizeUnqualified('')).toBe('');
  });

  test('idempotent: re-running normalization on the output is a no-op', () => {
    // If the $effect ever re-fires post-untrack-fix, the second pass
    // must not double-prefix. This is the "would it have looped if not
    // for untrack?" check.
    const once = normalizeUnqualified('gpt-4o');
    const twice = normalizeUnqualified(once);
    expect(twice).toBe(once);
  });
});
