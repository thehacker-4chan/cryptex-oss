import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runGodmode } from '../client';

function makeSse(events: string[]): Response {
  const body = new ReadableStream({
    start(c) {
      const enc = new TextEncoder();
      for (const e of events) c.enqueue(enc.encode(e));
      c.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

beforeEach(() => {
  vi.stubEnv('PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
});

describe('runGodmode', () => {
  it('parses a clean SSE sequence', async () => {
    const events = [
      'event: engine\ndata: {"v":1,"type":"plan","dnas":[]}\n\n',
      'event: engine\ndata: {"v":1,"type":"done"}\n\n',
    ];
    global.fetch = vi.fn().mockResolvedValue(makeSse(events));
    const out: unknown[] = [];
    for await (const ev of runGodmode({ task: 't', K: 3, model: 'm', jwt: 'x' }))
      out.push(ev);
    expect(out.length).toBe(2);
    expect((out[0] as { type: string }).type).toBe('plan');
  });

  it('aborts via AbortController', async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new DOMException('aborted', 'AbortError'));
    const ac = new AbortController();
    ac.abort();
    const gen = runGodmode({
      task: 't',
      K: 3,
      model: 'm',
      jwt: 'x',
      signal: ac.signal,
    });
    await expect(gen.next()).rejects.toThrow();
  });

  it('throws on non-2xx response', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response('nope', { status: 401 }));
    const gen = runGodmode({ task: 't', K: 3, model: 'm', jwt: 'x' });
    await expect(gen.next()).rejects.toThrow(/godmode 401/);
  });

  it('handles split events across chunks', async () => {
    // Split the SSE frame across two chunks to exercise the buffering logic
    const events = [
      'event: engine\ndata: {"v":1,"type',
      '":"plan","dnas":[]}\n\n',
      'event: engine\ndata: {"v":1,"type":"done"}\n\n',
    ];
    global.fetch = vi.fn().mockResolvedValue(makeSse(events));
    const out: unknown[] = [];
    for await (const ev of runGodmode({ task: 't', K: 3, model: 'm', jwt: 'x' }))
      out.push(ev);
    expect(out.length).toBe(2);
  });
});
