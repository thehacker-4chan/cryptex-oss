import { describe, it, expect, vi } from 'vitest';
import { saveAsTechnique } from '../synthesizer-client';

describe('saveAsTechnique', () => {
  it('posts the request body + Authorization and parses the JSON response', async () => {
    const resp = {
      rowIds: ['r1'],
      analysis: {
        v: 1,
        mode: 'composite',
        why_it_works: 'x',
        detected_axes: {},
        strategy_tags: [],
        confidence: 'high',
      },
      fallback: null,
    };
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(resp), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const out = await saveAsTechnique({ prompt: 'p', name: 'n', decompose: false, jwt: 'j' });
    expect(out.rowIds).toEqual(['r1']);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/prompt-synthesizer'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer j' }),
      }),
    );
  });

  it('throws on non-2xx with status in the message', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 'duplicate_name', message: 'taken' }), { status: 400 }),
    );
    await expect(
      saveAsTechnique({ prompt: 'p', name: 'n', decompose: false, jwt: 'j' }),
    ).rejects.toThrow(/synth 400/);
  });

  it('propagates AbortError', async () => {
    global.fetch = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'));
    const ac = new AbortController();
    ac.abort();
    await expect(
      saveAsTechnique({ prompt: 'p', name: 'n', decompose: false, jwt: 'j', signal: ac.signal }),
    ).rejects.toThrow();
  });
});
