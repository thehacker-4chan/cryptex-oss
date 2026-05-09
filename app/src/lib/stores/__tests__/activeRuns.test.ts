import { describe, it, expect, beforeEach } from 'vitest';
import { activeRuns } from '../activeRuns.svelte';

beforeEach(() => {
  // Cancel + clear any leftover state between tests.
  for (const r of activeRuns.values) {
    activeRuns.clear(r.toolId);
  }
});

describe('activeRuns registry', () => {
  it('start/get/isRunning lifecycle', () => {
    expect(activeRuns.isRunning('probe-lab')).toBe(false);
    expect(activeRuns.get('probe-lab')).toBeUndefined();

    const run = activeRuns.start<{ count: number }>('probe-lab', { count: 0 }, 'starting');
    expect(activeRuns.isRunning('probe-lab')).toBe(true);
    expect(activeRuns.get('probe-lab')).toBeDefined();
    expect(activeRuns.get<{ count: number }>('probe-lab')!.data.count).toBe(0);
    expect(run.summary).toBe('starting');
    expect(run.controller).toBeInstanceOf(AbortController);
  });

  it('update mutator merges data (returning new value)', () => {
    activeRuns.start<{ count: number; items: string[] }>(
      'cross-model-diff',
      { count: 0, items: [] }
    );
    activeRuns.update<{ count: number; items: string[] }>(
      'cross-model-diff',
      (d) => ({ count: d.count + 1, items: [...d.items, 'a'] })
    );
    const run = activeRuns.get<{ count: number; items: string[] }>('cross-model-diff');
    expect(run!.data.count).toBe(1);
    expect(run!.data.items).toEqual(['a']);
  });

  it('update mutator merges data (mutating in place)', () => {
    activeRuns.start<{ items: string[] }>('replayer', { items: [] });
    activeRuns.update<{ items: string[] }>('replayer', (d) => {
      d.items.push('x');
    });
    const run = activeRuns.get<{ items: string[] }>('replayer');
    expect(run!.data.items).toEqual(['x']);
  });

  it('finish marks run done and stamps finishedAt', () => {
    activeRuns.start('harmbench', { rows: [] });
    activeRuns.finish('harmbench', 'ok');
    const run = activeRuns.get('harmbench');
    expect(run!.status).toBe('done');
    expect(run!.summary).toBe('ok');
    expect(run!.finishedAt).toBeGreaterThan(0);
    expect(activeRuns.isRunning('harmbench')).toBe(false);
  });

  it('fail marks run error and captures message', () => {
    activeRuns.start('strongreject', { rows: [] });
    activeRuns.fail('strongreject', 'boom');
    const run = activeRuns.get('strongreject');
    expect(run!.status).toBe('error');
    expect(run!.error).toBe('boom');
    expect(activeRuns.isRunning('strongreject')).toBe(false);
  });

  it('cancel aborts controller and marks status cancelled', () => {
    const run = activeRuns.start('jbb', { rows: [] });
    expect(run.controller.signal.aborted).toBe(false);
    activeRuns.cancel('jbb');
    expect(run.controller.signal.aborted).toBe(true);
    expect(activeRuns.get('jbb')!.status).toBe('cancelled');
    expect(activeRuns.isRunning('jbb')).toBe(false);
  });

  it('clear removes run from registry', () => {
    activeRuns.start('fingerprinter', { rows: [] });
    expect(activeRuns.get('fingerprinter')).toBeDefined();
    activeRuns.clear('fingerprinter');
    expect(activeRuns.get('fingerprinter')).toBeUndefined();
  });

  it('start replaces and aborts a previous in-flight run for the same toolId', () => {
    const first = activeRuns.start('probe-lab', { round: 1 });
    const second = activeRuns.start('probe-lab', { round: 2 });
    expect(first.controller.signal.aborted).toBe(true);
    expect(activeRuns.get<{ round: number }>('probe-lab')!.data.round).toBe(2);
    // The second is the live one and is still running.
    expect(activeRuns.isRunning('probe-lab')).toBe(true);
    expect(second.controller.signal.aborted).toBe(false);
  });

  it('multiple concurrent runs for different toolIds coexist', () => {
    activeRuns.start('probe-lab', { tag: 'a' });
    activeRuns.start('cross-model-diff', { tag: 'b' });
    activeRuns.start('replayer', { tag: 'c' });
    expect(activeRuns.runningCount).toBe(3);
    expect(activeRuns.values.length).toBe(3);

    activeRuns.finish('probe-lab');
    expect(activeRuns.runningCount).toBe(2);
    expect(activeRuns.values.length).toBe(3);
    expect(activeRuns.isRunning('cross-model-diff')).toBe(true);
    expect(activeRuns.isRunning('replayer')).toBe(true);
  });
});
