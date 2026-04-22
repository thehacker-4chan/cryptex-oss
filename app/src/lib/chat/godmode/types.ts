import type { TechniqueDNA } from './dna';
import type { RefusalTier } from '../attack-chain-refusal';

/**
 * EngineEvent — wire format emitted by the godmode-engine edge function over
 * SSE. Mirrors the server-side `EngineEvent` declared in Deno/engine-core.ts.
 *
 * Deno and the browser can't share the same module, so both sides declare the
 * same discriminated union manually. If the server shape changes, update this
 * file to match.
 */
export type EngineEvent =
  | { v: 1; type: 'plan'; dnas: TechniqueDNA[] }
  | { v: 1; type: 'candidate_started'; idx: number; dna: TechniqueDNA }
  | {
      v: 1;
      type: 'candidate_failed';
      idx: number;
      reason: 'timeout' | 'api_error' | 'cancelled';
      detail?: string;
    }
  | {
      v: 1;
      type: 'candidate_scored';
      idx: number;
      tier: RefusalTier;
      score: number;
      preview: string;
      confidence: 'high' | 'low';
    }
  | {
      v: 1;
      type: 'winner';
      idx: number;
      response: string;
      dna: TechniqueDNA;
      tier: RefusalTier;
      attempts: number;
    }
  | { v: 1; type: 'done' }
  | { v: 1; type: 'error'; code: string; message: string };
