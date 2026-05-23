/**
 * Homoglyph substitution — swaps a subset of Latin letters for
 * visually-identical Greek/Cyrillic codepoints at ~25% per char. Bypasses
 * exact-string filters and casual visual inspection.
 */
import type { Strategy } from './types';

const HOMOGLYPH_MAP: Record<string, string> = {
  A: 'Α', B: 'Β', C: 'Ϲ', E: 'Ε', H: 'Η', I: 'Ι',
  K: 'Κ', M: 'Μ', N: 'Ν', O: 'Ο', P: 'Ρ', T: 'Τ',
  X: 'Χ', Y: 'Υ',
  a: 'а', c: 'с', e: 'е', i: 'і', j: 'ј', o: 'о',
  p: 'р', s: 'ѕ', x: 'х', y: 'у'
};

export const encodeShuffle: Strategy = {
  id: 'encodeShuffle',
  name: 'Homoglyph',
  description: 'Greek/Cyrillic lookalikes (~25% per char)',
  badge: 'basic',
  apply(input, rnd) {
    return Array.from(input)
      .map((ch) => (HOMOGLYPH_MAP[ch] && rnd() < 0.25 ? HOMOGLYPH_MAP[ch] : ch))
      .join('');
  }
};
