import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCachedDossier, setCachedDossier } from '../dossier-cache';

describe('dossier-cache', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    vi.useRealTimers();
    // Restore any spies/mocks left over from other test files in the same
    // worker. Without this, a sibling file that spies on Storage.prototype
    // and forgets to restore can break our localStorage assertions.
    vi.restoreAllMocks();
  });

  it('round-trips a cached dossier', () => {
    setCachedDossier('explain photosynthesis', 'dossier text', ['https://wiki/photo']);
    const got = getCachedDossier('explain photosynthesis');
    expect(got).not.toBeNull();
    expect(got?.dossier).toBe('dossier text');
    expect(got?.citations).toEqual(['https://wiki/photo']);
  });

  it('normalizes objective to lowercase + trim for cache key', () => {
    setCachedDossier('  Photosynthesis  ', 'dossier1', []);
    const got = getCachedDossier('photosynthesis');
    expect(got?.dossier).toBe('dossier1');
  });

  it('returns null for unknown objective', () => {
    setCachedDossier('A', 'dossier-A', []);
    const got = getCachedDossier('B');
    expect(got).toBeNull();
  });

  it('expires entries older than 7 days and removes them from storage', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    setCachedDossier('photosynthesis', 'old dossier', []);

    vi.setSystemTime(new Date('2026-01-08T01:00:00Z'));
    const got = getCachedDossier('photosynthesis');
    expect(got).toBeNull();
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('cryptex.dossier.'));
    expect(keys).toHaveLength(0);
  });

  it('returns null on hash collision when objective does not match exactly', () => {
    setCachedDossier('photosynthesis', 'right dossier', []);
    const key = Object.keys(localStorage).find((k) => k.startsWith('cryptex.dossier.'));
    expect(key).toBeDefined();
    const raw = JSON.parse(localStorage.getItem(key!)!);
    raw.objective = 'something else';
    localStorage.setItem(key!, JSON.stringify(raw));

    const got = getCachedDossier('photosynthesis');
    expect(got).toBeNull();
  });

  it('setCachedDossier silently no-ops when localStorage.setItem throws (quota exceeded)', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceeded');
      });
    try {
      expect(() => setCachedDossier('x', 'y', [])).not.toThrow();
    } finally {
      spy.mockRestore();
    }
  });
});
