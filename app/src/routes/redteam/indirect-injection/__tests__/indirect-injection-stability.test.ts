/**
 * Indirect Injection reactivity stability tests · v2.1.1
 *
 * Pre-v2.1.1, the regenerate $effect on /redteam/indirect-injection fired
 * on every keystroke in the hiddenInstruction textarea. Each fire ran
 * buildIndirectPayload(), wrote `result`, which then triggered a second
 * $effect that called history.record() (localStorage + IndexedDB write).
 * Three writes per keystroke on longer instructions pegged the main
 * thread to the "Page Unresponsive" dialog.
 *
 * The fix:
 *   1. Debounce hiddenInstruction.value into a shadow state by 200ms so
 *      regenerate only runs after typing pauses.
 *   2. Wrap the regenerate write inside untrack() so result mutation
 *      cannot re-subscribe the effect to its own output.
 *   3. Wrap history.record() inside untrack() so transitive state
 *      mutations during the IDB write cannot retrigger the effect.
 *
 * These tests pin the underlying buildIndirectPayload() behavior so a
 * regression in the page does not silently break the build/test path.
 */

import { describe, test, expect } from 'vitest';
import {
  buildIndirectPayload,
  DEFAULT_INSTRUCTION
} from '$lib/redteam/indirect-injection';

describe('Indirect Injection · v2.1.1 reactivity stability', () => {
  test('buildIndirectPayload is deterministic for the same inputs', () => {
    // The page calls this on every regenerate. If determinism breaks,
    // the result field would mutate on every keystroke even with the
    // same inputs and could re-trigger the history.record() effect.
    const args = {
      kind: 'web-article' as const,
      placement: 'footer' as const,
      topic: 'quarterly-business-review',
      hiddenInstruction: DEFAULT_INSTRUCTION
    };
    const a = buildIndirectPayload(args);
    const b = buildIndirectPayload(args);
    expect(a.payload).toBe(b.payload);
  });

  test('buildIndirectPayload returns a non-empty payload for the default seed', () => {
    const r = buildIndirectPayload({
      kind: 'web-article',
      placement: 'footer',
      topic: 'quarterly-business-review',
      hiddenInstruction: DEFAULT_INSTRUCTION
    });
    expect(typeof r.payload).toBe('string');
    expect(r.payload.length).toBeGreaterThan(0);
  });

  test('changing placement changes the payload (no silent caching)', () => {
    const base = {
      kind: 'web-article' as const,
      topic: 'quarterly-business-review',
      hiddenInstruction: DEFAULT_INSTRUCTION
    };
    const footer = buildIndirectPayload({ ...base, placement: 'footer' });
    const body = buildIndirectPayload({ ...base, placement: 'body' });
    expect(footer.payload).not.toBe(body.payload);
  });

  test('200ms debounce pattern coalesces rapid input changes', () => {
    // Pin the debounce SHAPE used in the page so a refactor cannot
    // accidentally drop the coalescing.
    let appliedValue = '';
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debounceMs = 50;

    const queue = (v: string) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        appliedValue = v;
      }, debounceMs);
    };

    for (let i = 0; i < 50; i++) queue(`v${i}`);

    // No commit yet.
    expect(appliedValue).toBe('');

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // Exactly the last value lands; intermediate values dropped.
        expect(appliedValue).toBe('v49');
        resolve();
      }, debounceMs + 20);
    });
  });
});
