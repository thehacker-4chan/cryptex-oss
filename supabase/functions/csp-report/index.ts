/**
 * CSP violation report receiver.
 *
 * Browsers POST violation reports to the URL given in the page CSP's
 * `report-uri` directive. This function accepts both legacy
 * `application/csp-report` bodies (CSP 2) and modern `application/json` /
 * `application/reports+json` bodies (Reporting API), normalises them, and
 * inserts a row into `public.csp_violations` for later inspection.
 *
 * Wiring:
 *   1. Apply the SQL migration that creates `public.csp_violations` (RLS
 *      enabled; only the service_role can read/write).
 *   2. Deploy this function:
 *        supabase functions deploy csp-report --no-verify-jwt
 *      The `--no-verify-jwt` is REQUIRED because browsers don't send auth
 *      headers on CSP report POSTs.
 *   3. Flip nginx.conf's `report-uri` directive to the function URL:
 *        report-uri https://<project-ref>.supabase.co/functions/v1/csp-report;
 *      Until then, nginx serves a 204 stub for /api/csp-report and reports
 *      go nowhere.
 *
 * Anti-abuse:
 *   - Body capped at 16 KiB (drop oversized).
 *   - Source IP rate-limit at 60 req / minute / IP. Drops past that.
 *   - Inserts run with the function's service-role key; the table itself
 *     has RLS denying anon/authenticated reads.
 *
 * Schema mismatch tolerance:
 *   The CSP-3 spec moved field names around. We normalise both the legacy
 *   `csp-report` flat shape AND the Reporting-API `[{type, body}]` shape
 *   into a single `payload` JSONB column. Querying is uniform across vintages.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

// CSP report posts are unauthenticated by spec — the only origin gate is
// the report-uri itself. We still set permissive CORS in case the operator
// flips report-uri to an absolute URL on a different origin.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type'
};

const MAX_BODY_BYTES = 16 * 1024;

// In-process IP rate limit. Edge Function instances are short-lived but
// usually warm for a few minutes — enough to throttle a misbehaving page.
const _hits = new Map<string, number[]>();
function ipAllowed(ip: string, max = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (_hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    _hits.set(ip, arr);
    return false;
  }
  arr.push(now);
  _hits.set(ip, arr);
  return true;
}

interface NormalizedReport {
  ua: string | null;
  ip: string | null;
  payload: unknown;
}

function normalize(body: unknown, ua: string | null, ip: string | null): NormalizedReport[] {
  // Legacy flat shape: { "csp-report": { ... } }
  if (body && typeof body === 'object' && 'csp-report' in (body as Record<string, unknown>)) {
    return [{ ua, ip, payload: (body as Record<string, unknown>)['csp-report'] }];
  }
  // Reporting-API shape: [ { type: "csp-violation", body: {...} }, ... ]
  if (Array.isArray(body)) {
    return body.map((entry) => ({ ua, ip, payload: entry }));
  }
  // Anything else — store raw
  return [{ ua, ip, payload: body }];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: corsHeaders });
  }

  // Per-IP throttle. Drop early before parsing/db work.
  const ip = req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? '0.0.0.0';
  if (!ipAllowed(ip)) {
    return new Response('rate limited', { status: 429, headers: corsHeaders });
  }

  // Size guard
  const lenHdr = req.headers.get('content-length');
  if (lenHdr && Number(lenHdr) > MAX_BODY_BYTES) {
    return new Response('payload too large', { status: 413, headers: corsHeaders });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    // Some browsers send malformed JSON for CSP reports (older Chromium).
    // Treat as silent drop — alerting on those would be noisy.
    return new Response('', { status: 204, headers: corsHeaders });
  }

  const ua = req.headers.get('user-agent');
  const reports = normalize(body, ua, ip);
  if (reports.length === 0) {
    return new Response('', { status: 204, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    // Misconfigured env. Do not 500 to the browser — it's a deploy issue,
    // not a client issue. Fail the insert silently and return 204 so the
    // browser doesn't retry-storm.
    console.error('[csp-report] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
    return new Response('', { status: 204, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  });

  const rows = reports.map((r) => ({
    user_agent: r.ua,
    ip_address: r.ip,
    payload: r.payload
  }));

  const { error } = await supabase.from('csp_violations').insert(rows);
  if (error) {
    // Same silent-drop philosophy.
    console.error('[csp-report] insert failed:', error.message);
  }

  // Spec recommends 200 or 204 with empty body.
  return new Response('', { status: 204, headers: corsHeaders });
});
