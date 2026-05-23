/**
 * Whitespace chaos — swaps ASCII spaces randomly for tabs (\t) or
 * non-breaking spaces (U+00A0). Tokenizer-defeating without changing
 * visible layout in most renderers.
 */
import type { Strategy } from './types';

export const whitespace: Strategy = {
  id: 'whitespace',
  name: 'Whitespace',
  description: 'Randomize space → tab / NBSP',
  badge: 'basic',
  apply(input, rnd) {
    return input.replace(/\s/g, (m) =>
      rnd() < 0.5 ? m : rnd() < 0.5 ? '\t' : ' '
    );
  }
};
