# Tier 3 Roadmap — Handoff (2026-05-07)

> **Read this first if you're picking up Cryptex work after a session compact.**
> The full execution-ready plan lives in `~/.claude/plans/jazzy-gathering-kernighan.md`
> under the "Tier 3 — Effectiveness + Persistence + UX Roadmap" section. This doc
> is the short field-orientation guide.

## State at handoff

| Property | Value |
|---|---|
| Last commit | `2180ea7` — slash-command composition fix + migrate-keys bug fix + vault UI re-skin + /guide overview |
| Origin | `origin/master` is up-to-date |
| Worktree | `.claude/worktrees/nice-thompson-d2896d` (or main checkout) |
| Test status | Vitest 614/614 · svelte-check 0 errors · build green |
| Deploy | Dokploy auto-redeploys on push to master |

## What's already done (don't re-do)

- **Auth hardening** — PKCE flow, OAuth-safe verifyCurrentPassword, email masking, sign-out, rate-limits (Phases 1A + 2.1 + 2.2).
- **Phase 3 hardening** — HSTS at max-age=300, CSP no `'unsafe-inline'` (sha256 hashes auto-substituted at build time), CSP report-uri stub, sessionStorage opt-in for BYOK, SRI build args for AdSense/GA.
- **Critical RLS fix** — `attempt_memory_private` and `attempt_memory_global` both have RLS enabled (idempotent migration `20260507_000002_godmode_memory_rls.sql` — apply via Supabase SQL editor when convenient).
- **Encrypted BYOK vault** — signed-in users' provider API keys persist as ciphertext in `byok_keys` (PBKDF2 600k + AES-GCM, single salt per vault, per-row IV); localStorage holds metadata-only mirror after vault confirms.
- **Migrate-keys bug fix** — `persist()` now acts as a write-ahead log; `purgeApiKeyFromMirror()` only strips after a successful vault write. Previously stripped unconditionally → migration prompt found nothing.
- **Vault UI re-skin** — replaced amber-warning chrome with neutral/positive treatment; removed all "Supabase" mentions (de-branded — generic "encrypted vault" service).
- **Slash-command composition** — `buildMutatorSystem()` now wraps the per-technique scaffold in an outer `<adversarial-prompting-task>` that reframes the goal from "rewrite text" to "compose a target-facing user message that elicits the objective using this technique's style". Affects all ~36 mutators + composites.
- **Mutation badge** — `SlashCommandBlock.svelte` now shows an always-visible primary-color "Mutated via /xxx" pill outside the collapsible details.
- **/guide overview** — new markdown under `app/src/lib/guide/overview.md` lands first under Introduction in the sidebar tree.
- **Auth UX gates** — duplicate-signup detection, OAuth-collision graceful messaging, login error hint for OAuth-only users, seamless `/chat` sign-in modal overlay (no URL ping-pong).

## What's deferred (Tier 3 — pick one to start)

### Track A — Chain orchestrator effectiveness *(highest user-visible impact)*

**Problem:** The chain can't elicit even basic artefacts. It cycles through 12 strategies regardless of refusal patterns, never adapts mid-chain, and the dossier is descriptive (terminology) not prescriptive (target-specific bypasses).

**Five fixes (full prompt + code in plan file Track A):**
1. Adaptive strategy switching — leap forward in rotation when ≥2 prior turns refused (`orchestrator.ts`)
2. Refusal-feedback instruction in `refineTurn` — orchestrator parses `[PIVOT_HINT: ...]` from rewrites (`refine-turn.ts`)
3. Target-aware dossier — add bypass-framing recommendations + filter-evading synonyms (`dossier.ts`)
4. Plateau-detection forced pivot — exit step-loop early when objective progress flatlines (`orchestrator.ts`)
5. Authority-laddered strategy pool — group strategies into low/mid/high friction tiers (`orchestrator-strategies.ts`)

**Mandatory before "done":** empirical eval against 5 objectives × 5 targets (corpus + targets enumerated in plan). 12+ cells must improve ≥4 progress points without regressing baseline-success cases.

### Track B — Tab persistence *(cross-cutting, ~16 tools)*

**Problem:** Switching tabs from Probe Lab (or any red-team tool) wipes the in-flight operation. Transform tools already use a working module-singleton pattern; red-team tools don't.

**Solution:** new `useToolState<T>(toolId, defaultValue, opts)` helper in `app/src/lib/stores/tool-state.svelte.ts` (full implementation in plan file). Three modes:
- `persist: 'memory'` — module-singleton, survives tab switches (current Transform pattern)
- `persist: 'dexie', chatId` — survives reloads, persists to `chat.settings[toolId]`

**Sprint plan:**
- Sprint 1 (low-risk, ~30 LOC each): adv-suffix, glitch-tokens, strongreject, cross-model-diff, markdown-exfil, ocr-injection, pdf-injection, watermark
- Sprint 2 (medium-risk, ~50–80 LOC): probe-lab, harmbench, jbb, replayer, tool-result-lab
- Sprint 3 (higher-risk, hierarchical state): fingerprinter, aggregation, indirect-injection

### Track C — Selected-text → encode/transform UI *(new primitive)*

**Problem:** No way to select text in the composer and apply a transform / encoding.

**Solution:** new floating `SelectionToolbar.svelte` component near the composer textarea selection (~140 LOC). Three actions: Encode → list applicable transforms via `.detector(text)`; Decode → universal-decoder ranking; Translate (AI) → existing translate path. Mobile fallback: toolbar renders inline above textarea.

### Track D — Reasoning panel *(STATUS: already done — confirm only)*

**Audit finding:** the reasoning pipeline is fully implemented. Gateway streams `reasoning-delta`, ChatWorkspace accumulates, ReasoningBlock renders in a `<details>` (open by default during streaming, copy button, animated "Thinking…" dots).

**Why user thought it was missing:** likely tested with a non-thinking model (no reasoning surfaced from the provider). Confirm by switching to Claude with `reasoning_effort: high` and verifying the `<details>` block appears.

**Optional polish:** small "Thinking" badge in the bubble header (~10 LOC).

### Track E — Other UI polish *(per-surface, last)*

Six small items in the plan file. Defer until Tracks A/B land.

## Recommended sequence

1. **Track A** — biggest user-visible win. Build the empirical-eval scaffold first (`scripts/chain-eval/`) so you can measure the fix.
2. **Track B Sprint 1** — low-risk warmup, gives the user immediate "tabs persist" feedback.
3. **Track B Sprint 2** — probe-lab / harmbench persistence.
4. **Track C** — new feature, low risk, reuses transforms registry.
5. **Track D** — quick confirmation + optional badge.
6. **Track E** — polish pass.

## How to start

```bash
cd C:\Users\m4xx\Downloads\cryptex
git pull origin master                       # confirm head is 2180ea7 or later
cd app && npm ci && npx vitest run            # confirm 614/614
```

Then open the plan file:

```
C:\Users\m4xx\.claude\plans\jazzy-gathering-kernighan.md
```

Search for "Tier 3 — Effectiveness + Persistence + UX Roadmap" and pick a track.

## Files-to-modify summary (across all tracks)

| Track | Files |
|---|---|
| A | `app/src/lib/chat/chain/orchestrator.ts`, `refine-turn.ts`, `dossier.ts`, `orchestrator-strategies.ts`, `app/src/lib/components/chat/workspace/...` (timeline badges) |
| B | NEW `app/src/lib/stores/tool-state.svelte.ts`, ~16 files under `app/src/routes/redteam/` |
| C | NEW `app/src/lib/components/chat/composer/SelectionToolbar.svelte`, NEW helper in `app/src/lib/transformers/registry.ts` (`applicableTransforms`) |
| D | Optional: `app/src/lib/components/chat/workspace/MessageBubble.svelte` (badge) |
| E | Per-surface, see plan file Track E table |

## Hard constraints (still apply)

- Deploy contract is HARD-LOCKED: `Dockerfile`, `docker-compose.yml`, `nginx.conf`, `app/vite.config.ts envPrefix`, `app/svelte.config.js` adapter, `.github/workflows/*.yml`. Don't touch without explicit approval.
- BYOK key vault encryption is solid — don't refactor.
- Dexie schema changes need a version bump + migration (currently v4).
- `MUTATORS` registry edits MUST keep the prompt-style + prompt-length tests green (CAPITAL directives, no banned softeners, ≥250 chars).

## Diagnostic commands

```bash
# Test status
cd app && npx vitest run

# Type-check
cd app && npm run check

# Build (also computes CSP hashes)
cd app && npm run build

# Probe Supabase
curl -sS "https://zoqzyczfmunxmztcvjcy.supabase.co/auth/v1/health"

# Inspect last 5 commits
git log --oneline -5
```
