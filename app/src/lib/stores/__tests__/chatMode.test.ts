import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use JSDOM's real localStorage (provided by the vitest jsdom environment)
// instead of installing a fake at globalThis. The previous fake leaked across
// the singleFork test pool and broke unrelated tests that call
// Object.keys(localStorage) (the fake exposed only function properties, no
// stored keys).
beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe('chatMode store', () => {
  it('defaults to "tools" on first load', async () => {
    const mod = await import('../chatMode.svelte');
    expect(mod.chatMode.value).toBe('tools');
  });

  it('persists changes to cryptex.ui.mode', async () => {
    const mod = await import('../chatMode.svelte');
    mod.chatMode.value = 'chat';
    expect(localStorage.getItem('cryptex.ui.mode')).toContain('chat');
  });

  it('hydrates from persisted value', async () => {
    localStorage.setItem('cryptex.ui.mode', JSON.stringify('chat'));
    const mod = await import('../chatMode.svelte');
    expect(mod.chatMode.value).toBe('chat');
  });
});
