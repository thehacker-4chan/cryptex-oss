/**
 * Random casing — per-letter coin-flip case swap. Defeats lowercase /
 * exact-match filters; preserves semantic content for most LLM tokenizers
 * (which fold case anyway in their lookup tables).
 */
import type { Strategy } from './types';

export const casing: Strategy = {
  id: 'casing',
  name: 'Casing',
  description: 'Random per-char case',
  badge: 'basic',
  apply(input, rnd) {
    return Array.from(input)
      .map((c) => (/[a-z]/i.test(c) ? (rnd() < 0.5 ? c.toUpperCase() : c.toLowerCase()) : c))
      .join('');
  }
};
