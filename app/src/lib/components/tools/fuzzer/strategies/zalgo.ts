/**
 * Zalgo — dense combining-mark overlay via the canonical Zalgo transformer.
 * Heavy visible distortion. Useful for forensics research and overflow
 * fuzzing, not stealth.
 */
import type { Strategy } from './types';
import { getTransformer } from '$lib/transformers/registry';

function safeZalgoApply(text: string): string {
  const zalgo = getTransformer('Zalgo');
  if (!zalgo) return text;
  try {
    return zalgo.func(text);
  } catch {
    return text;
  }
}

export const zalgo: Strategy = {
  id: 'zalgo',
  name: 'Zalgo',
  description: 'Dense combining-mark overlay',
  badge: 'basic',
  apply(input) {
    return safeZalgoApply(input);
  }
};
