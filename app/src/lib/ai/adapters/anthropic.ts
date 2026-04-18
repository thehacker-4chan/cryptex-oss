import { createAnthropic } from '@ai-sdk/anthropic';
import type { Adapter } from './base';
import type { Model, ProviderRecord, KeyInfo } from '../types';
import { translateError } from '../errors';

const BASE_URL = 'https://api.anthropic.com';

// `reasoning: true` reflects API support for the extended_thinking parameter — not a qualitative tier of reasoning.
/** Static Anthropic 4.x catalog as of 2026-04-18. No /models endpoint exists. */
const STATIC_MODELS: ReadonlyArray<{ id: string; name: string; reasoning?: boolean; vision?: boolean; tools?: boolean }> = [
  { id: 'claude-opus-4-7',     name: 'Claude Opus 4.7',     reasoning: true, vision: true, tools: true },
  { id: 'claude-sonnet-4-6',   name: 'Claude Sonnet 4.6',   reasoning: true, vision: true, tools: true },
  { id: 'claude-haiku-4-5',    name: 'Claude Haiku 4.5',    reasoning: true, vision: true, tools: true }
];

export function anthropicAdapter(record: Extract<ProviderRecord, { id: 'anthropic' }>): Adapter {
  const key = (record.apiKey || '').trim();

  const provider = createAnthropic({
    apiKey: key,
    headers: { 'anthropic-dangerous-direct-browser-access': 'true' }
  });

  return {
    id: 'anthropic',
    isConfigured: () => Boolean(key),
    resolveModel: (modelId) => provider(modelId),
    validateKey: async (candidate, signal) => {
      let resp: Response;
      try {
        resp = await fetch(`${BASE_URL}/v1/messages`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': candidate,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5',
            max_tokens: 1,
            messages: [{ role: 'user', content: '.' }]
          }),
          signal
        });
      } catch (e) { throw translateError(e, 'anthropic', { suspectCors: true }); }
      if (resp.ok) {
        await resp.text().catch(() => '');
        return { label: 'anthropic', raw: undefined } satisfies KeyInfo;
      }
      const body = await resp.text().catch(() => '');
      throw translateError({ status: resp.status, message: body || `HTTP ${resp.status}` }, 'anthropic');
    },
    fetchCatalog: async () => {
      const out: Model[] = STATIC_MODELS.map((m) => ({
        id: m.id,
        qualifiedId: `anthropic:${m.id}` as const,
        name: m.name,
        provider: 'anthropic' as const,
        upstreamProvider: 'Anthropic',
        capabilities: { streaming: true, tools: m.tools, vision: m.vision, reasoning: m.reasoning, jsonSchema: true }
      }));
      return out;
    }
  };
}
