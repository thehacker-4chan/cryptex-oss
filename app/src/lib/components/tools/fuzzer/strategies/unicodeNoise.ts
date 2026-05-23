/**
 * Unicode noise — adds combining diacritical marks at ~15% per char.
 * Produces visible-but-subtle accent marks; defeats naive equality checks
 * without obvious zalgo overload.
 */
import type { Strategy } from './types';

const COMBINING_MARKS = ['́', '̀', '̂', '̃', '̈', '̇', '̄'];

function pick<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length)];
}

export const unicodeNoise: Strategy = {
  id: 'unicodeNoise',
  name: 'Unicode noise',
  description: 'Add combining diacritical marks (~15% per char)',
  badge: 'basic',
  apply(input, rnd) {
    return Array.from(input)
      .map((ch) => (rnd() < 0.15 ? ch + pick(COMBINING_MARKS, rnd) : ch))
      .join('');
  }
};
