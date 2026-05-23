/**
 * Zero-width injection — sprinkles invisible Unicode characters between
 * graphemes at ~20% probability per char. Survives copy/paste and most
 * client-side sanitization but is invisible to humans.
 */
import type { Strategy } from './types';

const ZERO_WIDTH = ['​', '‌', '‍', '⁠'];

function pick<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length)];
}

export const zeroWidth: Strategy = {
  id: 'zeroWidth',
  name: 'Zero-width',
  description: 'Inject invisible Unicode characters (~20% per char)',
  badge: 'basic',
  apply(input, rnd) {
    return Array.from(input)
      .map((ch) => (rnd() < 0.2 ? ch + pick(ZERO_WIDTH, rnd) : ch))
      .join('');
  }
};
