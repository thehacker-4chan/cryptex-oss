import { describe, it, expect } from 'vitest';
import { session } from '../session.svelte';

describe('session (v1 local stub)', () => {
  it('returns a local user', () => {
    expect(session.currentUser.id).toBe('local');
    expect(session.isAuthenticated).toBe(true);
  });

  it('hasFeature returns true for all flags in v1', () => {
    expect(session.hasFeature('godmode')).toBe(true);
    expect(session.hasFeature('mcp')).toBe(true);
    expect(session.hasFeature('export')).toBe(true);
  });

  it('getAuthHeader returns empty object', () => {
    expect(session.getAuthHeader()).toEqual({});
  });

  it('login and logout are no-ops that resolve', async () => {
    await expect(session.login()).resolves.toBeUndefined();
    await expect(session.logout()).resolves.toBeUndefined();
  });
});
