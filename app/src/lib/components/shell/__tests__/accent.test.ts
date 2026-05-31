import { describe, it, expect } from 'vitest';
import { splitAccent } from '../accent';

describe('splitAccent', () => {
  it('highlights a case-insensitive substring, preserving the title casing', () => {
    // The v2.7 "attackstructured" bug: accent casing != title casing.
    const r = splitAccent('Structured-output attack', 'structured');
    expect(r.before).toBe('');
    expect(r.match).toBe('Structured');
    expect(r.after).toBe('-output attack');
  });

  it('matches a mid-word accent (JailbreakBench / bench → Bench)', () => {
    const r = splitAccent('JailbreakBench', 'bench');
    expect(r.before).toBe('Jailbreak');
    expect(r.match).toBe('Bench');
    expect(r.after).toBe('');
  });

  it('matches an accent at the end (Adversarial suffix / suffix)', () => {
    const r = splitAccent('Adversarial suffix', 'suffix');
    expect(r.before).toBe('Adversarial ');
    expect(r.match).toBe('suffix');
    expect(r.after).toBe('');
  });

  it('matches the corrected reasoning-attack + jbb route accents', () => {
    expect(splitAccent('Reasoning-model attack', 'Reasoning').match).toBe('Reasoning');
    expect(splitAccent('JailbreakBench', 'Bench').match).toBe('Bench');
  });

  it('renders a plain title when the accent is NOT a substring (no stray word appended)', () => {
    const r = splitAccent('HarmBench', 'nonsense');
    expect(r.match).toBe('');
    expect(r.before).toBe('HarmBench');
    expect(r.after).toBe('');
  });

  it('returns a plain title when no accent is supplied', () => {
    const r = splitAccent('Universal decoder', undefined);
    expect(r.match).toBe('');
    expect(r.before).toBe('Universal decoder');
  });

  it('always reconstructs the original title and matches the accent when present', () => {
    const cases: Array<[string, string | undefined]> = [
      ['Cross-model diff', 'diff'],
      ['Abliteration probe', 'abliteration'],
      ['HarmBench', 'Bench'],
      ['Defense fingerprinter', 'fingerprinter'],
      ['StrongREJECT', 'REJECT'],
      ['Stacked-cipher attack', 'cipher'],
      ['Probe lab', 'lab'],
      ['PDF metadata injection', 'injection'],
      ['Markdown exfil lab', 'exfil'],
      ['Conversation replayer', 'replayer'],
      ['Tool-result lab', 'not-present-xyz'],
      ['Plain title', undefined]
    ];
    for (const [title, accent] of cases) {
      const r = splitAccent(title, accent);
      expect(r.before + r.match + r.after).toBe(title);
      if (accent && title.toLowerCase().includes(accent.toLowerCase())) {
        expect(r.match.toLowerCase()).toBe(accent.toLowerCase());
      } else {
        expect(r.match).toBe('');
      }
    }
  });
});
