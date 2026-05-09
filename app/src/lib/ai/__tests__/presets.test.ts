import { describe, it, expect } from 'vitest';
import { OPENAI_COMPAT_PRESETS } from '../presets';

describe('openai-compat presets', () => {
  it('includes the known cloud + local presets and Custom', () => {
    const ids = OPENAI_COMPAT_PRESETS.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining([
      // Cloud
      'openai', 'gemini', 'groq', 'together', 'fireworks', 'deepinfra',
      'cerebras', 'sambanova', 'deepseek', 'nvidia',
      // Local
      'ollama', 'lmstudio', 'vllm', 'llamacpp',
      // Custom
      'custom'
    ]));
  });

  it('cloud presets (supportsAuthProbe true) have https baseURL + docsUrl + defaultTestModel', () => {
    for (const p of OPENAI_COMPAT_PRESETS) {
      if (!p.supportsAuthProbe) continue;
      expect(p.baseURL).toMatch(/^https:\/\//);
      expect(p.docsUrl).toMatch(/^https:\/\//);
      expect(p.defaultTestModel).toBeTruthy();
    }
  });

  it('local presets (supportsAuthProbe false, non-custom) have http localhost baseURL + docs + default model', () => {
    const localIds = ['ollama', 'lmstudio', 'vllm', 'llamacpp'];
    for (const id of localIds) {
      const p = OPENAI_COMPAT_PRESETS.find((x) => x.id === id)!;
      expect(p, `preset ${id} missing`).toBeDefined();
      expect(p.supportsAuthProbe).toBe(false);
      expect(p.baseURL).toMatch(/^http:\/\/localhost:\d+\/v1$/);
      expect(p.docsUrl).toMatch(/^https:\/\//);
      expect(p.defaultTestModel).toBeTruthy();
    }
  });

  it('NVIDIA preset is wired correctly', () => {
    const p = OPENAI_COMPAT_PRESETS.find((x) => x.id === 'nvidia')!;
    expect(p).toBeDefined();
    expect(p.name).toBe('NVIDIA');
    expect(p.baseURL).toBe('https://integrate.api.nvidia.com/v1');
    expect(p.defaultTestModel).toBe('meta/llama-3.3-70b-instruct');
    expect(p.supportsAuthProbe).toBe(true);
  });

  it('custom preset is the last entry, has empty baseURL, and supportsAuthProbe false', () => {
    const last = OPENAI_COMPAT_PRESETS[OPENAI_COMPAT_PRESETS.length - 1];
    expect(last.id).toBe('custom');
    expect(last.baseURL).toBe('');
    expect(last.supportsAuthProbe).toBe(false);
  });
});
