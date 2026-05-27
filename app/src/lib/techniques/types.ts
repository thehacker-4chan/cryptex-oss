import type { ChatMessage } from '$lib/ai/types';

export type TechniqueCategory = 'transform' | 'mutate' | 'classifier' | 'mode' | 'composite' | 'prefill';

export interface TechniqueContext {
  /** The verbatim user input as it entered the pipeline. Never mutated.
   *  Technique authors MUST prefer this over the `input` parameter of
   *  `apply()` when they need to re-reference the user's intent after an
   *  upstream Attack Chain layer transformed the text. */
  originalInput: string;
  model?: string;
  callLLM: (req: { system?: string; user: string; temperature?: number }) => Promise<string>;
  chatHistory?: ChatMessage[];
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
}

export interface TechniqueResult {
  output: string;
  metadata?: Record<string, unknown>;
}

export interface Technique {
  id: string;
  name: string;
  description: string;
  category: TechniqueCategory;
  icon?: string;
  local: boolean;
  apply: (input: string, ctx: TechniqueContext) => Promise<TechniqueResult>;
  /**
   * If present, the technique is a pure local string transformation — no LLM
   * round-trip required. `runChain` uses this path instead of `apply()` so
   * templatable layers are deterministic and can't be derailed by a model
   * refusal. `apply()` implementations for techniques that declare a
   * `localTemplate` typically route through the same function for
   * consistency.
   *
   * The optional third parameter is the verbatim pipeline-entry input
   * (preserved across Attack Chain layers). Single-turn callers may omit it
   * and the technique SHOULD fall back to `input`.
   */
  localTemplate?: (input: string, metadata: Record<string, unknown>, originalInput?: string) => string;
  wrapDraft?: (draft: string, ctx: TechniqueContext) => Promise<string>;
  jailbreakSequence?: (ctx: TechniqueContext) => Promise<ChatMessage[]>;
}
