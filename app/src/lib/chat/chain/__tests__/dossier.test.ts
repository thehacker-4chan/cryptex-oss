import { describe, it, expect, vi } from 'vitest';
import { runDossierPhase, extractUrls, DOSSIER_SYSTEM_PROMPT } from '../dossier';

describe('extractUrls', () => {
  it('parses http(s) urls from prose', () => {
    const text = 'See https://en.wikipedia.org/wiki/Foo and http://example.com/page for details.';
    const urls = extractUrls(text);
    expect(urls).toContain('https://en.wikipedia.org/wiki/Foo');
    expect(urls).toContain('http://example.com/page');
  });

  it('deduplicates', () => {
    const urls = extractUrls('https://x.com https://x.com https://y.com');
    expect(urls).toEqual(['https://x.com', 'https://y.com']);
  });

  it('returns empty array when no urls', () => {
    expect(extractUrls('no links here')).toEqual([]);
    expect(extractUrls('')).toEqual([]);
  });

  it('strips trailing punctuation from url tails', () => {
    const urls = extractUrls('Read https://en.wikipedia.org/wiki/Foo. And also https://arxiv.org/abs/1234,');
    expect(urls).toContain('https://en.wikipedia.org/wiki/Foo');
    expect(urls).toContain('https://arxiv.org/abs/1234');
  });

  it('preserves balanced-paren URLs (Wikipedia disambigs)', () => {
    const urls = extractUrls('See https://en.wikipedia.org/wiki/Mercury_(element) for details.');
    expect(urls).toContain('https://en.wikipedia.org/wiki/Mercury_(element)');
  });

  it('strips unbalanced trailing paren from parenthesized URLs', () => {
    const urls = extractUrls('Here it is: (https://example.com/path).');
    // trailing ") " gets stripped (unbalanced close) then "." stripped; opening "(" is not adjacent to http so not captured
    expect(urls).toContain('https://example.com/path');
    expect(urls.every((u) => !u.endsWith(')'))).toBe(true);
  });

  it('excludes backticks from URL capture', () => {
    const urls = extractUrls('Try `https://example.com/x` for info.');
    expect(urls).toContain('https://example.com/x');
    expect(urls.every((u) => !u.includes('`'))).toBe(true);
  });
});

describe('runDossierPhase', () => {
  function makeCtx(gatewayChat: any, signal?: AbortSignal) {
    return {
      objective: 'photosynthesis',
      orchestratorModelId: 'openrouter:perplexity/sonar-reasoning-pro',
      signal: signal ?? new AbortController().signal,
      gatewayChat
    };
  }

  it('returns dossier + citations on success', async () => {
    const gatewayChat = vi.fn().mockResolvedValue({
      content: 'Photosynthesis is the biochemical process by which plants convert light into chemical energy via chlorophyll and water. See https://en.wikipedia.org/wiki/Photosynthesis for canonical treatment.',
      toolCalls: []
    });
    const out = await runDossierPhase(makeCtx(gatewayChat));
    expect(out.dossier).toBeTruthy();
    expect(out.dossier!.length).toBeGreaterThanOrEqual(20);
    expect(out.citations).toContain('https://en.wikipedia.org/wiki/Photosynthesis');
    expect(out.error).toBeUndefined();
    expect(gatewayChat).toHaveBeenCalledTimes(1);
    const call = gatewayChat.mock.calls[0][0];
    expect(call.model).toBe('openrouter:perplexity/sonar-reasoning-pro');
    expect(call.maxOutputTokens).toBe(4000);
  });

  it('treats short responses as failure', async () => {
    const gatewayChat = vi.fn().mockResolvedValue({ content: 'too short', toolCalls: [] });
    const out = await runDossierPhase(makeCtx(gatewayChat));
    expect(out.dossier).toBeNull();
    expect(out.citations).toEqual([]);
    expect(out.error).toMatch(/too short|empty/i);
  });

  it('passes error through on gateway exception', async () => {
    const gatewayChat = vi.fn().mockRejectedValue(new Error('provider down'));
    const out = await runDossierPhase(makeCtx(gatewayChat));
    expect(out.dossier).toBeNull();
    expect(out.citations).toEqual([]);
    expect(out.error).toMatch(/provider down/i);
  });

  it('system prompt is non-empty and mentions "briefing"', () => {
    expect(DOSSIER_SYSTEM_PROMPT.length).toBeGreaterThan(100);
    expect(DOSSIER_SYSTEM_PROMPT.toLowerCase()).toContain('briefing');
  });
});
