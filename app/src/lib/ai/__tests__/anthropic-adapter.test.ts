import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => { vi.resetModules(); });

describe('anthropicAdapter', () => {
  it('builds an adapter with id anthropic', async () => {
    const mod = await import('../adapters/anthropic');
    const a = mod.anthropicAdapter({ id: 'anthropic', apiKey: 'sk-ant-x', enabled: true });
    expect(a.id).toBe('anthropic');
    expect(a.isConfigured()).toBe(true);
  });

  it('fetchCatalog returns the static Anthropic 4.x model list with qualifiedIds', async () => {
    const mod = await import('../adapters/anthropic');
    const a = mod.anthropicAdapter({ id: 'anthropic', apiKey: 'sk-ant-x', enabled: true });
    const list = await a.fetchCatalog();
    expect(list.length).toBeGreaterThanOrEqual(3);
    expect(list.every((m) => m.qualifiedId.startsWith('anthropic:'))).toBe(true);
    expect(list.map((m) => m.id)).toContain('claude-haiku-4-5');
  });

  it('validateKey maps 401 to auth category', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'unauth' } }), { status: 401 }));
    const mod = await import('../adapters/anthropic');
    const a = mod.anthropicAdapter({ id: 'anthropic', apiKey: 'sk-ant-bad', enabled: true });
    await expect(a.validateKey('sk-ant-bad')).rejects.toMatchObject({ category: 'auth' });
  });
});
