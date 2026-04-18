import { describe, it, expect, beforeEach, vi } from 'vitest';

function installLS() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: vi.fn((k: string) => store.get(k) ?? null),
      setItem: vi.fn((k: string, v: string) => { store.set(k, v); }),
      removeItem: vi.fn((k: string) => { store.delete(k); }),
      clear: vi.fn(() => { store.clear(); }),
      get length() { return store.size; },
      key: vi.fn((i: number) => [...store.keys()][i] ?? null)
    },
    writable: true, configurable: true
  });
}

beforeEach(() => { installLS(); vi.resetModules(); });

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
