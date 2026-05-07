import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use JSDOM's real localStorage (provided by the vitest jsdom env) instead of
// installing a fake. The previous fake leaked across the singleFork test
// pool — it exposed only function properties, so later tests calling
// Object.keys(localStorage) saw garbage instead of stored cache keys.
beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe('providers registry', () => {
  it('seeds OpenRouter record from legacy cryptex.openrouterApiKey on first load', async () => {
    localStorage.setItem('cryptex.openrouterApiKey', 'sk-or-legacy');
    const mod = await import('../providers.svelte');
    const list = mod.listProviders();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('openrouter');
    expect(list[0].apiKey).toBe('sk-or-legacy');
    expect(list[0].enabled).toBe(true);
  });

  it('starts with an empty OpenRouter record if no legacy key exists', async () => {
    const mod = await import('../providers.svelte');
    const list = mod.listProviders();
    expect(list[0].id).toBe('openrouter');
    expect(list[0].apiKey).toBe('');
  });

  it('adds and removes provider records', async () => {
    const mod = await import('../providers.svelte');
    mod.addProvider({ id: 'anthropic', apiKey: 'sk-ant-x', enabled: true });
    expect(mod.listProviders()).toHaveLength(2);
    mod.removeProvider('anthropic');
    expect(mod.listProviders()).toHaveLength(1);
  });
});
