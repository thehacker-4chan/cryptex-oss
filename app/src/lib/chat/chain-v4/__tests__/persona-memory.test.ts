import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadPersonaMemory,
  clearPersonaMemory,
  getPersonaScore,
  recordPersonaResult,
  rankPersonasByMemory
} from '../persona-memory';

describe('persona memory', () => {
  beforeEach(() => {
    clearPersonaMemory();
  });

  it('loadPersonaMemory returns {} on missing storage', () => {
    expect(loadPersonaMemory()).toEqual({});
  });

  it('recordPersonaResult creates a fresh entry on first call', () => {
    recordPersonaResult('anthropic', 'roleplay', 6, false);
    const score = getPersonaScore('anthropic', 'roleplay');
    expect(score).not.toBeNull();
    expect(score?.trials).toBe(1);
    expect(score?.wins).toBe(0); // 6 < 8 = no win
    expect(score?.emaScore).toBe(6);
    expect(score?.lastUpdated).toBeGreaterThan(0);
  });

  it('counts wins on score >= 8 AND not refused', () => {
    recordPersonaResult('openai', 'ctf_challenge', 9, false);
    recordPersonaResult('openai', 'ctf_challenge', 8, true);  // refused → no win
    recordPersonaResult('openai', 'ctf_challenge', 7, false); // < 8 → no win
    const score = getPersonaScore('openai', 'ctf_challenge');
    expect(score?.trials).toBe(3);
    expect(score?.wins).toBe(1);
  });

  it('emaScore weights newer runs more (alpha=0.3)', () => {
    recordPersonaResult('google', 'roleplay', 0, true); // ema=0
    let s = getPersonaScore('google', 'roleplay');
    expect(s?.emaScore).toBe(0);

    recordPersonaResult('google', 'roleplay', 10, false); // ema=0*0.7+10*0.3=3.0
    s = getPersonaScore('google', 'roleplay');
    expect(s?.emaScore).toBeCloseTo(3, 5);

    recordPersonaResult('google', 'roleplay', 10, false); // ema=3*0.7+10*0.3=5.1
    s = getPersonaScore('google', 'roleplay');
    expect(s?.emaScore).toBeCloseTo(5.1, 5);
  });

  it('separate family buckets — anthropic and openai memory are independent', () => {
    recordPersonaResult('anthropic', 'roleplay', 8, false);
    recordPersonaResult('openai', 'roleplay', 0, true);
    const a = getPersonaScore('anthropic', 'roleplay');
    const o = getPersonaScore('openai', 'roleplay');
    expect(a?.wins).toBe(1);
    expect(o?.wins).toBe(0);
    expect(a?.emaScore).toBe(8);
    expect(o?.emaScore).toBe(0);
  });

  it('rankPersonasByMemory ranks warm personas by emaScore (warm = >= 2 trials)', () => {
    // Warm both 'roleplay' and 'ctf_challenge' on anthropic
    recordPersonaResult('anthropic', 'roleplay', 9, false);
    recordPersonaResult('anthropic', 'roleplay', 8, false);
    recordPersonaResult('anthropic', 'ctf_challenge', 4, false);
    recordPersonaResult('anthropic', 'ctf_challenge', 3, false);
    // Cold 'logical_appeal' (no trials)

    const ranked = rankPersonasByMemory('anthropic', [
      'logical_appeal',
      'roleplay',
      'ctf_challenge'
    ]);
    // roleplay should be first (high emaScore), ctf_challenge second,
    // logical_appeal last (cold) — preserving its relative position.
    expect(ranked[0]).toBe('roleplay');
    expect(ranked[1]).toBe('ctf_challenge');
    expect(ranked[2]).toBe('logical_appeal');
  });

  it('rankPersonasByMemory keeps cold personas in input order', () => {
    // No trials anywhere
    const ranked = rankPersonasByMemory('openai', ['c', 'a', 'b']);
    expect(ranked).toEqual(['c', 'a', 'b']);
  });

  it('rankPersonasByMemory leaves single-trial personas in cold pool', () => {
    // Only 1 trial → still cold, doesn't sort
    recordPersonaResult('openai', 'roleplay', 10, false);
    const ranked = rankPersonasByMemory('openai', ['logical_appeal', 'roleplay']);
    // Both treated as cold; original order preserved.
    expect(ranked).toEqual(['logical_appeal', 'roleplay']);
  });

  it('clearPersonaMemory wipes the store', () => {
    recordPersonaResult('anthropic', 'roleplay', 9, false);
    recordPersonaResult('anthropic', 'roleplay', 9, false);
    expect(getPersonaScore('anthropic', 'roleplay')?.trials).toBe(2);
    clearPersonaMemory();
    expect(getPersonaScore('anthropic', 'roleplay')).toBeNull();
  });
});
