import { corsHeaders } from '../_shared/cors.ts';
import { requirePaid } from '../_shared/auth.ts';
import { rateLimit } from '../_shared/ratelimit.ts';
import { detectShibboleths } from './shibboleth.ts';
import { makeAnalyzerClient } from './_shared/analyzer-client.ts';
import { makeWriter } from './writer.ts';
import { analyze } from './analyzer.ts';
import { run } from './synthesizer-core.ts';

function pickAnthropicKey(): string {
  const pool: string[] = [];
  for (let i = 1; i <= 9; i++) {
    const v = Deno.env.get(`ANTHROPIC_API_KEY_${i}`);
    if (v) pool.push(v);
  }
  if (pool.length === 0) {
    const fb = Deno.env.get('ANTHROPIC_API_KEY');
    if (fb) return fb;
    throw new Error('no_provider_key');
  }
  return pool[Date.now() % pool.length];
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: corsHeaders });

  const u = await requirePaid(req);
  if (u instanceof Response) return u;

  if (!rateLimit(`synth:${u.id}`, 10, 60_000)) {
    return new Response('Too many requests', { status: 429, headers: corsHeaders });
  }

  // Body size guard (prompts up to 16KB + envelope overhead).
  const cl = Number(req.headers.get('content-length') ?? 0);
  if (cl > 32_000) return new Response('payload too large', { status: 413, headers: corsHeaders });

  let body: unknown;
  try { body = await req.json(); }
  catch { return json(400, { code: 'invalid_json', message: 'invalid JSON body' }); }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json(400, { code: 'invalid_body', message: 'body must be an object' });
  }
  const b = body as { prompt?: unknown; name?: unknown; decompose?: unknown };
  if (typeof b.prompt !== 'string' || b.prompt.length === 0 || b.prompt.length > 16_000) {
    return json(400, { code: 'invalid_body', message: 'prompt must be 1..16000 chars' });
  }
  if (typeof b.name !== 'string' || b.name.length === 0 || b.name.length > 128) {
    return json(400, { code: 'invalid_body', message: 'name must be 1..128 chars' });
  }
  const decompose = b.decompose === true;

  let apiKey: string;
  try { apiKey = pickAnthropicKey(); }
  catch { return json(503, { code: 'misconfigured', message: 'no provider key configured' }); }

  const dbUrl = Deno.env.get('SUPABASE_DB_URL');
  if (!dbUrl) return json(503, { code: 'misconfigured', message: 'SUPABASE_DB_URL unset' });

  const analyzerClient = makeAnalyzerClient(apiKey);
  let writer: Awaited<ReturnType<typeof makeWriter>> | null = null;
  try {
    writer = await makeWriter(dbUrl);
    const result = await run({
      prompt: b.prompt,
      name: b.name,
      decompose,
      userId: u.id,
      analyze: (aArgs) => analyze(analyzerClient, aArgs),
      writer,
      detectShibboleths,
      signal: req.signal,
    });
    return json(200, result);
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    if (msg === 'duplicate_name') {
      return json(400, { code: 'duplicate_name', message: 'a technique with this name already exists' });
    }
    if (msg.startsWith('anthropic_')) {
      return json(504, { code: 'analyzer_unavailable', message: msg.slice(0, 200) });
    }
    console.error('[prompt-synthesizer] crash', e);
    return json(500, { code: 'synth_crash', message: msg.slice(0, 200) });
  } finally {
    try { await writer?.close(); } catch (e) { console.error('[prompt-synthesizer] writer close failed', e); }
  }
});
