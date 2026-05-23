/**
 * Random-mix strategy — chains the legacy 'Random Mix' transformer (a
 * 2-4 step pipeline of canonical transforms). Falls back to the input
 * unchanged when the transformer isn't available in this build.
 */
import type { Strategy } from './types';
import { getTransformer } from '$lib/transformers/registry';

function safeRandomizerApply(text: string): string {
  const randomizer =
    getTransformer('Random Mix') ||
    getTransformer('Randomizer') ||
    getTransformer('Random');
  if (!randomizer) return text;
  try {
    return randomizer.func(text, { minTransforms: 2, maxTransforms: 4 });
  } catch {
    return text;
  }
}

export const useRandomMix: Strategy = {
  id: 'useRandomMix',
  name: 'Random Mix',
  description: 'Chain a 2-4 transform pipeline from the canonical registry',
  badge: 'basic',
  apply(input) {
    return safeRandomizerApply(input);
  }
};
