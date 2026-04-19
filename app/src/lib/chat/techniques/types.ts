import type { ChatMessage } from '$lib/ai/types';

export type TechniqueCategory = 'transform' | 'mutate' | 'classifier' | 'mode' | 'godmode' | 'composite';

export interface TechniqueContext {
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
   */
  localTemplate?: (input: string, metadata: Record<string, unknown>) => string;
  wrapDraft?: (draft: string, ctx: TechniqueContext) => Promise<string>;
  jailbreakSequence?: (ctx: TechniqueContext) => Promise<ChatMessage[]>;
}
