# Chain v3 Engine Follow-ups Design

**Status:** Approved, ready for implementation plan.

**Trigger:** The Chain v3 final reviewer flagged three tactical issues that all live in the chain engine surface but are independent: (a) per-event Dexie writes spam IndexedDB during streaming, (b) provider stream errors burn the entire turn budget producing blank turns, (c) dossier phase re-runs from scratch on every Chain run with the same topic. Each is a small additive fix with measurable real-world payoff.

## Goal

Ship three independent tactical fixes in one design pass: rAF-debounced persistence, consecutive-stream-error circuit breaker, and localStorage-backed dossier caching. None changes architecture; all are isolated additive layers on the existing Chain v3 engine.

## Non-goals

- New Chain features.
- Architectural refactors.
- Changes to engine state-machine flow beyond the circuit-breaker abort path.
- Dexie-backed dossier cache (deferred — localStorage is sufficient for v1).
- Per-chat dossier cache scoping (deferred — global per-browser is fine).
- A "Re-research" button to force-refresh cached dossiers (deferred).

---

## Architecture

The three fixes live in three different files and have no code dependencies on each other:

```
Fix 1: AttackChainTab.svelte          — UI-side persistence layer
Fix 2: orchestrator.ts                — engine-side error tracking
Fix 3: dossier.ts + dossier-cache.ts  — orchestrator-side caching
```

Each fix is independently testable and shippable. The plan below sequences them but they could ship in any order.

---

## Section 1 — rAF-debounced persistence (Fix 1)

### Problem

`AttackChainTab.svelte`'s `for await (const ev of runAttackSession(ctx))` loop calls `void repo.updateAttackSession(...)` after EVERY OrchEvent, including hundreds of `target_reply_delta` events per turn. Each call is a structured-clone + IDB put. ~1800 puts per typical 9-turn run with target replies of ~200 tokens each. The puts run off the main thread but cause visible UI jank during streaming because the `repo.updateAttackSession` writes do `JSON.parse(JSON.stringify(...))` synchronously to defeat the structured-clone proxy issue.

### Fix

Two-tier persistence:
- **Coalesced (rAF-debounced)** for `target_reply_delta` events. A single `requestAnimationFrame` callback writes the latest state every ~16ms regardless of how many deltas fired since the last frame.
- **Synchronous** for boundary events (`orchestrator_turn_committed`, `target_turn_committed`, `dossier_completed`, `strategy_pivoted`, `finished`). These trigger an immediate `await repo.updateAttackSession(...)` so a refresh mid-run shows the right state.

### Implementation

In `AttackChainTab.svelte`, add at the top of the `run()` async function (or as a closure local):

```ts
let pendingWrite = false;
function schedulePersist() {
  if (pendingWrite) return;
  pendingWrite = true;
  requestAnimationFrame(() => {
    pendingWrite = false;
    void repo.updateAttackSession(session.id, {
      turns: liveTurns,
      strategyLog: liveLog,
      dossier: liveDossier,
      dossierCitations: liveCitations,
      finalOutcome,
      finalConfidence,
      finalSummary,
      finalAnswer,
      finalAnswerConfidence,
      finalAnswerRationale
    });
  });
}

async function persistNow() {
  await repo.updateAttackSession(session.id, {
    turns: liveTurns,
    strategyLog: liveLog,
    dossier: liveDossier,
    dossierCitations: liveCitations,
    finalOutcome,
    finalConfidence,
    finalSummary,
    finalAnswer,
    finalAnswerConfidence,
    finalAnswerRationale
  });
}
```

In the `for await` loop, replace the existing `void repo.updateAttackSession(...)` call with conditional dispatch:

```ts
for await (const ev of runAttackSession(ctx)) {
  applyEvent(ev);
  if (
    ev.type === 'orchestrator_turn_committed' ||
    ev.type === 'target_turn_committed' ||
    ev.type === 'dossier_completed' ||
    ev.type === 'strategy_pivoted' ||
    ev.type === 'finished'
  ) {
    await persistNow();
  } else {
    schedulePersist();
  }
}
```

The `finally` block already does a final synchronous persist — keep it; that's the safety net for any rAF write still pending when the loop exits.

### Why this works

- 60 fps cap means at most one IDB write per 16ms regardless of delta event rate.
- Boundary writes are forced synchronous so reload during the boundary state shows correct data.
- The rAF callback closes over current `$state` references, so it always writes the latest values.

---

## Section 2 — Consecutive-stream-error circuit breaker (Fix 2)

### Problem

When `streamChat` errors mid-turn (provider down, 429, network), the engine's existing catch block emits an `error` event then continues. Next iteration target turn is empty, scoring fails, the rotation queue burns through every strategy producing blank turns. User sees a "completed" run with all-empty target replies and no useful output.

### Fix

Track consecutive stream errors. After 3 in a row, terminate the run early with `outcome: 'abandoned'` and a circuit-breaker-specific summary.

### Implementation

In `app/src/lib/chat/chain/orchestrator.ts`, add a constant near the existing `EARLY_STOP_PROGRESS`:

```ts
const MAX_CONSECUTIVE_STREAM_ERRORS = 3;
```

Inside `runAttackSession`'s body (alongside `transcript`, `judgeClient`, `runExtraction`), declare a counter:

```ts
let consecutiveStreamErrors = 0;
```

Inside the per-turn block, AFTER the `targetText`/`targetError` capture and BEFORE the scoring step, add:

```ts
if (targetError) {
  consecutiveStreamErrors++;
  if (consecutiveStreamErrors >= MAX_CONSECUTIVE_STREAM_ERRORS) {
    const ext = await runExtraction();
    yield {
      type: 'finished',
      outcome: 'abandoned',
      confidence: 0,
      summary: `Aborted: ${MAX_CONSECUTIVE_STREAM_ERRORS} consecutive provider stream errors. Target may be down or rate-limited.`,
      ...ext
    };
    return;
  }
} else if (targetText) {
  consecutiveStreamErrors = 0;
}
```

Order matters: this check fires BEFORE the scoring step so a circuit-broken run doesn't waste a judge call on an empty turn.

### Test

New `Scenario L` in `orchestrator.test.ts`: mock `streamChat` to throw on every call, run with `maxAttempts: 9`, assert that exactly 3 turns ran (not 9) and the `finished` event's `summary` matches `/3 consecutive provider stream errors/`.

---

## Section 3 — Dossier caching (Fix 3)

### Problem

Every Chain run with a browsing-capable orchestrator runs `runDossierPhase` from scratch. The same topic produces the same ~2500-token dossier call. Users running multiple Chain attacks on the same objective (which is common when iterating on attacks) pay for the research three or more times.

### Fix

localStorage cache keyed by FNV-1a hash of normalized objective. TTL 7 days. Verify objective on read to defeat hash collisions.

### Implementation

New file `app/src/lib/chat/chain/dossier-cache.ts`:

```ts
/**
 * localStorage-backed cache for runDossierPhase results. Keyed by FNV-1a hash
 * of (lowercase + trimmed) objective. Entry value carries the original
 * objective so on read we can verify exact match (defeats hash collisions —
 * 32-bit FNV has ~1/65K collision rate).
 *
 * TTL 7 days. On parse error or quota exceeded, silently no-op so the
 * caller falls back to a fresh judge call.
 */

export interface CachedDossier {
  objective: string;       // exact normalized objective for collision verification
  dossier: string;
  citations: string[];
  cachedAt: number;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const KEY_PREFIX = 'cryptex.dossier.';

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function hashObjective(normalized: string): string {
  // FNV-1a 32-bit, base36
  let h = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    h ^= normalized.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function getCachedDossier(objective: string): { dossier: string; citations: string[] } | null {
  if (typeof localStorage === 'undefined') return null;
  const norm = normalize(objective);
  const key = KEY_PREFIX + hashObjective(norm);
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedDossier;
    // TTL expiry
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    // Hash collision guard — exact match required
    if (parsed.objective !== norm) return null;
    return { dossier: parsed.dossier, citations: parsed.citations };
  } catch {
    return null;
  }
}

export function setCachedDossier(objective: string, dossier: string, citations: string[]): void {
  if (typeof localStorage === 'undefined') return;
  const norm = normalize(objective);
  const key = KEY_PREFIX + hashObjective(norm);
  const value: CachedDossier = {
    objective: norm,
    dossier,
    citations,
    cachedAt: Date.now()
  };
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded — silently skip; next run just re-runs dossier
  }
}
```

Wire into `app/src/lib/chat/chain/dossier.ts` `runDossierPhase`. At the top of the function:

```ts
const cached = getCachedDossier(ctx.objective);
if (cached) {
  return { dossier: cached.dossier, citations: cached.citations };
}
```

On successful fresh fetch (just before the `return { dossier: content, citations: extractUrls(content) }`):

```ts
const citations = extractUrls(content);
setCachedDossier(ctx.objective, content, citations);
return { dossier: content, citations };
```

### Tests

New file `app/src/lib/chat/chain/__tests__/dossier-cache.test.ts`:
- `setCachedDossier` then `getCachedDossier` returns the same value
- Stale entry (cachedAt > 7 days ago) returns null + clears the entry
- Hash collision (same hash, different objective) returns null
- Returns null gracefully when localStorage isn't available (jsdom test setup must mock this)
- Quota-exceeded `setItem` doesn't throw

Plus 1 new test in `dossier.test.ts`:
- When cache is populated, `runDossierPhase` returns cached result without calling `gatewayChat`.

---

## File surface

| Fix | Modified | Created | Test additions |
|---|---|---|---|
| 1 | `app/src/lib/components/chat/attack-chain/AttackChainTab.svelte` | — | None (perf change, no new behavior) |
| 2 | `app/src/lib/chat/chain/orchestrator.ts` + `app/src/lib/chat/chain/__tests__/orchestrator.test.ts` | — | Scenario L (3 consecutive stream errors → abandoned) |
| 3 | `app/src/lib/chat/chain/dossier.ts` + `app/src/lib/chat/chain/__tests__/dossier.test.ts` | `app/src/lib/chat/chain/dossier-cache.ts` + `__tests__/dossier-cache.test.ts` | 5 cache cases + 1 integration |

Total: 4 files modified, 2 created, 6 new test cases. Three commits (one per fix). ~1 day of work.

---

## Risks

1. **Debounce loses the very last delta on abrupt abort.** If user clicks Stop mid-stream, the rAF write might not flush before the engine yields `finished: abandoned`. Mitigation: the `finished` event triggers an immediate `await persistNow()`, AND the `finally` block already does a final synchronous persist. The lost-delta window is only the 16ms between the last rAF schedule and the abort — invisible to user.
2. **Hash collisions in dossier cache.** 32-bit FNV-1a has ~1/65K collision probability. Mitigation: cache value carries the exact normalized objective; the read path verifies match before returning. A collision returns null (cache miss) instead of wrong data.
3. **Circuit breaker fires on transient errors.** Three consecutive stream errors might be one TLS handshake hiccup + network blip + recovery. Mitigation: 3 is a deliberate threshold — single retries are noise, three consecutive errors signal a real outage. User can re-run after fixing their provider config.
4. **Cache stale dossier when topic vocabulary changes.** Dossier from 8 days ago might use outdated terminology. Mitigation: 7-day TTL forces a refresh weekly. Acceptable trade-off; topic vocabulary changes slowly.

---

## Scope coverage

| Spec section | Implementation |
|---|---|
| Section 1 — rAF-debounced persistence | Fix 1 in AttackChainTab |
| Section 2 — Circuit breaker | Fix 2 in orchestrator |
| Section 3 — Dossier caching | Fix 3 in dossier + new dossier-cache module |
| Test plan | Per-fix tests above |
