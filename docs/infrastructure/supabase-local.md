# Supabase Local Development

Auth v2 runs against a local Supabase instance for development and CI.

## Prerequisites
- Docker Desktop running
- Node 20
- `@supabase/cli` via `npx supabase ...` (no global install needed)

## Start the local stack
```bash
cd <repo-root>
npx supabase start
```

Boots Postgres + Auth + Storage + Realtime + Edge Function runtime on localhost.
Output prints `API URL`, `anon key`, `service_role key`.

## Apply migrations
Automatic on `supabase start`. Re-apply after editing:
```bash
npx supabase db reset
```

## Run RLS tests
```bash
npx supabase test db
```

Expected: 14/14 pass.

## Wire into the app
Copy API URL and anon key into `app/.env.local`:
```
VITE_AUTH_ENABLED=true
PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start>
```

## Stop
```bash
npx supabase stop
```

## Notes on `tests.*` helpers

The pgtap tests reference `tests.create_supabase_user(...)` and `tests.authenticate_as(...)` — these are auto-provided by Supabase's built-in test harness. If the helpers are missing in your local Supabase version, upgrade the CLI (`npm i -g supabase`) or see the Supabase docs on "database testing".
