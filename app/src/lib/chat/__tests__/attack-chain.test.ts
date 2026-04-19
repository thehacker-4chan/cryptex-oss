import { describe, it, expect, vi } from 'vitest';
import type { TechniqueContext } from '../techniques/types';
import type { LayerResultRow } from '../attack-chain';

// ---------------------------------------------------------------------------
// Minimal mock registry — injected before the dynamic import inside runChain
// ---------------------------------------------------------------------------

type MockTechnique = {
  id: string;
  name: string;
  description: string;
  category: 'mutate';
  local: boolean;
  apply: (input: string) => Promise<{ output: string }>;
  icon?: undefined;
};

const makeTechnique = (id: string, name: string, transform: (s: string) => string): MockTechnique => ({
  id,
  name,
  description: '',
  category: 'mutate' as const,
  local: true,
  apply: async (input: string) => ({ output: transform(input) })
});

const REGISTRY: Record<string, MockTechnique> = {
  upper: makeTechnique('upper', 'Uppercase', (s) => s.toUpperCase()),
  exclaim: makeTechnique('exclaim', 'Exclaim', (s) => s + '!')
};

vi.mock('../techniques/registry', () => ({
  find: (id: string) => REGISTRY[id] ?? undefined,
  allTechniques: () => Object.values(REGISTRY),
  byCategory: (cat: string) => Object.values(REGISTRY).filter((t) => t.category === cat),
  search: (q: string) => Object.values(REGISTRY).filter((t) => t.id.includes(q))
}));

// ---------------------------------------------------------------------------

import { runChain } from '../attack-chain';

function makeCtx(): TechniqueContext {
  return {
    model: 'test-model',
    callLLM: async () => { throw new Error('callLLM should not be called in local tests'); },
    signal: new AbortController().signal
  };
}

async function collect(gen: AsyncGenerator<LayerResultRow>): Promise<LayerResultRow[]> {
  const rows: LayerResultRow[] = [];
  for await (const row of gen) rows.push(row);
  return rows;
}

describe('runChain', () => {
  it('2-step chain of local techniques: yields 2 rows, output of first feeds second', async () => {
    const signal = new AbortController().signal;
    const ctx = makeCtx();
    const rows = await collect(runChain('hello', ['upper', 'exclaim'], ctx, signal));

    expect(rows).toHaveLength(2);

    // Layer 0: upper
    expect(rows[0].layerIndex).toBe(0);
    expect(rows[0].techniqueId).toBe('upper');
    expect(rows[0].techniqueName).toBe('Uppercase');
    expect(rows[0].input).toBe('hello');
    expect(rows[0].output).toBe('HELLO');
    expect(rows[0].error).toBeUndefined();

    // Layer 1: exclaim — input is output of layer 0
    expect(rows[1].layerIndex).toBe(1);
    expect(rows[1].techniqueId).toBe('exclaim');
    expect(rows[1].techniqueName).toBe('Exclaim');
    expect(rows[1].input).toBe('HELLO');
    expect(rows[1].output).toBe('HELLO!');
    expect(rows[1].error).toBeUndefined();
  });

  it('yields error row and stops when a technique id is not found', async () => {
    const signal = new AbortController().signal;
    const ctx = makeCtx();
    const rows = await collect(runChain('hello', ['upper', 'nonexistent', 'exclaim'], ctx, signal));

    // Should yield layer 0 success, then layer 1 error, then stop (no layer 2)
    expect(rows).toHaveLength(2);
    expect(rows[0].error).toBeUndefined();
    expect(rows[1].techniqueId).toBe('nonexistent');
    expect(rows[1].error).toBe('technique not found');
    expect(rows[1].output).toBe('');
  });

  it('yields error row and stops when a technique throws', async () => {
    const throwingTechnique = {
      id: 'thrower',
      name: 'Thrower',
      description: '',
      category: 'mutate' as const,
      local: true,
      apply: async () => { throw new Error('boom'); }
    };
    REGISTRY['thrower'] = throwingTechnique as unknown as MockTechnique;

    const signal = new AbortController().signal;
    const ctx = makeCtx();
    const rows = await collect(runChain('hello', ['upper', 'thrower', 'exclaim'], ctx, signal));

    // layer 0 succeeds, layer 1 errors, chain stops
    expect(rows).toHaveLength(2);
    expect(rows[0].error).toBeUndefined();
    expect(rows[1].techniqueId).toBe('thrower');
    expect(rows[1].error).toBe('boom');

    delete REGISTRY['thrower'];
  });

  it('durationMs is non-negative for each row', async () => {
    const signal = new AbortController().signal;
    const ctx = makeCtx();
    const rows = await collect(runChain('test', ['upper', 'exclaim'], ctx, signal));
    for (const row of rows) {
      expect(row.durationMs).toBeGreaterThanOrEqual(0);
      expect(row.startedAt).toBeGreaterThan(0);
    }
  });

  it('stops immediately when signal is already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    const ctx = makeCtx();
    const rows = await collect(runChain('hello', ['upper', 'exclaim'], ctx, ac.signal));
    expect(rows).toHaveLength(0);
  });
});
