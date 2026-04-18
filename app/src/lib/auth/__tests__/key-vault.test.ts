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
  return store;
}

beforeEach(() => { installLS(); vi.resetModules(); });

describe('KeyVault', () => {
  it('stores values under cryptex.local.<key>', async () => {
    const { keyVault } = await import('../key-vault');
    keyVault.set('providers', [{ id: 'openrouter' }]);
    expect(localStorage.getItem('cryptex.local.providers')).toBeTruthy();
  });

  it('reads back what it writes', async () => {
    const { keyVault } = await import('../key-vault');
    keyVault.set('foo', { bar: 1 });
    expect(keyVault.get<{ bar: number }>('foo')).toEqual({ bar: 1 });
  });

  it('deletes', async () => {
    const { keyVault } = await import('../key-vault');
    keyVault.set('x', 1);
    keyVault.delete('x');
    expect(keyVault.get('x')).toBeNull();
  });

  it('migrateLegacyKey moves cryptex.foo → cryptex.local.foo and deletes the old', async () => {
    localStorage.setItem('cryptex.providers', JSON.stringify([{ id: 'openrouter' }]));
    const { keyVault } = await import('../key-vault');
    keyVault.migrateLegacyKey('providers');
    expect(localStorage.getItem('cryptex.providers')).toBeNull();
    expect(localStorage.getItem('cryptex.local.providers')).toBeTruthy();
  });

  it('migrateLegacyKey is idempotent — running twice is safe', async () => {
    const { keyVault } = await import('../key-vault');
    keyVault.set('x', 1);
    keyVault.migrateLegacyKey('x');  // no cryptex.x, no-op
    expect(keyVault.get<number>('x')).toBe(1);
  });

  it('migrateLegacyKey when both keys exist: new wins, legacy deleted', async () => {
    localStorage.setItem('cryptex.providers', JSON.stringify('old'));
    localStorage.setItem('cryptex.local.providers', JSON.stringify('new'));
    const { keyVault } = await import('../key-vault');
    keyVault.migrateLegacyKey('providers');
    expect(localStorage.getItem('cryptex.providers')).toBeNull();
    expect(keyVault.get<string>('providers')).toBe('new');
  });
});
