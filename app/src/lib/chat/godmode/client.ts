import type { EngineEvent } from './types';

/**
 * runGodmode — async generator over the godmode-engine SSE stream.
 *
 * Uses `fetch + ReadableStream` (not `EventSource`) so we can set the
 * `Authorization: Bearer <jwt>` header and carry cancellability through an
 * `AbortController` signal. Callers consume it with
 * `for await (const ev of runGodmode(...))` and break / abort to stop early.
 *
 * SSE framing: each event is `event: engine\ndata: <json>\n\n`. Chunks from
 * the underlying stream may split anywhere, so we buffer until we see the
 * `\n\n` frame terminator and parse each complete frame's `data:` line.
 */
export async function* runGodmode(args: {
  task: string;
  K: 3 | 6 | 12;
  model: string;
  jwt: string;
  signal?: AbortSignal;
}): AsyncGenerator<EngineEvent> {
  const base = import.meta.env.PUBLIC_SUPABASE_URL;
  const res = await fetch(`${base}/functions/v1/godmode-engine`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.jwt}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ task: args.task, K: args.K, model: args.model }),
    signal: args.signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`godmode ${res.status}: ${detail}`);
  }
  if (!res.body) throw new Error('godmode: no response body');

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += value;
      let idx;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        for (const line of frame.split('\n')) {
          if (line.startsWith('data: ')) {
            try {
              yield JSON.parse(line.slice(6)) as EngineEvent;
            } catch {
              // skip malformed frame
            }
          }
        }
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // reader may already be closed
    }
  }
}
