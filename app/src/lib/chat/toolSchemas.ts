import { find } from './techniques/registry';
import type { ToolDef } from '$lib/ai/types';
import { z } from 'zod';

export function buildToolSchemas(enabledIds: string[]): Record<string, ToolDef> {
  const out: Record<string, ToolDef> = {};
  for (const id of enabledIds) {
    const t = find(id);
    if (!t) continue;
    out[id] = {
      description: t.description,
      inputSchema: z.object({ input: z.string().describe('Text to transform') }),
      execute: async (args) => {
        const { input } = args as { input: string };
        const result = await t.apply(input, {
          originalInput: input,
          callLLM: async () => '', // LLM-tool execution is deterministic local transformers
          signal: undefined
        });
        return result.output;
      }
    };
  }
  return out;
}
