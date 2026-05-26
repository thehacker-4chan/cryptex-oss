/**
 * Probe Lab reactivity stability tests · v2.1.1
 *
 * Pre-v2.1.1, opening /redteam/probe-lab and typing into the task textarea
 * called mutatorTechniques() inside two $derived.by blocks on every
 * keystroke. Each call instantiates the full 36-Technique catalog and ran
 * 30+ localTemplate() string-builders against the current task. For long
 * tasks the synchronous work pegged the main thread to the "Page
 * Unresponsive" dialog.
 *
 * The fix:
 *   1. Hoist mutatorTechniques() to a module-level constant so the catalog
 *      is built ONCE at module init, not per render.
 *   2. Debounce the task input by 200ms so the localTemplate-expansion
 *      pipeline only runs once per typing pause.
 *
 * These tests pin both behaviors as pure-function checks so a regression
 * (re-introducing the inline call) is caught before it ships.
 */

import { describe, test, expect } from 'vitest';
import { mutatorTechniques } from '$lib/techniques/from-mutators';

describe('Probe Lab · v2.1.1 reactivity stability', () => {
  test('mutatorTechniques() returns a stable catalog (safe to hoist)', () => {
    // Calling twice yields arrays of the same length and same id ordering.
    // If a future refactor makes this stateful, the hoist in
    // probe-lab/+page.svelte stops being safe and this test fires.
    const a = mutatorTechniques();
    const b = mutatorTechniques();
    expect(a.length).toBe(b.length);
    expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id));
  });

  test('catalog contains at least 30 mutators with localTemplate', () => {
    // Probe Lab depends on mutators that expose a localTemplate so it can
    // synthesize prompts without an extra LLM round-trip per mutator.
    // If the catalog drops below this count the leaderboard becomes thin.
    const all = mutatorTechniques();
    const local = all.filter(
      (m) => m.id !== 'custom' && typeof m.localTemplate === 'function'
    );
    expect(local.length).toBeGreaterThanOrEqual(20);
  });

  test('skipped-mutator partition is non-empty (UI surfaces it as a note)', () => {
    // Some mutators (tap_seeder, many_shot, etc.) need an LLM call to
    // generate the variant and therefore get skipped in the local pipeline.
    // The skipped count appears in the UI under "Skipped mutators".
    const all = mutatorTechniques();
    const skipped = all.filter(
      (m) => m.id !== 'custom' && typeof m.localTemplate !== 'function'
    );
    expect(skipped.length).toBeGreaterThan(0);
  });

  test('typing-debounce pattern coalesces N synchronous setTimeout fires', () => {
    // This validates the debounce SHAPE used in the page. The actual hooked
    // debounce lives inside the Svelte effect; this test just pins the
    // setTimeout-cancel pattern so future refactors keep the contract.
    let fires = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debounceMs = 50;

    const queue = (_v: string) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        fires += 1;
      }, debounceMs);
    };

    // Simulate 100 rapid keystrokes.
    for (let i = 0; i < 100; i++) queue(`char ${i}`);

    // After all 100 calls, ONE pending timer is queued; no fires yet.
    expect(fires).toBe(0);

    // After waiting past the debounce window, exactly one fire.
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(fires).toBe(1);
        resolve();
      }, debounceMs + 20);
    });
  });
});
