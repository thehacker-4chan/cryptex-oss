import type { ProviderPreset } from './types';

/**
 * OpenAI-compatible preset templates.
 *
 * Each preset is editable in the ProviderCard after creation — if a baseURL or
 * default model goes stale, users can fix it in-place.
 *
 * Local-model providers (Ollama, LM Studio, vLLM, Llama.cpp) use localhost URLs
 * and don't require API keys (supportsAuthProbe: false). Cloud providers require
 * the user's own API key and validate via /v1/models on save.
 */
export const OPENAI_COMPAT_PRESETS: ProviderPreset[] = [
  { id: 'openai',     name: 'OpenAI',     baseURL: 'https://api.openai.com/v1',
    docsUrl: 'https://platform.openai.com/docs/api-reference',
    defaultTestModel: 'gpt-4o-mini', supportsAuthProbe: true },
  { id: 'gemini',     name: 'Google Gemini', baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/openai',
    defaultTestModel: 'gemini-2.5-flash', supportsAuthProbe: true },
  { id: 'groq',       name: 'Groq',       baseURL: 'https://api.groq.com/openai/v1',
    docsUrl: 'https://console.groq.com/docs/api-reference',
    defaultTestModel: 'llama-3.3-70b-versatile', supportsAuthProbe: true },
  { id: 'together',   name: 'Together',   baseURL: 'https://api.together.xyz/v1',
    docsUrl: 'https://docs.together.ai/reference/chat-completions-1',
    defaultTestModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', supportsAuthProbe: true },
  { id: 'fireworks',  name: 'Fireworks',  baseURL: 'https://api.fireworks.ai/inference/v1',
    docsUrl: 'https://docs.fireworks.ai/api-reference/introduction',
    defaultTestModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    supportsAuthProbe: true },
  { id: 'deepinfra',  name: 'DeepInfra',  baseURL: 'https://api.deepinfra.com/v1/openai',
    docsUrl: 'https://deepinfra.com/docs/advanced/openai_api',
    defaultTestModel: 'meta-llama/Llama-3.3-70B-Instruct', supportsAuthProbe: true },
  { id: 'cerebras',   name: 'Cerebras',   baseURL: 'https://api.cerebras.ai/v1',
    docsUrl: 'https://inference-docs.cerebras.ai/api-reference/chat-completions',
    defaultTestModel: 'llama-3.3-70b', supportsAuthProbe: true },
  { id: 'deepseek',   name: 'DeepSeek',   baseURL: 'https://api.deepseek.com/v1',
    docsUrl: 'https://api-docs.deepseek.com/',
    defaultTestModel: 'deepseek-chat', supportsAuthProbe: true },
  { id: 'sambanova',  name: 'SambaNova',  baseURL: 'https://api.sambanova.ai/v1',
    docsUrl: 'https://docs.sambanova.ai/cloud/api-reference/endpoints/chat',
    defaultTestModel: 'Meta-Llama-3.3-70B-Instruct', supportsAuthProbe: true },
  { id: 'nvidia',     name: 'NVIDIA',     baseURL: 'https://integrate.api.nvidia.com/v1',
    docsUrl: 'https://docs.api.nvidia.com/nim/reference/llm-apis',
    defaultTestModel: 'meta/llama-3.3-70b-instruct', supportsAuthProbe: true },
  { id: 'ollama',     name: 'Ollama',     baseURL: 'http://localhost:11434/v1',
    docsUrl: 'https://github.com/ollama/ollama/blob/main/docs/openai.md',
    defaultTestModel: 'llama3.2', supportsAuthProbe: false },
  { id: 'lmstudio',   name: 'LM Studio',  baseURL: 'http://localhost:1234/v1',
    docsUrl: 'https://lmstudio.ai/docs/api/openai-api',
    defaultTestModel: 'local-model', supportsAuthProbe: false },
  { id: 'vllm',       name: 'vLLM',       baseURL: 'http://localhost:8000/v1',
    docsUrl: 'https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html',
    defaultTestModel: 'meta-llama/Llama-3.3-70B-Instruct', supportsAuthProbe: false },
  { id: 'llamacpp',   name: 'Llama.cpp',  baseURL: 'http://localhost:8080/v1',
    docsUrl: 'https://github.com/ggml-org/llama.cpp/tree/master/tools/server',
    defaultTestModel: 'gpt-3.5-turbo', supportsAuthProbe: false },
  { id: 'custom',     name: 'Custom',     baseURL: '', docsUrl: '',
    defaultTestModel: undefined, supportsAuthProbe: false }
];

export function getPreset(id: string): ProviderPreset | undefined {
  return OPENAI_COMPAT_PRESETS.find((p) => p.id === id);
}
