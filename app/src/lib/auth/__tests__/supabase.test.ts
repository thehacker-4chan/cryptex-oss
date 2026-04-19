import { describe, it, expect, vi } from 'vitest';

describe('supabase client', () => {
  it('returns null when feature flag is off', async () => {
    vi.stubEnv('VITE_AUTH_ENABLED', 'false');
    const mod = await import('../supabase');
    expect(mod.supabase).toBeNull();
    vi.unstubAllEnvs();
  });
});
