-- Phase 3.2: CSP violation telemetry.
-- See docs/2026-05-07-handoff-auth-hardening.md §"Known deferred items" and
-- the auth hardening plan jazzy-gathering-kernighan.md §3.2.
--
-- Receives violation reports forwarded from the browser via the page CSP's
-- `report-uri` directive (currently a 204 stub at /api/csp-report; flip to
-- the `csp-report` Edge Function URL to enable collection — see
-- supabase/functions/csp-report/index.ts).

CREATE TABLE IF NOT EXISTS public.csp_violations (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent   TEXT NULL,
  ip_address   TEXT NULL,
  -- Normalised payload — accepts both legacy {"csp-report": {...}} flat
  -- shape and modern Reporting-API [{type, body}] shape. Edge Function
  -- inserts one row per report (Reporting API can batch). Querying is
  -- uniform via JSONB path expressions on `payload`.
  payload      JSONB NOT NULL
);

COMMENT ON TABLE public.csp_violations IS
  'Browser-side CSP violation reports. Append-only telemetry; never used '
  'in app code paths. Inserts come exclusively from the csp-report Edge '
  'Function running with service-role; RLS denies anon/authenticated '
  'reads to keep raw user-agent + ip info out of the BYOK surface.';

-- Light index for the typical "recent violations on a directive" query.
-- Generated column → BTREE so violations dashboards do not have to
-- jsonb-cast inline.
CREATE INDEX IF NOT EXISTS csp_violations_created_at_idx
  ON public.csp_violations (created_at DESC);

CREATE INDEX IF NOT EXISTS csp_violations_directive_idx
  ON public.csp_violations ((payload ->> 'effective-directive'));

-- RLS: nothing readable by anon / authenticated. The function inserts via
-- service-role which bypasses RLS by design. This keeps user agents +
-- IP addresses out of any BYOK-tier query surface.
ALTER TABLE public.csp_violations ENABLE ROW LEVEL SECURITY;

-- No SELECT policy → no rows visible to anon / authenticated.
-- No INSERT policy → only service_role inserts work (bypasses RLS).
-- Operators wanting dashboard access either use the SQL editor (admin) or
-- add a narrow service-role-backed Edge Function for read-only export.
