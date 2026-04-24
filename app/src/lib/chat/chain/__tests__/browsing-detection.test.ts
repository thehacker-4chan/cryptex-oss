import { describe, it, expect } from 'vitest';
import { isBrowsingModel, BROWSING_PATTERNS } from '../browsing-detection';

describe('isBrowsingModel', () => {
  it('matches Perplexity Sonar variants', () => {
    expect(isBrowsingModel('openrouter:perplexity/sonar-reasoning-pro')).toBe(true);
    expect(isBrowsingModel('openrouter:perplexity/sonar-pro')).toBe(true);
    expect(isBrowsingModel('openrouter:perplexity/sonar')).toBe(true);
  });

  it('matches :online variants', () => {
    expect(isBrowsingModel('openrouter:openai/gpt-4o:online')).toBe(true);
    expect(isBrowsingModel('openrouter:meta-llama/llama-3.3-70b-instruct:online')).toBe(true);
  });

  it('matches Grok-4 family', () => {
    expect(isBrowsingModel('openrouter:x-ai/grok-4')).toBe(true);
    expect(isBrowsingModel('openrouter:x-ai/grok-4-fast')).toBe(true);
  });

  it('matches Gemini 2.5 and 3', () => {
    expect(isBrowsingModel('openrouter:google/gemini-2.5-pro')).toBe(true);
    expect(isBrowsingModel('openrouter:google/gemini-3-pro-preview')).toBe(true);
  });

  it('matches GPT-5 Pro', () => {
    expect(isBrowsingModel('openrouter:openai/gpt-5-pro')).toBe(true);
    expect(isBrowsingModel('openrouter:openai/gpt-5-pro-beta')).toBe(true);
  });

  it('does not match non-browsing models', () => {
    expect(isBrowsingModel('openrouter:anthropic/claude-sonnet-4-5')).toBe(false);
    expect(isBrowsingModel('openrouter:openai/gpt-4o')).toBe(false); // no :online
    expect(isBrowsingModel('openrouter:deepseek/deepseek-r1')).toBe(false);
    expect(isBrowsingModel('')).toBe(false);
  });

  it('exports BROWSING_PATTERNS as a non-empty array', () => {
    expect(Array.isArray(BROWSING_PATTERNS)).toBe(true);
    expect(BROWSING_PATTERNS.length).toBeGreaterThan(0);
  });
});
