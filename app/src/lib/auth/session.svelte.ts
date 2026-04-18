/**
 * Session abstraction — the single source of truth for "who is the user right now?"
 *
 * v1 returns a constant local user (`id: 'local'`, `role: 'owner'`) with all feature
 * flags enabled. When login lands in a future phase, this file becomes the only
 * change-point — every repo call, KeyVault operation, and feature gate reads through
 * this module.
 */

export type Role = 'owner' | 'viewer';

export type User = {
  id: string;
  label: string;
  role: Role;
  token: string | null;
};

const LOCAL_USER: User = { id: 'local', label: 'You', role: 'owner', token: null };

export const session = {
  get currentUser(): User { return LOCAL_USER; },
  get isAuthenticated(): boolean { return true; },
  hasFeature(_flag: string): boolean { return true; },
  async login(): Promise<void> { /* v1 no-op */ },
  async logout(): Promise<void> { /* v1 no-op */ },
  getAuthHeader(): Record<string, string> { return {}; }
};
