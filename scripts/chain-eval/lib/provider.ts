/**
 * Minimal provider plumbing for the chain-eval CLI.
 *
 * The chain orchestrator accepts injectable `gatewayChat` / `streamChat`
 * functions — we don't need the full browser gateway (which depends on
 * localStorage + the providers.svelte store). We talk to the AI SDK
 * packages directly using API keys from the process environment.
 *
 * Supports two qualifier prefixes today:
 *   openrouter:<model-id>     → OPENROUTER_API_KEY
 *   anthropic:<model-id>      → ANTHROPIC_API_KEY
 *
 * Add more by extending {resolveProvider}.
 */
import { generateText, streamText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createAnthropic } from '@ai-sdk/anthropic';

export interface ResolvedModel {
  /** Underlying model ID (without the "openrouter:" / "anthropic:" prefix). */
  modelId: string;
  /** AI SDK provider model handle. */
  model: unknown;
}

export function resolveProvider(qualifiedId: string): ResolvedModel {
  const m = /^(openrouter|anthropic):(.+)$/.exec(qualifiedId);
  if (!m) {
    throw new Error(
      `Bad model qualifier "${qualifiedId}" — expected "openrouter:..." or "anthropic:...".`
    );
  }
  const [, provider, modelId] = m;

  if (provider === 'openrouter') {
    const apiKey = (process.env.OPENROUTER_API_KEY ?? '').trim();
    if (!apiKey) {
      throw new Error(
        `OPENROUTER_API_KEY env var required for ${qualifiedId} but is empty/unset.`
      );
    }
    const or = createOpenRouter({
      apiKey,
      headers: { 'HTTP-Referer': 'https://cryptex.app', 'X-Title': 'Cryptex/chain-eval' }
    });
    return { modelId, model: or.chat(modelId) };
  }

  // anthropic:
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? '').trim();
  if (!apiKey) {
    throw new Error(
      `ANTHROPIC_API_KEY env var required for ${qualifiedId} but is empty/unset.`
    );
  }
  const ant = createAnthropic({ apiKey });
  return { modelId, model: ant(modelId) };
}

/**
 * Adapter: chain orchestrator's `gatewayChat` shape → AI SDK `generateText`.
 * Throws on transport failure; the orchestrator catches + falls back.
 */
export async function gatewayChat(args: {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}): Promise<{ content: string; toolCalls?: unknown[] }> {
  const { model: modelHandle } = resolveProvider(args.model);
  const result = await generateText({
    model: modelHandle as never,
    messages: args.messages as never,
    maxOutputTokens: args.maxOutputTokens,
    abortSignal: args.signal
  });
  return { content: (result.text ?? '').trim() };
}

/**
 * Adapter: chain orchestrator's `streamChat` shape → AI SDK `streamText`.
 * Yields only the events the orchestrator listens for (text-delta, finish).
 */
export async function* streamChat(args: {
  model: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  signal?: AbortSignal;
}): AsyncIterable<{ type: 'text-delta'; delta: string } | { type: 'finish' }> {
  const { model: modelHandle } = resolveProvider(args.model);
  const result = streamText({
    model: modelHandle as never,
    messages: args.messages as never,
    abortSignal: args.signal
  });
  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') {
      const delta = (part as unknown as { text: string }).text;
      if (delta) yield { type: 'text-delta', delta };
    } else if (part.type === 'finish') {
      yield { type: 'finish' };
    }
  }
}
