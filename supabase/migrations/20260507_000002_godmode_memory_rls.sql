-- Godmode-engine memory tables — RLS lockdown.
-- See ~/.claude/plans/jazzy-gathering-kernighan.md "Production data-residency
-- + RLS audit (2026-05-07)" for the audit that prompted this migration.
--
-- Background: 20260422_000001_godmode_memory.sql created two tables —
-- `attempt_memory_private` (per-user, includes `task_text` = the user's
-- prompt) and `attempt_memory_global` (cross-user, no PII by design) —
-- but never enabled RLS. Any signed-in browser session can therefore do
--   `await supabase.from('attempt_memory_private').select('*')`
-- and read every other user's private jailbreak attempts. Closing this
-- gap is a CRITICAL prerequisite to onboarding any real users.
--
-- The godmode-engine Edge Function writer (supabase/functions/godmode-engine/
-- memory.ts) connects via a direct Postgres client, NOT supabase-js, so it
-- bypasses RLS by design. RLS therefore only constrains browser-side reads,
-- which is exactly what we want.

-- ---------------------------------------------------------------------------
-- attempt_memory_private — owner-scoped reads, no client-side writes.
-- ---------------------------------------------------------------------------
ALTER TABLE public.attempt_memory_private ENABLE ROW LEVEL SECURITY;

-- Users can read only their own attempt history.
CREATE POLICY attempt_memory_private_select
  ON public.attempt_memory_private
  FOR SELECT
  USING (user_id = auth.uid());

-- No INSERT / UPDATE / DELETE policies.
--   · INSERT: only the godmode-engine Edge Function writes here (via direct
--     Postgres connection that bypasses RLS). Browser-side INSERT is denied.
--   · UPDATE / DELETE: rows are append-only telemetry. The 90-day TTL is
--     enforced by `expires_at` + a separate cleanup job, not user action.

-- ---------------------------------------------------------------------------
-- attempt_memory_global — public-read, no client-side writes.
-- ---------------------------------------------------------------------------
ALTER TABLE public.attempt_memory_global ENABLE ROW LEVEL SECURITY;

-- Reads are intentionally global — this ring exists so every user benefits
-- from cross-user learnings about which DNA tuples succeed against which
-- model families. No PII, no `user_id`, no `task_text` (defense-in-depth
-- per the original migration).
CREATE POLICY attempt_memory_global_select
  ON public.attempt_memory_global
  FOR SELECT
  USING (true);

-- No INSERT / UPDATE / DELETE policies.
--   · Same rationale as above — only the godmode-engine Edge Function
--     writes via direct Postgres connection. Without RLS the table was
--     vulnerable to a signed-in user crafting an `insert(...)` call to
--     poison the global learnings ring.
