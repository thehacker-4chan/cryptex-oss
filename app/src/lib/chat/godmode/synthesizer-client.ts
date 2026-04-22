import type { SynthesizeResult } from './types';

/**
 * saveAsTechnique — browser client for the `prompt-synthesizer` edge function.
 *
 * Posts the user's raw prompt + desired technique name (and a `decompose`
 * flag) to Supabase, carrying the caller's JWT via `Authorization: Bearer`.
 * Resolves with the server's `SynthesizeResult` on 2xx; throws
 * `Error("synth <status>: <body-excerpt>")` on non-2xx so callers can
 * branch on the status prefix. `AbortSignal` is threaded through to
 * `fetch` so in-flight requests can be cancelled by the caller.
 */
export async function saveAsTechnique(args: {
  prompt: string;
  name: string;
  decompose: boolean;
  jwt: string;
  signal?: AbortSignal;
}): Promise<SynthesizeResult> {
  const base = import.meta.env.PUBLIC_SUPABASE_URL as string;
  const res = await fetch(`${base}/functions/v1/prompt-synthesizer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.jwt}`,
    },
    body: JSON.stringify({
      prompt: args.prompt,
      name: args.name,
      decompose: args.decompose,
    }),
    signal: args.signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`synth ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as SynthesizeResult;
}
