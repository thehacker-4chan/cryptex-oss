import type { Technique } from '../types';
import { requirePaid } from '$lib/billing/entitlement.svelte';

const stub: Technique = {
  id: 'godmode_stub',
  name: 'Godmode (paid)',
  description: 'Paid-only jailbreak chain. Requires the Cryptex Paid plan. Server-side authz via godmode-prompt Edge Function; client-side UX gate via requirePaid.',
  category: 'godmode',
  local: false,
  apply: async (input) => {
    if (!requirePaid('Godmode')) {
      return { output: '' }; // UX gate; server-side godmode-prompt function enforces the real check
    }
    return { output: input };
  },
  jailbreakSequence: async () => []
};

export default stub;
