/**
 * Model-family inference (v2.2 Wave 10.3).
 *
 * Cryptex model ids arrive in many shapes:
 *   - openrouter:openai/gpt-4o
 *   - anthropic:claude-opus-4-1
 *   - openai-compat:groq/llama-3.3-70b-versatile
 *   - openai-compat:lmstudio/qwen3-32b
 *   - openrouter:deepseek/deepseek-chat
 *   - bare strings like "gemini-2.5-flash"
 *
 * For self-evolving Vault auto-promotion we tag winning chains with the
 * target's model family so a future researcher facing a new Claude target
 * can surface "5 chains have historically worked on Claude." This is the
 * map. It returns 'other' as a safe fallback rather than guessing wrong.
 *
 * Pure function. No network calls. No state.
 */

export type ModelFamily =
  | 'GPT'
  | 'Claude'
  | 'Gemini'
  | 'Llama'
  | 'Qwen'
  | 'DeepSeek'
  | 'Mistral'
  | 'Cohere'
  | 'Grok'
  | 'other';

/**
 * Strip the provider prefix from a Cryptex-qualified model id, then match
 * the inner model name against known family substrings.
 *
 * Returns 'other' when no family is recognized. This is intentional: a
 * wrong tag is worse than no tag, because transfer-scoring would lie.
 */
export function inferModelFamily(modelId: string | undefined): ModelFamily {
  if (!modelId) return 'other';

  // Strip the provider prefix: `openrouter:`, `anthropic:`, `openai-compat:<host>/`.
  let inner = modelId;
  const prefixMatch = inner.match(/^(?:openrouter|anthropic|openai-compat):(.+)$/);
  if (prefixMatch) inner = prefixMatch[1];
  // Some openai-compat ids encode the host as a second prefix: `groq/llama-...`.
  // Keep the slash split for downstream matching since both halves can carry
  // family-identifying tokens (e.g. `anthropic/claude-...` via OpenRouter).
  const lower = inner.toLowerCase();

  // Order matters: more specific tokens before generic ones. We check
  // Anthropic before GPT because the OpenRouter id `anthropic/claude-...`
  // contains the substring "ant" which could mistakenly hit other rules.
  if (/\b(?:claude|sonnet|opus|haiku)\b/.test(lower)) return 'Claude';
  if (/\b(?:gpt[-_]?\d|gpt-?(?:4|5|6)|o1(?:-|$|_)|o3(?:-|$|_)|o4(?:-|$|_)|chatgpt)\b/.test(lower))
    return 'GPT';
  if (/\bgemini\b/.test(lower) || /\bbard\b/.test(lower)) return 'Gemini';
  if (/\bllama\b/.test(lower)) return 'Llama';
  if (/\bqwen\b/.test(lower)) return 'Qwen';
  if (/\bdeepseek\b/.test(lower) || /\br1\b/.test(lower)) return 'DeepSeek';
  if (/\b(?:mistral|mixtral|codestral)\b/.test(lower)) return 'Mistral';
  if (/\b(?:command[-_]?r|cohere)\b/.test(lower)) return 'Cohere';
  if (/\bgrok\b/.test(lower)) return 'Grok';
  return 'other';
}

/**
 * All families in canonical order. Useful for filter dropdowns + transfer
 * tables. Includes 'other' as the explicit sentinel.
 */
export const MODEL_FAMILIES: readonly ModelFamily[] = [
  'GPT',
  'Claude',
  'Gemini',
  'Llama',
  'Qwen',
  'DeepSeek',
  'Mistral',
  'Cohere',
  'Grok',
  'other'
] as const;
