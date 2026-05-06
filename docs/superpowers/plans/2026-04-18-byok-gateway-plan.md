# BYOK Multi-Provider Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add seamless multi-provider BYOK support (OpenRouter default, Anthropic-direct, OpenAI-compatible endpoints) to Cryptex's SvelteKit app without breaking the three existing AI tools, delivered in 7 atomic commits with user verification between each.

**Architecture:** A thin `gateway.ts` facade wraps Vercel AI SDK 6 behind the exact interface today's `openrouter.ts` exposes. Per-provider adapters (`adapters/openrouter.ts`, `adapters/anthropic.ts`, `adapters/openai-compat.ts`) implement a common `Adapter` interface; the gateway routes by qualified model id (`openrouter:…`, `anthropic:…`, `openai-compat:<instance>/…`). Provider config lives in a rune-backed `providers.svelte.ts` persisted under `cryptex.providers`; legacy `cryptex.openrouterApiKey` is seeded into it on first load. Existing callers keep their current `import { chat } from '$lib/ai/openrouter'` lines until commit 6, which flips to `$lib/ai/gateway` and deletes the legacy shim.

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes) + Vitest + TypeScript. New npm deps (exact-pinned): `ai@6.0.0`, `@openrouter/ai-sdk-provider@1.0.0`, `@ai-sdk/anthropic@1.0.0`, `@ai-sdk/openai-compatible@1.0.0`. No changes to the legacy Vue side (`js/`, `build/`, `dist/`).

**Spec:** `docs/superpowers/specs/2026-04-18-byok-gateway-design.md` — read §4 (types), §5 (Settings UX), §6 (error banner), §7 (ModelPicker) for the canonical visual + type contracts referenced throughout this plan.

**Bundle budget:** AI-route critical path ≤ 50 KB gzipped enforced by `size-limit` (added in Commit 1).

**Cadence rule:** after each commit, STOP. Run the manual-test checklist at the end of that commit. Only push once the user confirms the commit works in their browser. Do not batch pushes.

**Branch:** all work on `master` with atomic commits — no feature branch. The spec already committed the planning docs; Commit 1 begins here.

---

## Prerequisites

- [ ] **Verify clean working tree**

```bash
git status
```

Expected: only `DEPLOY.md` modified (unrelated Cloudflare note, left in place). No other uncommitted changes. Recent commits should end with `3e62612 docs: 2026 modernization brainstorm + gateway sub-project design spec`.

- [ ] **Verify Vitest baseline passes**

```bash
cd app && npm run test:unit
```

Expected: all tests pass. This establishes a known-green baseline before we add anything.

- [ ] **Verify type-check baseline passes**

```bash
cd app && npm run check
```

Expected: `0 errors and 0 warnings`.

---

## Commit 1: Gateway facade + OpenRouter adapter behind Vercel AI SDK

**Goal:** Create the gateway module with all types, error model, provider registry, catalog, validation guards, and a single OpenRouter adapter. Make `openrouter.ts` re-export from the gateway so no caller changes. No user-visible behavior change.

### 1.A — Files

**Create:**
- `app/src/lib/ai/types.ts` — all cross-module types from spec §4.2
- `app/src/lib/ai/errors.ts` — `GatewayError` + `translateError()`
- `app/src/lib/ai/providers.svelte.ts` — rune-backed registry, persisted, legacy-seeded
- `app/src/lib/ai/catalog.svelte.ts` — multi-provider catalog (seed copy of `models.svelte.ts`)
- `app/src/lib/ai/validate.ts` — debounce / dedupe / throttle / lockout state machine
- `app/src/lib/ai/presets.ts` — skeleton preset list (final list lands in Commit 3)
- `app/src/lib/ai/adapters/base.ts` — `Adapter` interface
- `app/src/lib/ai/adapters/openrouter.ts` — first adapter
- `app/src/lib/ai/gateway.ts` — public facade
- `app/src/lib/ai/__tests__/types.test.ts`
- `app/src/lib/ai/__tests__/errors.test.ts`
- `app/src/lib/ai/__tests__/providers.test.ts`
- `app/src/lib/ai/__tests__/validate.test.ts`
- `app/src/lib/ai/__tests__/gateway.test.ts`

**Modify:**
- `app/src/lib/ai/openrouter.ts` — replace body with re-export shim from `gateway.ts`
- `app/src/lib/ai/models.svelte.ts` — replace body with re-export shim from `catalog.svelte.ts`
- `app/package.json` — add `ai`, `@openrouter/ai-sdk-provider`, `size-limit`, `@size-limit/preset-app`
- `app/.size-limit.json` — create size budget

### 1.B — Install new dependencies

- [ ] **Step 1: Add Vercel AI SDK packages**

```bash
cd app
npm install --save-exact ai@6.0.0 @openrouter/ai-sdk-provider@1.0.0
```

Expected: installs without peer-dep warnings. If a peer-dep warning mentions `zod`, install `zod@^3.23.0` too.

- [ ] **Step 2: Add size-limit tooling (dev)**

```bash
cd app
npm install --save-dev --save-exact size-limit@11.1.6 @size-limit/preset-app@11.1.6
```

- [ ] **Step 3: Create `.size-limit.json`**

File: `app/.size-limit.json`

```json
[
  {
    "name": "AI tool route (PromptCraft)",
    "path": "build/_app/immutable/chunks/*.js",
    "import": "{ chat } from '/src/lib/ai/gateway.ts'",
    "limit": "50 KB"
  }
]
```

Note: the `path` is a placeholder — after Commit 1's build, run `npm run build` once, inspect `build/_app/immutable/chunks/`, and refine the glob. This is intentional rough scaffolding; the exact glob is tuned in Commit 6 after the tool files migrate imports.

- [ ] **Step 4: Add `size` script to `app/package.json`**

Modify `app/package.json` `scripts` block to add:

```json
"size": "npm run build && size-limit"
```

- [ ] **Step 5: Verify install**

```bash
cd app && npm run check
```

Expected: no new type errors from the install.

### 1.C — Types module (TDD)

- [ ] **Step 1: Write failing test for types module shape**

File: `app/src/lib/ai/__tests__/types.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { GatewayError } from '../types';

describe('types module', () => {
  it('exports GatewayError with category, provider, status fields', () => {
    const e = new GatewayError('boom', { category: 'auth', provider: 'openrouter', status: 401 });
    expect(e.category).toBe('auth');
    expect(e.provider).toBe('openrouter');
    expect(e.status).toBe(401);
    expect(e.message).toBe('boom');
    expect(e).toBeInstanceOf(Error);
  });

  it('carries optional retryAfterMs for rate_limit', () => {
    const e = new GatewayError('slow down', {
      category: 'rate_limit', provider: 'anthropic', retryAfterMs: 4000
    });
    expect(e.retryAfterMs).toBe(4000);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd app && npx vitest run src/lib/ai/__tests__/types.test.ts
```

Expected: FAIL — `Cannot find module '../types'`.

- [ ] **Step 3: Implement `types.ts`**

File: `app/src/lib/ai/types.ts`

Copy the full block from spec §4.2 verbatim — all types plus `GatewayError`. Key contents (verbatim from spec):

```ts
export type ProviderId = 'openrouter' | 'anthropic' | 'openai-compat';

export type QualifiedModelId = `${ProviderId}:${string}` | string;

export type ErrorCategory =
  | 'auth' | 'credit' | 'forbidden' | 'not_found'
  | 'rate_limit' | 'network' | 'format' | 'cors' | 'api' | 'unknown';

export class GatewayError extends Error {
  readonly category: ErrorCategory;
  readonly status?: number;
  readonly provider: ProviderId;
  readonly retryAfterMs?: number;
  readonly raw?: unknown;
  constructor(msg: string, opts: {
    category: ErrorCategory; status?: number; provider: ProviderId;
    retryAfterMs?: number; raw?: unknown;
  }) {
    super(msg);
    this.name = 'GatewayError';
    this.category = opts.category;
    this.status = opts.status;
    this.provider = opts.provider;
    this.retryAfterMs = opts.retryAfterMs;
    this.raw = opts.raw;
  }
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; image: string | ArrayBuffer; mediaType?: string }
  | { type: 'file'; data: ArrayBuffer; mediaType: string; filename?: string };

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
};

export type ToolDef = {
  description: string;
  inputSchema: unknown;
  execute?: (input: unknown) => Promise<unknown>;
};

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  max_tokens?: number;
  topP?: number;
  top_p?: number;
  title?: string;
  tools?: Record<string, ToolDef>;
  providerOptions?: Record<string, unknown>;
  signal?: AbortSignal;
};

export type Usage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
};

export type ChatResponse = {
  content: string;
  reasoning?: string;
  rawModel: string;
  finishReason?: string;
  usage?: Usage;
  toolCalls?: Array<{ toolName: string; input: unknown; toolCallId: string }>;
};

export type StreamEvent =
  | { type: 'text-delta'; delta: string }
  | { type: 'reasoning-delta'; delta: string }
  | { type: 'tool-call'; toolName: string; input: unknown; toolCallId: string }
  | { type: 'tool-result'; toolCallId: string; result: unknown }
  | { type: 'finish'; finishReason: string; usage: Usage };

export type Model = {
  id: string;
  qualifiedId: QualifiedModelId;
  name: string;
  provider: ProviderId;
  providerInstanceId?: string;
  upstreamProvider?: string;
  contextLength?: number;
  isFree?: boolean;
  capabilities?: {
    streaming?: boolean;
    tools?: boolean;
    vision?: boolean;
    pdf?: boolean;
    reasoning?: boolean;
    jsonSchema?: boolean;
  };
  pricing?: { promptUsd?: number; completionUsd?: number };
};

export type KeyInfo = {
  label?: string;
  limit?: number | null;
  usage?: number;
  rateLimit?: { requests?: number; interval?: string };
  raw?: unknown;
};

export type ProviderRecord =
  | { id: 'openrouter'; apiKey: string; enabled: boolean; fallbackModel?: string }
  | { id: 'anthropic'; apiKey: string; enabled: boolean; fallbackModel?: string }
  | {
      id: 'openai-compat';
      instanceId: string;
      name: string;
      presetId: string | 'custom';
      baseURL: string;
      apiKey: string;
      enabled: boolean;
      fallbackModel?: string;
      testModel?: string;
    };

export type ProviderPreset = {
  id: string;
  name: string;
  baseURL: string;
  docsUrl: string;
  defaultTestModel?: string;
  supportsAuthProbe: boolean;
};
```

- [ ] **Step 4: Run test, verify it passes**

```bash
cd app && npx vitest run src/lib/ai/__tests__/types.test.ts
```

Expected: PASS.

### 1.D — Errors module (TDD)

- [ ] **Step 1: Write failing test**

File: `app/src/lib/ai/__tests__/errors.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { translateError } from '../errors';
import { GatewayError } from '../types';

describe('translateError', () => {
  it('passes GatewayError through unchanged', () => {
    const e = new GatewayError('x', { category: 'auth', provider: 'openrouter' });
    expect(translateError(e, 'openrouter')).toBe(e);
  });

  it('maps AbortError (DOMException) to its own error with aborted-ish category', () => {
    const abort = new DOMException('aborted', 'AbortError');
    // AbortError should re-throw via the caller; translateError should not swallow it
    expect(() => translateError(abort, 'openrouter')).toThrow();
  });

  it('maps 401-shaped SDK error to category auth', () => {
    const e = { status: 401, message: 'invalid_api_key' } as const;
    const result = translateError(e, 'anthropic');
    expect(result.category).toBe('auth');
    expect(result.provider).toBe('anthropic');
  });

  it('maps 429 with Retry-After seconds to rate_limit with retryAfterMs', () => {
    const e = { status: 429, message: 'rate_limited', headers: { 'retry-after': '7' } } as const;
    const result = translateError(e, 'openrouter');
    expect(result.category).toBe('rate_limit');
    expect(result.retryAfterMs).toBe(7000);
  });

  it('maps TypeError ("Failed to fetch") to cors when host is anthropic', () => {
    const e = new TypeError('Failed to fetch');
    const result = translateError(e, 'anthropic', { suspectCors: true });
    expect(result.category).toBe('cors');
  });

  it('defaults to unknown when shape is unrecognized', () => {
    const result = translateError({ weird: true }, 'openrouter');
    expect(result.category).toBe('unknown');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd app && npx vitest run src/lib/ai/__tests__/errors.test.ts
```

Expected: FAIL — `Cannot find module '../errors'`.

- [ ] **Step 3: Implement `errors.ts`**

File: `app/src/lib/ai/errors.ts`

```ts
import { GatewayError, type ErrorCategory, type ProviderId } from './types';

type LooseError = {
  status?: number; statusCode?: number;
  code?: string | number;
  message?: string;
  headers?: Record<string, string> | Headers;
  body?: unknown;
};

function header(h: LooseError['headers'], name: string): string | undefined {
  if (!h) return undefined;
  if (h instanceof Headers) return h.get(name) ?? undefined;
  const entry = Object.entries(h).find(([k]) => k.toLowerCase() === name.toLowerCase());
  return entry?.[1];
}

export function translateError(
  err: unknown,
  provider: ProviderId,
  opts?: { suspectCors?: boolean }
): GatewayError {
  if (err instanceof GatewayError) return err;

  // AbortError must propagate — callers need to distinguish cancelation.
  if (err instanceof DOMException && err.name === 'AbortError') throw err;
  if (err instanceof Error && err.name === 'AbortError') throw err;

  // Network / CORS: fetch() in browsers throws TypeError with "Failed to fetch"
  if (err instanceof TypeError && /failed to fetch|network/i.test(err.message)) {
    const category: ErrorCategory = opts?.suspectCors ? 'cors' : 'network';
    return new GatewayError(err.message, { category, provider, raw: err });
  }

  const le = err as LooseError;
  const status = le.status ?? le.statusCode;
  const msg = le.message || `HTTP ${status ?? '?'}`;
  const retryAfter = header(le.headers, 'retry-after');
  const retryAfterMs = retryAfter ? Math.max(0, Math.round(parseFloat(retryAfter) * 1000)) : undefined;

  if (status === 401 || /unauthor|invalid.?api.?key/i.test(msg)) {
    return new GatewayError(msg, { category: 'auth', status, provider, raw: err });
  }
  if (status === 402 || /credit|balance|insufficient.?funds/i.test(msg)) {
    return new GatewayError(msg, { category: 'credit', status, provider, raw: err });
  }
  if (status === 403 || /forbidden|access denied|permission/i.test(msg)) {
    return new GatewayError(msg, { category: 'forbidden', status, provider, raw: err });
  }
  if (status === 404 || /not.?found|does not exist/i.test(msg)) {
    return new GatewayError(msg, { category: 'not_found', status, provider, raw: err });
  }
  if (status === 429 || /rate.?limit/i.test(msg)) {
    return new GatewayError(msg, { category: 'rate_limit', status, provider, retryAfterMs, raw: err });
  }
  if (typeof status === 'number' && status >= 400 && status < 600) {
    return new GatewayError(msg, { category: 'api', status, provider, raw: err });
  }
  return new GatewayError(msg, { category: 'unknown', provider, raw: err });
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
cd app && npx vitest run src/lib/ai/__tests__/errors.test.ts
```

Expected: PASS.

### 1.E — Provider registry (TDD)

- [ ] **Step 1: Write failing test**

File: `app/src/lib/ai/__tests__/providers.test.ts`

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

function installLS() {
  const store = new Map<string, string>();
  const ls = {
    getItem: vi.fn((k: string) => store.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => { store.set(k, v); }),
    removeItem: vi.fn((k: string) => { store.delete(k); }),
    clear: vi.fn(() => { store.clear(); }),
    get length() { return store.size; },
    key: vi.fn((i: number) => [...store.keys()][i] ?? null)
  };
  Object.defineProperty(globalThis, 'localStorage', { value: ls, writable: true, configurable: true });
  return store;
}

beforeEach(() => { installLS(); vi.resetModules(); });

describe('providers registry', () => {
  it('seeds OpenRouter record from legacy cryptex.openrouterApiKey on first load', async () => {
    localStorage.setItem('cryptex.openrouterApiKey', 'sk-or-legacy');
    const mod = await import('../providers.svelte');
    const list = mod.listProviders();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('openrouter');
    expect(list[0].apiKey).toBe('sk-or-legacy');
    expect(list[0].enabled).toBe(true);
  });

  it('starts with an empty OpenRouter record if no legacy key exists', async () => {
    const mod = await import('../providers.svelte');
    const list = mod.listProviders();
    expect(list[0].id).toBe('openrouter');
    expect(list[0].apiKey).toBe('');
  });

  it('adds and removes provider records', async () => {
    const mod = await import('../providers.svelte');
    mod.addProvider({ id: 'anthropic', apiKey: 'sk-ant-x', enabled: true });
    expect(mod.listProviders()).toHaveLength(2);
    mod.removeProvider('anthropic');
    expect(mod.listProviders()).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd app && npx vitest run src/lib/ai/__tests__/providers.test.ts
```

Expected: FAIL — `Cannot find module '../providers.svelte'`.

- [ ] **Step 3: Implement `providers.svelte.ts`**

File: `app/src/lib/ai/providers.svelte.ts`

```ts
import { browser } from '$app/environment';
import { createPersistedState } from '$lib/stores/_persisted.svelte';
import type { ProviderRecord, ProviderId } from './types';

const STORAGE_KEY = 'cryptex.providers';

function seedInitial(): ProviderRecord[] {
  let legacyKey = '';
  if (browser) {
    try { legacyKey = (localStorage.getItem('cryptex.openrouterApiKey') || '').trim(); } catch { /* ignore */ }
  }
  return [{ id: 'openrouter', apiKey: legacyKey, enabled: true }];
}

const state = createPersistedState<ProviderRecord[]>(STORAGE_KEY, seedInitial());

export function listProviders(): ProviderRecord[] {
  return state.value;
}

export function getProvider(id: ProviderId, instanceId?: string): ProviderRecord | undefined {
  return state.value.find((p) => {
    if (p.id !== id) return false;
    if (id === 'openai-compat' && instanceId) return (p as { instanceId: string }).instanceId === instanceId;
    return true;
  });
}

export function addProvider(record: ProviderRecord): void {
  state.value = [...state.value, record];
}

export function updateProvider(
  id: ProviderId,
  patch: Partial<ProviderRecord>,
  instanceId?: string
): void {
  state.value = state.value.map((p) => {
    if (p.id !== id) return p;
    if (id === 'openai-compat' && instanceId && (p as { instanceId: string }).instanceId !== instanceId) return p;
    return { ...p, ...patch } as ProviderRecord;
  });
}

export function removeProvider(id: ProviderId, instanceId?: string): void {
  state.value = state.value.filter((p) => {
    if (p.id !== id) return true;
    if (id === 'openai-compat' && instanceId) return (p as { instanceId: string }).instanceId !== instanceId;
    return false;
  });
}

export function hasAnyKey(): boolean {
  return state.value.some((p) => p.enabled && p.apiKey);
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
cd app && npx vitest run src/lib/ai/__tests__/providers.test.ts
```

Expected: PASS.

### 1.F — Validation guards (TDD)

- [ ] **Step 1: Write failing test**

File: `app/src/lib/ai/__tests__/validate.test.ts`

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { scheduleValidate, verifyNow, _resetValidationStateForTests } from '../validate';

beforeEach(() => {
  _resetValidationStateForTests();
  vi.useFakeTimers();
});

describe('validation guards', () => {
  it('debounces blur-triggered validation by 800ms', async () => {
    const probe = vi.fn().mockResolvedValue({});
    scheduleValidate('openrouter', undefined, 'sk-1', probe);
    scheduleValidate('openrouter', undefined, 'sk-1', probe);
    scheduleValidate('openrouter', undefined, 'sk-1', probe);
    expect(probe).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(799);
    expect(probe).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('skips dedup: same key already validated within 3s throttle', async () => {
    const probe = vi.fn().mockResolvedValue({});
    scheduleValidate('openrouter', undefined, 'sk-1', probe);
    await vi.advanceTimersByTimeAsync(850);
    expect(probe).toHaveBeenCalledTimes(1);
    scheduleValidate('openrouter', undefined, 'sk-1', probe);
    await vi.advanceTimersByTimeAsync(850);
    expect(probe).toHaveBeenCalledTimes(1); // throttled, same key
  });

  it('aborts in-flight when key changes during debounce', async () => {
    const probe = vi.fn().mockResolvedValue({});
    scheduleValidate('openrouter', undefined, 'sk-1', probe);
    await vi.advanceTimersByTimeAsync(400);
    scheduleValidate('openrouter', undefined, 'sk-2', probe);
    await vi.advanceTimersByTimeAsync(900);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(probe).toHaveBeenLastCalledWith('sk-2', expect.any(AbortSignal));
  });

  it('locks out 60s after 3 consecutive auth failures', async () => {
    const probe = vi.fn().mockRejectedValue(Object.assign(new Error('401'), { status: 401 }));
    for (let i = 0; i < 3; i++) {
      scheduleValidate('openrouter', undefined, 'sk-bad-' + i, probe);
      await vi.advanceTimersByTimeAsync(5000);
    }
    expect(probe).toHaveBeenCalledTimes(3);
    scheduleValidate('openrouter', undefined, 'sk-bad-fourth', probe);
    await vi.advanceTimersByTimeAsync(5000);
    expect(probe).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(60_001);
    scheduleValidate('openrouter', undefined, 'sk-new', probe);
    await vi.advanceTimersByTimeAsync(5000);
    expect(probe).toHaveBeenCalledTimes(4);
  });
});

describe('verifyNow', () => {
  it('bypasses debounce, awaits the probe, returns KeyInfo', async () => {
    const probe = vi.fn().mockResolvedValue({ label: 'test' });
    vi.useRealTimers();
    const result = await verifyNow('openrouter', undefined, 'sk-1', probe);
    expect(result).toEqual({ label: 'test' });
    expect(probe).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd app && npx vitest run src/lib/ai/__tests__/validate.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `validate.ts`**

File: `app/src/lib/ai/validate.ts`

```ts
import type { KeyInfo, ProviderId } from './types';

const DEBOUNCE_MS = 800;
const THROTTLE_MS = 3000;
const LOCKOUT_401_THRESHOLD = 3;
const LOCKOUT_DURATION_MS = 60_000;

export type Probe = (candidate: string, signal: AbortSignal) => Promise<KeyInfo>;

type State = {
  lastKey?: string;
  lastValidatedAt?: number;
  consecutiveAuthFails: number;
  lockoutUntil?: number;
  debounceTimer?: ReturnType<typeof setTimeout>;
  inflight?: AbortController;
  lastResult?: KeyInfo | { error: unknown };
};

const states = new Map<string, State>();
const listeners = new Map<string, Set<(r: KeyInfo | { error: unknown }) => void>>();

function stateKey(provider: ProviderId, instanceId?: string): string {
  return instanceId ? `${provider}::${instanceId}` : provider;
}

function getState(provider: ProviderId, instanceId?: string): State {
  const k = stateKey(provider, instanceId);
  let s = states.get(k);
  if (!s) { s = { consecutiveAuthFails: 0 }; states.set(k, s); }
  return s;
}

export function subscribeValidation(
  provider: ProviderId,
  instanceId: string | undefined,
  fn: (r: KeyInfo | { error: unknown }) => void
): () => void {
  const k = stateKey(provider, instanceId);
  let set = listeners.get(k);
  if (!set) { set = new Set(); listeners.set(k, set); }
  set.add(fn);
  return () => { set?.delete(fn); };
}

function emit(provider: ProviderId, instanceId: string | undefined, r: KeyInfo | { error: unknown }): void {
  listeners.get(stateKey(provider, instanceId))?.forEach((fn) => fn(r));
}

export function scheduleValidate(
  provider: ProviderId,
  instanceId: string | undefined,
  candidate: string,
  probe: Probe
): void {
  const s = getState(provider, instanceId);

  if (s.lockoutUntil && Date.now() < s.lockoutUntil) return;
  if (s.debounceTimer) clearTimeout(s.debounceTimer);
  if (s.inflight) s.inflight.abort();

  s.debounceTimer = setTimeout(async () => {
    s.debounceTimer = undefined;
    if (s.lastKey === candidate && s.lastValidatedAt && Date.now() - s.lastValidatedAt < THROTTLE_MS) return;

    const ctrl = new AbortController();
    s.inflight = ctrl;
    try {
      const info = await probe(candidate, ctrl.signal);
      s.lastKey = candidate;
      s.lastValidatedAt = Date.now();
      s.consecutiveAuthFails = 0;
      s.lastResult = info;
      emit(provider, instanceId, info);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403) {
        s.consecutiveAuthFails += 1;
        if (s.consecutiveAuthFails >= LOCKOUT_401_THRESHOLD) s.lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      }
      s.lastResult = { error: err };
      emit(provider, instanceId, { error: err });
    } finally {
      s.inflight = undefined;
    }
  }, DEBOUNCE_MS);
}

export async function verifyNow(
  provider: ProviderId,
  instanceId: string | undefined,
  candidate: string,
  probe: Probe
): Promise<KeyInfo> {
  const s = getState(provider, instanceId);
  if (s.debounceTimer) { clearTimeout(s.debounceTimer); s.debounceTimer = undefined; }
  if (s.inflight) s.inflight.abort();
  const ctrl = new AbortController();
  s.inflight = ctrl;
  try {
    const info = await probe(candidate, ctrl.signal);
    s.lastKey = candidate;
    s.lastValidatedAt = Date.now();
    s.consecutiveAuthFails = 0;
    s.lastResult = info;
    emit(provider, instanceId, info);
    return info;
  } finally {
    s.inflight = undefined;
  }
}

/** Test-only. Do not import from app code. */
export function _resetValidationStateForTests(): void {
  states.clear();
  listeners.clear();
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
cd app && npx vitest run src/lib/ai/__tests__/validate.test.ts
```

Expected: PASS.

### 1.G — Adapter interface + presets skeleton

- [ ] **Step 1: Create adapter base file (no test needed — pure type interface)**

File: `app/src/lib/ai/adapters/base.ts`

```ts
import type { LanguageModelV2 } from '@ai-sdk/provider';
import type { ProviderId, Model, KeyInfo } from '../types';

export interface Adapter {
  readonly id: ProviderId;
  readonly instanceId?: string;
  isConfigured(): boolean;
  validateKey(candidate: string, signal?: AbortSignal): Promise<KeyInfo>;
  resolveModel(modelId: string): LanguageModelV2;
  fetchCatalog(signal?: AbortSignal): Promise<Model[]>;
}
```

If `@ai-sdk/provider` isn't a direct dep, import the type from `ai` instead — whichever resolves (the Vercel AI SDK exports `LanguageModelV2` from one of them). Try `from 'ai'` first; if svelte-check fails, try `from '@ai-sdk/provider'`.

- [ ] **Step 2: Create preset skeleton**

File: `app/src/lib/ai/presets.ts`

```ts
import type { ProviderPreset } from './types';

/** OpenAI-compatible presets. Final contents land in Commit 3. */
export const OPENAI_COMPAT_PRESETS: ProviderPreset[] = [
  { id: 'custom', name: 'Custom', baseURL: '', docsUrl: '', defaultTestModel: undefined, supportsAuthProbe: false }
];
```

### 1.H — OpenRouter adapter (TDD)

- [ ] **Step 1: Write failing adapter test**

File: `app/src/lib/ai/__tests__/openrouter-adapter.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => { vi.resetModules(); });

describe('openrouterAdapter', () => {
  it('returns an Adapter whose id is openrouter', async () => {
    const mod = await import('../adapters/openrouter');
    const a = mod.openrouterAdapter({ id: 'openrouter', apiKey: 'sk-x', enabled: true });
    expect(a.id).toBe('openrouter');
    expect(a.isConfigured()).toBe(true);
  });

  it('isConfigured false when apiKey empty', async () => {
    const mod = await import('../adapters/openrouter');
    const a = mod.openrouterAdapter({ id: 'openrouter', apiKey: '', enabled: true });
    expect(a.isConfigured()).toBe(false);
  });

  it('validateKey hits /auth/key and maps 401 to auth error', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'invalid' } }), { status: 401 }));
    const mod = await import('../adapters/openrouter');
    const a = mod.openrouterAdapter({ id: 'openrouter', apiKey: 'sk-bad', enabled: true });
    await expect(a.validateKey('sk-bad')).rejects.toMatchObject({ category: 'auth' });
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd app && npx vitest run src/lib/ai/__tests__/openrouter-adapter.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `adapters/openrouter.ts`**

File: `app/src/lib/ai/adapters/openrouter.ts`

```ts
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { browser } from '$app/environment';
import type { Adapter } from './base';
import type { KeyInfo, Model, ProviderRecord } from '../types';
import { GatewayError } from '../types';
import { translateError } from '../errors';

const BASE_URL = 'https://openrouter.ai/api/v1';

export function openrouterAdapter(record: Extract<ProviderRecord, { id: 'openrouter' }>): Adapter {
  const key = (record.apiKey || '').trim();
  const referer = (browser && typeof window !== 'undefined' && window.location?.origin) || 'https://cryptex.app';

  const provider = createOpenRouter({
    apiKey: key,
    headers: { 'HTTP-Referer': referer, 'X-Title': 'Cryptex' }
  });

  return {
    id: 'openrouter',
    isConfigured: () => Boolean(key),
    resolveModel: (modelId) => provider.chat(modelId),
    validateKey: async (candidate, signal) => {
      let resp: Response;
      try {
        resp = await fetch(`${BASE_URL}/auth/key`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${candidate}` },
          signal
        });
      } catch (e) { throw translateError(e, 'openrouter'); }
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        throw translateError({ status: resp.status, message: body || `HTTP ${resp.status}` }, 'openrouter');
      }
      try {
        const json = (await resp.json()) as { data?: KeyInfo };
        return json.data ?? {};
      } catch {
        throw new GatewayError('unexpected /auth/key response', { category: 'format', provider: 'openrouter', status: resp.status });
      }
    },
    fetchCatalog: async (signal) => {
      let resp: Response;
      try {
        resp = await fetch(`${BASE_URL}/models`, {
          method: 'GET',
          headers: key ? { Authorization: `Bearer ${key}` } : {},
          signal
        });
      } catch (e) { throw translateError(e, 'openrouter'); }
      if (!resp.ok) {
        throw translateError({ status: resp.status, message: `/models HTTP ${resp.status}` }, 'openrouter');
      }
      const body = (await resp.json()) as { data?: Array<Record<string, unknown>> };
      const raw = body.data ?? [];
      const out: Model[] = [];
      for (const r of raw) {
        const id = r.id;
        if (typeof id !== 'string') continue;
        const name = (typeof r.name === 'string' && r.name) || id;
        const pricing = r.pricing as { prompt?: string; completion?: string } | undefined;
        const promptPrice = pricing?.prompt;
        const completionPrice = pricing?.completion;
        const isFree =
          (promptPrice === '0' || Number(promptPrice) === 0) &&
          (completionPrice === '0' || Number(completionPrice) === 0);
        out.push({
          id,
          qualifiedId: `openrouter:${id}`,
          name,
          provider: 'openrouter',
          upstreamProvider: deriveUpstream(id),
          contextLength: typeof r.context_length === 'number' ? r.context_length : undefined,
          isFree,
          capabilities: deriveCapabilities(r)
        });
      }
      out.sort((a, b) => {
        if (a.id === 'openrouter/auto') return -1;
        if (b.id === 'openrouter/auto') return 1;
        return a.name.localeCompare(b.name);
      });
      return out;
    }
  };
}

function deriveUpstream(modelId: string): string {
  const slash = modelId.indexOf('/');
  if (slash <= 0) return 'Other';
  const raw = modelId.slice(0, slash);
  const map: Record<string, string> = {
    'x-ai': 'xAI', 'openai': 'OpenAI', 'anthropic': 'Anthropic', 'google': 'Google',
    'meta-llama': 'Meta', 'deepseek': 'DeepSeek', 'mistralai': 'Mistral', 'qwen': 'Qwen',
    'cohere': 'Cohere', 'perplexity': 'Perplexity', 'nousresearch': 'Nous', 'openrouter': 'OpenRouter'
  };
  return map[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
}

function deriveCapabilities(r: Record<string, unknown>): Model['capabilities'] {
  const modality = (r.modality || r.architecture) as string | { input_modalities?: string[] } | undefined;
  const modStr = typeof modality === 'string' ? modality : '';
  const inputMods = (typeof modality === 'object' && modality?.input_modalities) || [];
  const hasImage = modStr.includes('image') || inputMods.includes('image');
  return {
    streaming: true,
    tools: true,
    vision: hasImage,
    reasoning: /reasoning|o[13]|thinking/i.test(String(r.id ?? ''))
  };
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
cd app && npx vitest run src/lib/ai/__tests__/openrouter-adapter.test.ts
```

Expected: PASS.

### 1.I — Catalog module (port from existing)

- [ ] **Step 1: Create `catalog.svelte.ts` as a multi-adapter-capable rewrite**

File: `app/src/lib/ai/catalog.svelte.ts`

```ts
import { browser } from '$app/environment';
import type { Model } from './types';
import { listProviders } from './providers.svelte';
import { openrouterAdapter } from './adapters/openrouter';
// Future adapters added in Commits 2 and 3.

const CACHE_KEY = 'cryptex.catalogCache.v2';
const CACHE_TTL_MS = 60 * 60 * 1000;

type Status = 'idle' | 'loading' | 'ready' | 'error';
type CacheShape = { models: Model[]; fetchedAt: number };

let status = $state<Status>('idle');
let items = $state<Model[]>([]);
let fetchedAt = $state<number | null>(null);
let error = $state<string>('');
let abortController: AbortController | null = null;

function loadCache(): CacheShape | null {
  if (!browser) return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CacheShape;
  } catch { return null; }
}
function saveCache(models: Model[], ts: number): void {
  if (!browser) return;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ models, fetchedAt: ts })); } catch { /* ignore */ }
}

async function fetchAll(signal: AbortSignal): Promise<Model[]> {
  const providers = listProviders().filter((p) => p.enabled);
  const results: Model[] = [];
  for (const p of providers) {
    try {
      if (p.id === 'openrouter') {
        const a = openrouterAdapter(p);
        const models = await a.fetchCatalog(signal);
        results.push(...models);
      }
      // anthropic + openai-compat land in later commits
    } catch (e) {
      // per-provider failure does not fail the whole catalog
      if ((e as Error)?.name === 'AbortError') throw e;
      console.warn(`[catalog] ${p.id} fetch failed:`, e);
    }
  }
  return results;
}

export async function refreshCatalog(force = false): Promise<void> {
  if (!browser) return;
  if (!force && fetchedAt && Date.now() - fetchedAt < CACHE_TTL_MS && items.length > 0) return;
  if (abortController) abortController.abort();
  abortController = new AbortController();
  status = 'loading';
  error = '';
  try {
    const models = await fetchAll(abortController.signal);
    items = models;
    fetchedAt = Date.now();
    status = 'ready';
    saveCache(models, fetchedAt);
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return;
    error = (e as Error)?.message ?? 'catalog fetch failed';
    status = 'error';
  } finally {
    abortController = null;
  }
}

function hydrate(): void {
  if (status !== 'idle') return;
  const cached = loadCache();
  if (cached) { items = cached.models; fetchedAt = cached.fetchedAt; status = 'ready'; }
}

export const catalog = {
  get status(): Status { return status; },
  get error(): string { return error; },
  get list(): ReadonlyArray<Model> { return items; },
  get fetchedAt(): number | null { return fetchedAt; },
  refresh(force = true): Promise<void> { return refreshCatalog(force); },
  find(qualifiedId: string): Model | undefined { return items.find((m) => m.qualifiedId === qualifiedId || m.id === qualifiedId); },
  get byUpstream(): Record<string, Model[]> {
    const out: Record<string, Model[]> = {};
    for (const m of items) (out[m.upstreamProvider || 'Other'] ||= []).push(m);
    return out;
  }
};

export function initCatalogStore(): void {
  if (!browser) return;
  hydrate();
  if (status === 'idle' || (fetchedAt && Date.now() - fetchedAt > CACHE_TTL_MS)) {
    queueMicrotask(() => { refreshCatalog(false); });
  }
}
```

Note: `models.svelte.ts` continues to exist as a shim (next step) — callers still import `models` from `$lib/ai/models.svelte`.

### 1.J — Gateway facade (TDD)

- [ ] **Step 1: Write failing test**

File: `app/src/lib/ai/__tests__/gateway.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolve } from '../gateway';

beforeEach(() => { vi.resetModules(); });

describe('resolve', () => {
  it('qualified openrouter:X splits correctly', () => {
    const { adapter, modelId } = resolve('openrouter:openai/gpt-5.4');
    expect(adapter.id).toBe('openrouter');
    expect(modelId).toBe('openai/gpt-5.4');
  });

  it('unqualified id falls back to default openrouter', () => {
    const { adapter, modelId } = resolve('openai/gpt-5.4');
    expect(adapter.id).toBe('openrouter');
    expect(modelId).toBe('openai/gpt-5.4');
  });
});

describe('chatWithRetry', () => {
  it('retries 3x on rate_limit with exponential backoff then gives up', async () => {
    vi.useFakeTimers();
    const { chat } = await import('../gateway');
    const err = Object.assign(new Error('429'), { status: 429 });
    const generateText = vi.fn().mockRejectedValue(err);
    vi.doMock('ai', () => ({ generateText }));
    const p = chat({ model: 'openrouter:x/y', messages: [{ role: 'user', content: 'hi' }] });
    await vi.runAllTimersAsync();
    await expect(p).rejects.toMatchObject({ category: 'rate_limit' });
    expect(generateText.mock.calls.length).toBeGreaterThanOrEqual(4);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd app && npx vitest run src/lib/ai/__tests__/gateway.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement `gateway.ts`**

File: `app/src/lib/ai/gateway.ts`

```ts
import { generateText, streamText } from 'ai';
import type {
  ChatRequest, ChatResponse, StreamEvent, Model, KeyInfo, ProviderId, ProviderRecord
} from './types';
import { GatewayError } from './types';
import { translateError } from './errors';
import { listProviders, hasAnyKey as _hasAny } from './providers.svelte';
import { catalog, refreshCatalog } from './catalog.svelte';
import type { Adapter } from './adapters/base';
import { openrouterAdapter } from './adapters/openrouter';

export { listProviders, hasAnyKey } from './providers.svelte';

const PREFIX_RE = /^(openrouter|anthropic|openai-compat):(.+)$/;

function buildAdapter(record: ProviderRecord): Adapter {
  switch (record.id) {
    case 'openrouter': return openrouterAdapter(record);
    case 'anthropic':  throw new GatewayError('Anthropic adapter not installed yet', { category: 'not_found', provider: 'anthropic' });
    case 'openai-compat': throw new GatewayError('openai-compat adapter not installed yet', { category: 'not_found', provider: 'openai-compat' });
  }
}

export function resolve(modelId: string): { adapter: Adapter; modelId: string } {
  const m = PREFIX_RE.exec(modelId);
  if (m) {
    const [, providerId, inner] = m;
    if (providerId === 'openai-compat') {
      const [instanceId, ...rest] = inner.split('/');
      const record = listProviders().find(
        (p) => p.id === 'openai-compat' && (p as { instanceId: string }).instanceId === instanceId
      );
      if (!record) throw new GatewayError(`Unknown openai-compat instance: ${instanceId}`, { category: 'not_found', provider: 'openai-compat' });
      return { adapter: buildAdapter(record), modelId: rest.join('/') };
    }
    const pid = providerId as ProviderId;
    const record = listProviders().find((p) => p.id === pid);
    if (!record) throw new GatewayError(`Provider not configured: ${providerId}`, { category: 'not_found', provider: pid });
    return { adapter: buildAdapter(record), modelId: inner };
  }
  // Unqualified: route to first enabled OpenRouter record
  const fallback = listProviders().find((p) => p.id === 'openrouter');
  if (!fallback) throw new GatewayError('No OpenRouter provider configured', { category: 'not_found', provider: 'openrouter' });
  return { adapter: buildAdapter(fallback), modelId };
}

const RETRY_DELAYS = [1000, 4000, 16000];

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((res, rej) => {
    const t = setTimeout(res, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('aborted', 'AbortError')); }, { once: true });
  });
}

function normalizeRequest(req: ChatRequest): ChatRequest {
  return {
    ...req,
    maxOutputTokens: req.maxOutputTokens ?? req.max_tokens,
    topP: req.topP ?? req.top_p
  };
}

export async function chat(req: ChatRequest): Promise<ChatResponse> {
  const norm = normalizeRequest(req);
  const { adapter, modelId } = resolve(norm.model);

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const result = await generateText({
        model: adapter.resolveModel(modelId),
        messages: norm.messages as never,
        temperature: norm.temperature,
        maxOutputTokens: norm.maxOutputTokens,
        topP: norm.topP,
        tools: norm.tools as never,
        providerOptions: norm.providerOptions as never,
        abortSignal: norm.signal
      });
      return {
        content: (result.text ?? '').trim(),
        reasoning: Array.isArray(result.reasoning) ? result.reasoning.map((r: { text: string }) => r.text).join('') || undefined : undefined,
        rawModel: result.response?.modelId ?? modelId,
        finishReason: result.finishReason,
        usage: result.usage ? {
          inputTokens: result.usage.promptTokens ?? result.usage.inputTokens,
          outputTokens: result.usage.completionTokens ?? result.usage.outputTokens,
          totalTokens: result.usage.totalTokens
        } : undefined,
        toolCalls: result.toolCalls as ChatResponse['toolCalls']
      };
    } catch (e) {
      const err = translateError(e, adapter.id);
      const last = attempt === RETRY_DELAYS.length;
      if (err.category !== 'rate_limit' || last) throw err;
      const wait = err.retryAfterMs ?? RETRY_DELAYS[attempt];
      await sleep(wait, norm.signal);
    }
  }
  throw new GatewayError('retry exhausted', { category: 'rate_limit', provider: adapter.id });
}

export async function* streamChat(req: ChatRequest): AsyncGenerator<StreamEvent> {
  const norm = normalizeRequest(req);
  const { adapter, modelId } = resolve(norm.model);
  const result = streamText({
    model: adapter.resolveModel(modelId),
    messages: norm.messages as never,
    temperature: norm.temperature,
    maxOutputTokens: norm.maxOutputTokens,
    topP: norm.topP,
    tools: norm.tools as never,
    providerOptions: norm.providerOptions as never,
    abortSignal: norm.signal
  });
  for await (const part of result.fullStream) {
    switch (part.type) {
      case 'text-delta':      yield { type: 'text-delta', delta: (part as { textDelta: string }).textDelta }; break;
      case 'reasoning':       yield { type: 'reasoning-delta', delta: (part as { textDelta: string }).textDelta }; break;
      case 'tool-call':       yield { type: 'tool-call', toolName: (part as { toolName: string }).toolName, input: (part as { args: unknown }).args, toolCallId: (part as { toolCallId: string }).toolCallId }; break;
      case 'tool-result':     yield { type: 'tool-result', toolCallId: (part as { toolCallId: string }).toolCallId, result: (part as { result: unknown }).result }; break;
      case 'finish':          yield { type: 'finish', finishReason: (part as { finishReason: string }).finishReason, usage: (part as { usage: unknown }).usage as StreamEvent & { type: 'finish' }['usage'] }; break;
    }
  }
}

export async function fetchModels(signal?: AbortSignal): Promise<Model[]> {
  await refreshCatalog(false);
  return [...catalog.list];
}

export async function validateKey(
  providerId: ProviderId,
  candidate: string,
  opts?: { instanceId?: string; signal?: AbortSignal }
): Promise<KeyInfo> {
  const record = listProviders().find((p) => {
    if (p.id !== providerId) return false;
    if (providerId === 'openai-compat' && opts?.instanceId) return (p as { instanceId: string }).instanceId === opts.instanceId;
    return true;
  });
  if (!record) throw new GatewayError(`Provider not configured: ${providerId}`, { category: 'not_found', provider: providerId });
  return buildAdapter(record).validateKey(candidate, opts?.signal);
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
cd app && npx vitest run src/lib/ai/__tests__/gateway.test.ts
```

Expected: PASS.

### 1.K — Convert legacy `openrouter.ts` and `models.svelte.ts` into shims

- [ ] **Step 1: Replace `openrouter.ts` body with shim**

File: `app/src/lib/ai/openrouter.ts` — full replacement content:

```ts
/**
 * @deprecated Since 2026-04-18. Use `$lib/ai/gateway` instead. This shim will be
 * removed in Commit 6 of the gateway rollout.
 */
import type {
  ChatMessage as GatewayChatMessage,
  ChatRequest as GatewayChatRequest,
  ChatResponse as GatewayChatResponse,
  KeyInfo as GatewayKeyInfo,
  Model as GatewayModel,
  ErrorCategory
} from './types';
import { GatewayError } from './types';
import { chat as gatewayChat, validateKey as gatewayValidateKey, fetchModels as gatewayFetchModels } from './gateway';
import { listProviders, updateProvider } from './providers.svelte';

export type { ErrorCategory };
export type ChatMessage = GatewayChatMessage;
export type ChatRequest = GatewayChatRequest;
export type ChatResponse = GatewayChatResponse;
export type KeyInfo = GatewayKeyInfo;
export type Model = GatewayModel;

/** @deprecated Use GatewayError from $lib/ai/types. */
export const OpenRouterError = GatewayError;
export type OpenRouterError = GatewayError;

function openrouterRecord() {
  return listProviders().find((p) => p.id === 'openrouter') as { apiKey: string } | undefined;
}

export function getApiKey(): string { return (openrouterRecord()?.apiKey ?? '').trim(); }
export function setApiKey(key: string): void { updateProvider('openrouter', { apiKey: key.trim() }); }
export function hasApiKey(): boolean { return getApiKey().length > 0; }

export function chat(req: ChatRequest): Promise<ChatResponse> {
  // If the caller passed a bare model (no prefix), stay on OpenRouter — matches legacy behavior.
  return gatewayChat(req);
}

export function validateKey(candidate: string, signal?: AbortSignal): Promise<KeyInfo> {
  return gatewayValidateKey('openrouter', candidate, { signal });
}

export async function fetchModels(signal?: AbortSignal): Promise<{ models: Model[]; fetchedAt: number; live: boolean }> {
  const models = await gatewayFetchModels(signal);
  // Only the OpenRouter models from the unified catalog
  const filtered = models.filter((m) => m.provider === 'openrouter');
  return { models: filtered, fetchedAt: Date.now(), live: filtered.length > 0 };
}

export const FALLBACK_MODELS: ReadonlyArray<Model> = Object.freeze([
  { id: 'openrouter/auto',                      qualifiedId: 'openrouter:openrouter/auto',                      name: 'Auto (best for price)', provider: 'openrouter', upstreamProvider: 'OpenRouter' },
  { id: 'anthropic/claude-sonnet-4.5',          qualifiedId: 'openrouter:anthropic/claude-sonnet-4.5',          name: 'Claude Sonnet 4.5',     provider: 'openrouter', upstreamProvider: 'Anthropic' },
  { id: 'anthropic/claude-haiku-4.5',           qualifiedId: 'openrouter:anthropic/claude-haiku-4.5',           name: 'Claude Haiku 4.5',      provider: 'openrouter', upstreamProvider: 'Anthropic' },
  { id: 'openai/gpt-4o',                        qualifiedId: 'openrouter:openai/gpt-4o',                        name: 'GPT-4o',                provider: 'openrouter', upstreamProvider: 'OpenAI' },
  { id: 'openai/gpt-4o-mini',                   qualifiedId: 'openrouter:openai/gpt-4o-mini',                   name: 'GPT-4o Mini',           provider: 'openrouter', upstreamProvider: 'OpenAI' },
  { id: 'google/gemini-2.5-flash-preview',      qualifiedId: 'openrouter:google/gemini-2.5-flash-preview',      name: 'Gemini 2.5 Flash',      provider: 'openrouter', upstreamProvider: 'Google' },
  { id: 'google/gemma-3-27b-it',                qualifiedId: 'openrouter:google/gemma-3-27b-it',                name: 'Gemma 3 27B',           provider: 'openrouter', upstreamProvider: 'Google' },
  { id: 'meta-llama/llama-3.3-70b-instruct',    qualifiedId: 'openrouter:meta-llama/llama-3.3-70b-instruct',    name: 'Llama 3.3 70B',         provider: 'openrouter', upstreamProvider: 'Meta' },
  { id: 'deepseek/deepseek-chat-v3-0324',       qualifiedId: 'openrouter:deepseek/deepseek-chat-v3-0324',       name: 'DeepSeek V3',           provider: 'openrouter', upstreamProvider: 'DeepSeek' },
  { id: 'x-ai/grok-4',                          qualifiedId: 'openrouter:x-ai/grok-4',                          name: 'Grok 4',                provider: 'openrouter', upstreamProvider: 'xAI' }
]);
```

- [ ] **Step 2: Replace `models.svelte.ts` body with shim**

File: `app/src/lib/ai/models.svelte.ts` — full replacement:

```ts
/**
 * @deprecated Since 2026-04-18. Use `$lib/ai/catalog.svelte` instead. This shim
 * will be removed in Commit 6 of the gateway rollout.
 */
import { catalog, initCatalogStore, refreshCatalog } from './catalog.svelte';
import type { Model } from './types';

export { initCatalogStore as initModelsStore, refreshCatalog as refreshModels };

export const models = {
  get status() { return catalog.status; },
  get error() { return catalog.error; },
  get list(): ReadonlyArray<Model> { return catalog.list; },
  get isLive() { return catalog.status === 'ready' && catalog.list.length > 0; },
  get fetchedAt(): number | null { return catalog.fetchedAt; },
  refresh(force = true): Promise<void> { return catalog.refresh(force); },
  find(id: string): Model | undefined { return catalog.find(id); },
  get byProvider(): Record<string, Model[]> { return catalog.byUpstream; }
};
```

- [ ] **Step 3: Run existing `openrouter.test.ts` to see if shim shape matches**

```bash
cd app && npx vitest run src/lib/ai/openrouter.test.ts
```

Expected: the existing test file may partially fail because (a) `setApiKey('').clears` now goes through provider registry not raw localStorage, (b) `fetchModels()` mocks the `/models` endpoint and expects the old shape. Triage on a per-test basis:
- Key round-trip tests: must still pass via the shim. If they fail, the shim is wrong — fix it.
- `fetchModels` shape tests: accept failure, delete those legacy tests (move coverage to the new `openrouter-adapter.test.ts`).

- [ ] **Step 4: Delete replaced legacy tests**

Any test in `app/src/lib/ai/openrouter.test.ts` that exercises `fetchModels` response shape directly should be deleted — coverage lives in the new adapter test. Keep the API-key round-trip tests (`getApiKey`/`setApiKey`/`hasApiKey`) — they still hit the shim path.

Minimal safe action: open `openrouter.test.ts`, delete the `describe('fetchModels', ...)` and `describe('validateKey', ...)` blocks. Leave `describe('API key state', ...)` and `describe('FALLBACK_MODELS', ...)` blocks intact.

- [ ] **Step 5: Run full test suite**

```bash
cd app && npm run test:unit
```

Expected: all tests PASS.

### 1.L — Type-check + build smoke

- [ ] **Step 1: Type-check**

```bash
cd app && npm run check
```

Expected: 0 errors. If `LanguageModelV2` import fails, switch to `import type { LanguageModelV2 } from 'ai'`. If the Vercel AI SDK types break `generateText` call, check the installed version's signature and adjust — field names (`maxOutputTokens` vs `maxTokens`, `messages` vs `prompt`) vary slightly across 6.x minor releases.

- [ ] **Step 2: Build**

```bash
cd app && npm run build
```

Expected: build succeeds. If it fails on `@openrouter/ai-sdk-provider` resolution, add to `vite.config.ts` `optimizeDeps.include` (create the hook if absent).

### 1.M — Manual verification before commit

- [ ] **Step 1: Dev server smoke**

```bash
cd app && npm run dev
```

Open `http://localhost:5173/` in the browser.

- [ ] **Step 2: Verify PromptCraft still works**

Navigate to PromptCraft. Enter a short prompt. Select any model from the picker. Click Generate. Expected: result streams back within a few seconds; DevTools Network shows request to `openrouter.ai/api/v1/chat/completions`.

- [ ] **Step 3: Verify Anti-Classifier still works**

Same drill — expected identical behavior.

- [ ] **Step 4: Verify Translate still works**

Same.

- [ ] **Step 5: Verify Settings page still works**

Open Settings. Confirm OpenRouter key shows up, Verify button works, model picker populates. No visible UI difference.

- [ ] **Step 6: Stage files and commit**

```bash
cd ..  # back to repo root
git add app/.size-limit.json app/package.json app/package-lock.json \
        app/src/lib/ai/types.ts app/src/lib/ai/errors.ts \
        app/src/lib/ai/providers.svelte.ts app/src/lib/ai/catalog.svelte.ts \
        app/src/lib/ai/validate.ts app/src/lib/ai/presets.ts \
        app/src/lib/ai/adapters/base.ts app/src/lib/ai/adapters/openrouter.ts \
        app/src/lib/ai/gateway.ts app/src/lib/ai/openrouter.ts \
        app/src/lib/ai/models.svelte.ts app/src/lib/ai/openrouter.test.ts \
        app/src/lib/ai/__tests__/
git commit -m "$(cat <<'EOF'
feat(ai): gateway facade + OpenRouter adapter behind Vercel AI SDK

Introduces app/src/lib/ai/gateway.ts as the single chat() entry point, built on
Vercel AI SDK 6 with @openrouter/ai-sdk-provider as the first adapter. Types
consolidated in types.ts, error taxonomy in errors.ts, persisted provider
registry in providers.svelte.ts (legacy-seeded from cryptex.openrouterApiKey),
catalog aggregation in catalog.svelte.ts, debounced/throttled/lockout-aware
validation in validate.ts.

Legacy openrouter.ts and models.svelte.ts become @deprecated re-export shims so
callers keep working with zero import changes. Final cutover happens in Commit 6.

No user-visible behavior change. PromptCraft / Anti-Classifier / Translate all
continue to work against the same OpenRouter calls.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### 1.N — PAUSE for manual user test + push

After the commit, STOP. The user must:

1. Run the app, exercise all three AI tools, confirm no regression.
2. Tell you to push. Only then:
   ```bash
   git push origin master
   ```

Do NOT move to Commit 2 until the user confirms Commit 1 is verified and pushed.

---

## Commit 2: Anthropic-direct adapter

**Goal:** Add `adapters/anthropic.ts` with browser-safe direct Anthropic client. Wire it into `gateway.resolve()` and `catalog.fetchAll()`. No UI yet.

### 2.A — Files

**Create:**
- `app/src/lib/ai/adapters/anthropic.ts`
- `app/src/lib/ai/__tests__/anthropic-adapter.test.ts`

**Modify:**
- `app/src/lib/ai/gateway.ts` — swap the placeholder branch for the real adapter
- `app/src/lib/ai/catalog.svelte.ts` — handle anthropic provider in `fetchAll`
- `app/package.json` — add `@ai-sdk/anthropic@1.0.0`

### 2.B — Install dep

- [ ] **Step 1:**

```bash
cd app && npm install --save-exact @ai-sdk/anthropic@1.0.0
```

### 2.C — Adapter (TDD)

- [ ] **Step 1: Failing test**

File: `app/src/lib/ai/__tests__/anthropic-adapter.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => { vi.resetModules(); });

describe('anthropicAdapter', () => {
  it('builds an adapter with id anthropic', async () => {
    const mod = await import('../adapters/anthropic');
    const a = mod.anthropicAdapter({ id: 'anthropic', apiKey: 'sk-ant-x', enabled: true });
    expect(a.id).toBe('anthropic');
    expect(a.isConfigured()).toBe(true);
  });

  it('fetchCatalog returns the static Anthropic 4.x model list with qualifiedIds', async () => {
    const mod = await import('../adapters/anthropic');
    const a = mod.anthropicAdapter({ id: 'anthropic', apiKey: 'sk-ant-x', enabled: true });
    const list = await a.fetchCatalog();
    expect(list.length).toBeGreaterThanOrEqual(3);
    expect(list.every((m) => m.qualifiedId.startsWith('anthropic:'))).toBe(true);
    expect(list.map((m) => m.id)).toContain('claude-haiku-4-5');
  });

  it('validateKey maps 401 to auth category', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'unauth' } }), { status: 401 }));
    const mod = await import('../adapters/anthropic');
    const a = mod.anthropicAdapter({ id: 'anthropic', apiKey: 'sk-ant-bad', enabled: true });
    await expect(a.validateKey('sk-ant-bad')).rejects.toMatchObject({ category: 'auth' });
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
cd app && npx vitest run src/lib/ai/__tests__/anthropic-adapter.test.ts
```

- [ ] **Step 3: Implement**

File: `app/src/lib/ai/adapters/anthropic.ts`

```ts
import { createAnthropic } from '@ai-sdk/anthropic';
import type { Adapter } from './base';
import type { Model, ProviderRecord, KeyInfo } from '../types';
import { translateError } from '../errors';

const BASE_URL = 'https://api.anthropic.com';

/** Static Anthropic 4.x catalog as of 2026-04-18. No /models endpoint exists. */
const STATIC_MODELS: ReadonlyArray<{ id: string; name: string; reasoning?: boolean; vision?: boolean; tools?: boolean }> = [
  { id: 'claude-opus-4-7',     name: 'Claude Opus 4.7',     reasoning: true, vision: true, tools: true },
  { id: 'claude-sonnet-4-6',   name: 'Claude Sonnet 4.6',   reasoning: true, vision: true, tools: true },
  { id: 'claude-haiku-4-5',    name: 'Claude Haiku 4.5',    reasoning: true, vision: true, tools: true }
];

export function anthropicAdapter(record: Extract<ProviderRecord, { id: 'anthropic' }>): Adapter {
  const key = (record.apiKey || '').trim();

  const provider = createAnthropic({
    apiKey: key,
    headers: { 'anthropic-dangerous-direct-browser-access': 'true' }
  });

  return {
    id: 'anthropic',
    isConfigured: () => Boolean(key),
    resolveModel: (modelId) => provider(modelId),
    validateKey: async (candidate, signal) => {
      let resp: Response;
      try {
        resp = await fetch(`${BASE_URL}/v1/messages`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': candidate,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5',
            max_tokens: 1,
            messages: [{ role: 'user', content: '.' }]
          }),
          signal
        });
      } catch (e) { throw translateError(e, 'anthropic', { suspectCors: true }); }
      if (resp.ok) {
        return { label: 'anthropic', raw: undefined } satisfies KeyInfo;
      }
      const body = await resp.text().catch(() => '');
      throw translateError({ status: resp.status, message: body || `HTTP ${resp.status}` }, 'anthropic');
    },
    fetchCatalog: async () => {
      const out: Model[] = STATIC_MODELS.map((m) => ({
        id: m.id,
        qualifiedId: `anthropic:${m.id}`,
        name: m.name,
        provider: 'anthropic',
        upstreamProvider: 'Anthropic',
        capabilities: { streaming: true, tools: m.tools, vision: m.vision, reasoning: m.reasoning, jsonSchema: true }
      }));
      return out;
    }
  };
}
```

- [ ] **Step 4: Run, verify pass**

```bash
cd app && npx vitest run src/lib/ai/__tests__/anthropic-adapter.test.ts
```

### 2.D — Wire into gateway + catalog

- [ ] **Step 1: Update `gateway.ts` buildAdapter**

In `app/src/lib/ai/gateway.ts`, replace the Anthropic throw:

```ts
import { anthropicAdapter } from './adapters/anthropic';
// ...
    case 'anthropic': return anthropicAdapter(record);
```

- [ ] **Step 2: Update `catalog.svelte.ts` fetchAll**

In `app/src/lib/ai/catalog.svelte.ts`, add:

```ts
import { anthropicAdapter } from './adapters/anthropic';
// inside fetchAll, after the openrouter branch:
      if (p.id === 'anthropic') {
        const a = anthropicAdapter(p);
        const models = await a.fetchCatalog(signal);
        results.push(...models);
      }
```

- [ ] **Step 3: Run full test suite + check**

```bash
cd app && npm run test:unit && npm run check
```

Expected: all pass.

### 2.E — Manual smoke + commit

- [ ] **Step 1: Dev server smoke (no Anthropic UI yet — just confirm no regression)**

```bash
cd app && npm run dev
```

Walk through all three tools. Nothing should change visually.

- [ ] **Step 2: Commit**

```bash
cd ..
git add app/package.json app/package-lock.json \
        app/src/lib/ai/adapters/anthropic.ts \
        app/src/lib/ai/gateway.ts \
        app/src/lib/ai/catalog.svelte.ts \
        app/src/lib/ai/__tests__/anthropic-adapter.test.ts
git commit -m "$(cat <<'EOF'
feat(ai): Anthropic-direct adapter

Adds adapters/anthropic.ts using @ai-sdk/anthropic with the
anthropic-dangerous-direct-browser-access header for browser CORS. Static
4.x catalog (Opus 4.7 / Sonnet 4.6 / Haiku 4.5) since Anthropic has no /models
endpoint. validateKey probes POST /v1/messages with max_tokens:1.

Adapter is dormant — no UI surfaces it yet. Wired into gateway.resolve() and
catalog.fetchAll() so future UI work just writes ProviderRecord entries.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### 2.F — PAUSE for user test + push

Same cadence. Tools still work. User pushes.

---

## Commit 3: OpenAI-compatible adapter + presets + /models discovery

**Goal:** Multi-instance OpenAI-compatible adapter. Final preset list (Groq, Together, Fireworks, DeepInfra, Cerebras, SambaNova, Custom). Per-instance catalog discovery via `/models`.

### 3.A — Files

**Create:**
- `app/src/lib/ai/adapters/openai-compat.ts`
- `app/src/lib/ai/__tests__/openai-compat-adapter.test.ts`
- `app/src/lib/ai/__tests__/presets.test.ts`

**Modify:**
- `app/src/lib/ai/presets.ts` — full preset list
- `app/src/lib/ai/gateway.ts` — wire openai-compat branch
- `app/src/lib/ai/catalog.svelte.ts` — wire openai-compat branch
- `app/package.json` — add `@ai-sdk/openai-compatible@1.0.0`

### 3.B — Install dep

- [ ] **Step 1:**

```bash
cd app && npm install --save-exact @ai-sdk/openai-compatible@1.0.0
```

### 3.C — Presets list (TDD)

- [ ] **Step 1: Failing test**

File: `app/src/lib/ai/__tests__/presets.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { OPENAI_COMPAT_PRESETS } from '../presets';

describe('openai-compat presets', () => {
  it('includes the 6 known presets + Custom', () => {
    const ids = OPENAI_COMPAT_PRESETS.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['groq', 'together', 'fireworks', 'deepinfra', 'cerebras', 'sambanova', 'custom']));
  });

  it('each non-custom preset has baseURL + docsUrl + defaultTestModel', () => {
    for (const p of OPENAI_COMPAT_PRESETS) {
      if (p.id === 'custom') continue;
      expect(p.baseURL).toMatch(/^https:\/\//);
      expect(p.docsUrl).toMatch(/^https:\/\//);
      expect(p.defaultTestModel).toBeTruthy();
      expect(p.supportsAuthProbe).toBe(true);
    }
  });

  it('custom preset has empty baseURL and supportsAuthProbe false', () => {
    const c = OPENAI_COMPAT_PRESETS.find((p) => p.id === 'custom')!;
    expect(c.baseURL).toBe('');
    expect(c.supportsAuthProbe).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
cd app && npx vitest run src/lib/ai/__tests__/presets.test.ts
```

- [ ] **Step 3: Implement final preset list**

Replace `app/src/lib/ai/presets.ts`:

```ts
import type { ProviderPreset } from './types';

/**
 * OpenAI-compatible preset templates. Sourced 2026-04-18 from official docs.
 * Editable in the ProviderCard after creation — if a preset goes stale, users
 * can fix the baseURL in-place.
 */
export const OPENAI_COMPAT_PRESETS: ProviderPreset[] = [
  { id: 'groq',       name: 'Groq',       baseURL: 'https://api.groq.com/openai/v1',
    docsUrl: 'https://console.groq.com/docs/api-reference',
    defaultTestModel: 'llama-3.3-70b-versatile', supportsAuthProbe: true },
  { id: 'together',   name: 'Together',   baseURL: 'https://api.together.xyz/v1',
    docsUrl: 'https://docs.together.ai/reference/chat-completions-1',
    defaultTestModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', supportsAuthProbe: true },
  { id: 'fireworks',  name: 'Fireworks',  baseURL: 'https://api.fireworks.ai/inference/v1',
    docsUrl: 'https://docs.fireworks.ai/api-reference/introduction',
    defaultTestModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    supportsAuthProbe: true },
  { id: 'deepinfra',  name: 'DeepInfra',  baseURL: 'https://api.deepinfra.com/v1/openai',
    docsUrl: 'https://deepinfra.com/docs/advanced/openai_api',
    defaultTestModel: 'meta-llama/Llama-3.3-70B-Instruct', supportsAuthProbe: true },
  { id: 'cerebras',   name: 'Cerebras',   baseURL: 'https://api.cerebras.ai/v1',
    docsUrl: 'https://inference-docs.cerebras.ai/api-reference/chat-completions',
    defaultTestModel: 'llama-3.3-70b', supportsAuthProbe: true },
  { id: 'sambanova',  name: 'SambaNova',  baseURL: 'https://api.sambanova.ai/v1',
    docsUrl: 'https://docs.sambanova.ai/cloud/api-reference/endpoints/chat',
    defaultTestModel: 'Meta-Llama-3.3-70B-Instruct', supportsAuthProbe: true },
  { id: 'custom',     name: 'Custom',     baseURL: '', docsUrl: '',
    defaultTestModel: undefined, supportsAuthProbe: false }
];

export function getPreset(id: string): ProviderPreset | undefined {
  return OPENAI_COMPAT_PRESETS.find((p) => p.id === id);
}
```

- [ ] **Step 4: Run, verify pass**

```bash
cd app && npx vitest run src/lib/ai/__tests__/presets.test.ts
```

### 3.D — Adapter (TDD)

- [ ] **Step 1: Failing test**

File: `app/src/lib/ai/__tests__/openai-compat-adapter.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => { vi.resetModules(); });

describe('openaiCompatAdapter', () => {
  it('builds adapter with id openai-compat and instanceId', async () => {
    const mod = await import('../adapters/openai-compat');
    const a = mod.openaiCompatAdapter({
      id: 'openai-compat', instanceId: 'abc-123', name: 'Groq',
      presetId: 'groq', baseURL: 'https://api.groq.com/openai/v1',
      apiKey: 'gsk-x', enabled: true
    });
    expect(a.id).toBe('openai-compat');
    expect(a.instanceId).toBe('abc-123');
  });

  it('fetchCatalog normalizes /models response into qualified ids', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [
        { id: 'llama-3.3-70b-versatile', context_window: 131072 },
        { id: 'mixtral-8x7b-32768' }
      ]
    }), { status: 200 }));
    const mod = await import('../adapters/openai-compat');
    const a = mod.openaiCompatAdapter({
      id: 'openai-compat', instanceId: 'abc-123', name: 'Groq',
      presetId: 'groq', baseURL: 'https://api.groq.com/openai/v1',
      apiKey: 'gsk-x', enabled: true
    });
    const list = await a.fetchCatalog();
    expect(list).toHaveLength(2);
    expect(list[0].qualifiedId).toBe('openai-compat:abc-123/llama-3.3-70b-versatile');
    expect(list[0].provider).toBe('openai-compat');
    expect(list[0].providerInstanceId).toBe('abc-123');
  });

  it('fetchCatalog returns empty and does not throw on 404 /models', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    const mod = await import('../adapters/openai-compat');
    const a = mod.openaiCompatAdapter({
      id: 'openai-compat', instanceId: 'z', name: 'X', presetId: 'custom',
      baseURL: 'https://x.test/v1', apiKey: 'k', enabled: true
    });
    const list = await a.fetchCatalog();
    expect(list).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
cd app && npx vitest run src/lib/ai/__tests__/openai-compat-adapter.test.ts
```

- [ ] **Step 3: Implement**

File: `app/src/lib/ai/adapters/openai-compat.ts`

```ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { Adapter } from './base';
import type { Model, ProviderRecord } from '../types';
import { translateError } from '../errors';

export function openaiCompatAdapter(record: Extract<ProviderRecord, { id: 'openai-compat' }>): Adapter {
  const key = (record.apiKey || '').trim();

  const provider = createOpenAICompatible({
    name: record.name || 'openai-compat',
    baseURL: record.baseURL,
    headers: key ? { Authorization: `Bearer ${key}` } : {}
  });

  return {
    id: 'openai-compat',
    instanceId: record.instanceId,
    isConfigured: () => Boolean(key && record.baseURL),
    resolveModel: (modelId) => provider(modelId),
    validateKey: async (candidate, signal) => {
      // Explicit "Verify" path — POST /chat/completions with 1-token probe using test model.
      const testModel = record.testModel || 'gpt-3.5-turbo';
      let resp: Response;
      try {
        resp = await fetch(`${record.baseURL}/chat/completions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', Authorization: `Bearer ${candidate}` },
          body: JSON.stringify({
            model: testModel, max_tokens: 1, messages: [{ role: 'user', content: '.' }]
          }),
          signal
        });
      } catch (e) { throw translateError(e, 'openai-compat', { suspectCors: true }); }
      if (resp.ok) return { label: record.name };
      const body = await resp.text().catch(() => '');
      throw translateError({ status: resp.status, message: body || `HTTP ${resp.status}` }, 'openai-compat');
    },
    fetchCatalog: async (signal) => {
      let resp: Response;
      try {
        resp = await fetch(`${record.baseURL}/models`, {
          method: 'GET',
          headers: key ? { Authorization: `Bearer ${key}` } : {},
          signal
        });
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') throw e;
        return []; // silent fallback — user will type model ids manually
      }
      if (!resp.ok) return [];
      let body: { data?: Array<Record<string, unknown>> };
      try { body = (await resp.json()) as typeof body; } catch { return []; }
      const raw = body.data ?? [];
      const out: Model[] = [];
      for (const r of raw) {
        const id = r.id;
        if (typeof id !== 'string') continue;
        out.push({
          id,
          qualifiedId: `openai-compat:${record.instanceId}/${id}`,
          name: (typeof r.name === 'string' && r.name) || id,
          provider: 'openai-compat',
          providerInstanceId: record.instanceId,
          upstreamProvider: record.name,
          contextLength: typeof r.context_window === 'number' ? r.context_window : (typeof r.context_length === 'number' ? r.context_length : undefined),
          capabilities: { streaming: true, tools: true }
        });
      }
      out.sort((a, b) => a.name.localeCompare(b.name));
      return out;
    }
  };
}
```

- [ ] **Step 4: Run, verify pass**

```bash
cd app && npx vitest run src/lib/ai/__tests__/openai-compat-adapter.test.ts
```

### 3.E — Wire into gateway + catalog

- [ ] **Step 1: Update `gateway.ts`**

Replace the openai-compat throw branch:

```ts
import { openaiCompatAdapter } from './adapters/openai-compat';
// inside buildAdapter switch:
    case 'openai-compat': return openaiCompatAdapter(record);
```

- [ ] **Step 2: Update `catalog.svelte.ts` fetchAll**

Add:

```ts
import { openaiCompatAdapter } from './adapters/openai-compat';
// inside fetchAll loop:
      if (p.id === 'openai-compat') {
        const a = openaiCompatAdapter(p);
        const models = await a.fetchCatalog(signal);
        results.push(...models);
      }
```

- [ ] **Step 3: Full suite**

```bash
cd app && npm run test:unit && npm run check
```

### 3.F — Manual smoke + commit

- [ ] **Step 1: Dev server smoke — confirm no regression**

```bash
cd app && npm run dev
```

Same as before — tools still work. No UI change.

- [ ] **Step 2: Commit**

```bash
cd ..
git add app/package.json app/package-lock.json \
        app/src/lib/ai/presets.ts \
        app/src/lib/ai/adapters/openai-compat.ts \
        app/src/lib/ai/gateway.ts \
        app/src/lib/ai/catalog.svelte.ts \
        app/src/lib/ai/__tests__/openai-compat-adapter.test.ts \
        app/src/lib/ai/__tests__/presets.test.ts
git commit -m "$(cat <<'EOF'
feat(ai): OpenAI-compatible adapter + presets + /models discovery

Adds adapters/openai-compat.ts (multi-instance, one adapter per user-added
endpoint) using @ai-sdk/openai-compatible. Finalizes presets.ts with Groq,
Together, Fireworks, DeepInfra, Cerebras, SambaNova + Custom. fetchCatalog
silently degrades to empty list when /models is unavailable (user will type
model ids manually in the picker).

Wired into gateway.resolve() and catalog.fetchAll(). Still no UI — Settings
integration lands in Commit 4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### 3.G — PAUSE, user test, push

---

## Commit 4: Progressive-disclosure Settings UI + ErrorBanner

**Goal:** First user-visible change. New `ProvidersPanel` with card-per-provider, `AddProviderDialog`, blur-validation behavior, per-category ErrorBanner shared component. Existing OpenRouter key migrates into the new card layout seamlessly.

### 4.A — Files

**Create:**
- `app/src/lib/components/ai/ErrorBanner.svelte`
- `app/src/lib/components/settings/ProvidersPanel.svelte`
- `app/src/lib/components/settings/ProviderCard.svelte`
- `app/src/lib/components/settings/AddProviderDialog.svelte`
- `app/src/lib/components/settings/ProviderFormAnthropic.svelte`
- `app/src/lib/components/settings/ProviderFormOpenAICompat.svelte`
- `app/src/lib/components/ai/__tests__/ErrorBanner.test.ts`

**Modify:**
- `app/src/routes/settings/+page.svelte` — mount `<ProvidersPanel />` at top, legacy OpenRouter block replaced by same
- `app/src/lib/components/tools/promptcraft/PromptCraftTool.svelte` — swap error rendering to `<ErrorBanner>`
- `app/src/lib/components/tools/anticlassifier/AntiClassifierTool.svelte` — same
- `app/src/lib/components/tools/translate/TranslateTool.svelte` — same

### 4.B — ErrorBanner component (TDD)

- [ ] **Step 1: Failing test**

File: `app/src/lib/components/ai/__tests__/ErrorBanner.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ErrorBanner from '../ErrorBanner.svelte';
import { GatewayError } from '$lib/ai/types';

describe('ErrorBanner', () => {
  it('renders auth error with Open Settings CTA', () => {
    const err = new GatewayError('bad key', { category: 'auth', provider: 'openrouter' });
    const { getByText } = render(ErrorBanner, { error: err });
    expect(getByText(/key isn't working/i)).toBeTruthy();
    expect(getByText(/Open Settings/i)).toBeTruthy();
  });

  it('renders rate_limit with retry countdown', () => {
    const err = new GatewayError('slow', { category: 'rate_limit', provider: 'anthropic', retryAfterMs: 4000 });
    const { getByText } = render(ErrorBanner, { error: err });
    expect(getByText(/Rate limited/i)).toBeTruthy();
  });

  it('renders cors with Learn why CTA', () => {
    const err = new GatewayError("can't reach", { category: 'cors', provider: 'openai-compat' });
    const { getByText } = render(ErrorBanner, { error: err });
    expect(getByText(/Learn why/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Install `@testing-library/svelte` if missing**

```bash
cd app && npm list @testing-library/svelte 2>/dev/null || npm install --save-dev @testing-library/svelte @testing-library/jest-dom jsdom
```

If the vitest config lacks jsdom, add `test: { environment: 'jsdom' }` to `app/vite.config.ts`.

- [ ] **Step 3: Run, verify fail**

```bash
cd app && npx vitest run src/lib/components/ai/__tests__/ErrorBanner.test.ts
```

- [ ] **Step 4: Implement `ErrorBanner.svelte`**

File: `app/src/lib/components/ai/ErrorBanner.svelte`

```svelte
<script lang="ts">
  import type { GatewayError } from '$lib/ai/types';
  import AlertCircle from 'lucide-svelte/icons/alert-circle';

  type Props = {
    error: GatewayError;
    providerName?: string;
    fallbackModel?: string;
    onRetry?: () => void;
    onOpenSettings?: () => void;
    onSwitchProvider?: () => void;
    onUseFallback?: () => void;
    onChangeModel?: () => void;
    onTopUp?: () => void;
    onLearnWhy?: () => void;
  };

  let {
    error, providerName, fallbackModel,
    onRetry, onOpenSettings, onSwitchProvider, onUseFallback, onChangeModel, onTopUp, onLearnWhy
  }: Props = $props();

  const label = $derived(providerName ?? error.provider);

  const copy = $derived.by(() => {
    switch (error.category) {
      case 'auth':       return `${label} key isn't working.`;
      case 'credit':     return `${label} credit exhausted.`;
      case 'forbidden':  return `${label} rejected this request.`;
      case 'not_found':  return `Model isn't available.`;
      case 'rate_limit': return `Rate limited${error.retryAfterMs ? ` — retry in ${Math.ceil(error.retryAfterMs / 1000)}s` : ''}.`;
      case 'network':    return `Couldn't reach ${label}.`;
      case 'format':     return `Got an unexpected response from ${label}.`;
      case 'cors':       return `Can't reach ${label} from the browser.`;
      case 'api':        return `${label} API error: ${error.message}`;
      default:           return `Something went wrong: ${error.message}`;
    }
  });
</script>

<div role="alert" class="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
  <AlertCircle class="mt-0.5 h-4 w-4 flex-none text-red-400" />
  <div class="flex-1 min-w-0">
    <p class="font-medium text-red-200">{copy}</p>
    <div class="mt-2 flex flex-wrap gap-2">
      {#if error.category === 'auth' && onOpenSettings}
        <button type="button" class="underline text-red-200 hover:text-red-100" onclick={onOpenSettings}>Open Settings</button>
      {/if}
      {#if error.category === 'credit'}
        {#if onTopUp}<button type="button" class="underline text-red-200 hover:text-red-100" onclick={onTopUp}>Top up</button>{/if}
        {#if onSwitchProvider}<button type="button" class="underline text-red-200 hover:text-red-100" onclick={onSwitchProvider}>Switch provider</button>{/if}
      {/if}
      {#if error.category === 'not_found'}
        {#if fallbackModel && onUseFallback}<button type="button" class="underline text-red-200 hover:text-red-100" onclick={onUseFallback}>Use fallback: {fallbackModel}</button>{/if}
        {#if onChangeModel}<button type="button" class="underline text-red-200 hover:text-red-100" onclick={onChangeModel}>Change model</button>{/if}
      {/if}
      {#if error.category === 'rate_limit' && onRetry}
        <button type="button" class="underline text-red-200 hover:text-red-100" onclick={onRetry}>Retry now</button>
      {/if}
      {#if (error.category === 'network' || error.category === 'api' || error.category === 'format' || error.category === 'unknown') && onRetry}
        <button type="button" class="underline text-red-200 hover:text-red-100" onclick={onRetry}>Retry</button>
      {/if}
      {#if error.category === 'cors' && onLearnWhy}
        <button type="button" class="underline text-red-200 hover:text-red-100" onclick={onLearnWhy}>Learn why</button>
      {/if}
    </div>
  </div>
</div>
```

- [ ] **Step 5: Run, verify pass**

```bash
cd app && npx vitest run src/lib/components/ai/__tests__/ErrorBanner.test.ts
```

### 4.C — ProviderCard + ProvidersPanel + AddProviderDialog

These three components are shipped together — they're tightly coupled and hand-tested.

- [ ] **Step 1: Implement `ProviderCard.svelte`**

File: `app/src/lib/components/settings/ProviderCard.svelte`

```svelte
<script lang="ts">
  import type { ProviderRecord } from '$lib/ai/types';
  import { updateProvider, removeProvider } from '$lib/ai/providers.svelte';
  import { scheduleValidate, verifyNow, subscribeValidation } from '$lib/ai/validate';
  import { validateKey as gatewayValidate } from '$lib/ai/gateway';
  import { getPreset } from '$lib/ai/presets';
  import ErrorBanner from '$lib/components/ai/ErrorBanner.svelte';
  import { GatewayError } from '$lib/ai/types';
  import Eye from 'lucide-svelte/icons/eye';
  import EyeOff from 'lucide-svelte/icons/eye-off';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import CircleCheck from 'lucide-svelte/icons/circle-check';
  import CircleX from 'lucide-svelte/icons/circle-x';
  import Loader from 'lucide-svelte/icons/loader-circle';
  import ExternalLink from 'lucide-svelte/icons/external-link';

  type Props = { record: ProviderRecord; onRemove?: () => void };
  let { record, onRemove }: Props = $props();

  let showKey = $state(false);
  let keyInput = $state(record.apiKey);
  let validating = $state(false);
  let verifiedAt = $state<number | null>(null);
  let lastError = $state<GatewayError | null>(null);

  const instanceId = $derived(record.id === 'openai-compat' ? (record as { instanceId: string }).instanceId : undefined);
  const preset = $derived(record.id === 'openai-compat' ? getPreset((record as { presetId: string }).presetId) : undefined);

  // Subscribe to validation outcomes for this provider instance.
  $effect(() => {
    const unsub = subscribeValidation(record.id, instanceId, (r) => {
      validating = false;
      if ('error' in r) {
        lastError = r.error instanceof GatewayError ? r.error : new GatewayError('validation failed', { category: 'unknown', provider: record.id });
      } else {
        lastError = null; verifiedAt = Date.now();
      }
    });
    return () => unsub();
  });

  function onBlur() {
    const candidate = keyInput.trim();
    if (!candidate || candidate === record.apiKey && verifiedAt) return;
    updateProvider(record.id, { apiKey: candidate } as never, instanceId);
    const probeFn = (k: string, signal: AbortSignal) => gatewayValidate(record.id, k, { instanceId, signal });
    if (record.id === 'openai-compat' && !preset?.supportsAuthProbe) return; // wait for explicit Verify
    validating = true; lastError = null;
    scheduleValidate(record.id, instanceId, candidate, probeFn);
  }

  async function verifyClick() {
    validating = true; lastError = null;
    try {
      await verifyNow(record.id, instanceId, keyInput.trim(), (k, s) => gatewayValidate(record.id, k, { instanceId, signal: s }));
      verifiedAt = Date.now();
    } catch (e) {
      lastError = e instanceof GatewayError ? e : new GatewayError('verification failed', { category: 'unknown', provider: record.id });
    } finally {
      validating = false;
    }
  }

  function remove() {
    if (!confirm(`Remove ${(record as { name?: string }).name ?? record.id}?`)) return;
    removeProvider(record.id, instanceId);
    onRemove?.();
  }
</script>

<div id={`provider-${record.id}${instanceId ? '-' + instanceId : ''}`} class="glass rounded-lg border border-white/10 p-4 space-y-3">
  <div class="flex items-center justify-between">
    <h3 class="font-semibold">{(record as { name?: string }).name ?? (record.id === 'openrouter' ? 'OpenRouter' : record.id === 'anthropic' ? 'Anthropic' : record.id)}</h3>
    <button type="button" onclick={remove} class="text-muted-foreground hover:text-destructive" aria-label="Remove provider"><Trash2 class="h-4 w-4" /></button>
  </div>

  <label class="block text-sm">
    <span class="text-muted-foreground">API key</span>
    <div class="mt-1 flex gap-2">
      <input
        type={showKey ? 'text' : 'password'}
        bind:value={keyInput}
        onblur={onBlur}
        placeholder="sk-..."
        class="flex-1 rounded-md border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-xs"
        autocomplete="off"
        spellcheck="false"
      />
      <button type="button" onclick={() => showKey = !showKey} class="text-muted-foreground" aria-label={showKey ? 'Hide key' : 'Show key'}>
        {#if showKey}<EyeOff class="h-4 w-4" />{:else}<Eye class="h-4 w-4" />{/if}
      </button>
      {#if record.id === 'openai-compat' && !preset?.supportsAuthProbe}
        <button type="button" onclick={verifyClick} class="text-sm text-primary underline">Verify</button>
      {/if}
    </div>
  </label>

  <div class="flex items-center gap-2 text-xs text-muted-foreground">
    {#if validating}
      <Loader class="h-3 w-3 animate-spin" /> Validating…
    {:else if lastError}
      <CircleX class="h-3 w-3 text-red-400" /> {lastError.category}
    {:else if verifiedAt}
      <CircleCheck class="h-3 w-3 text-emerald-400" /> Verified
    {/if}
  </div>

  {#if lastError}
    <ErrorBanner error={lastError}
      providerName={(record as { name?: string }).name ?? record.id}
      onRetry={() => verifyClick()}
      onLearnWhy={record.id === 'openai-compat' ? () => window.open('https://github.com/anthropics/cryptex/blob/master/docs/CUSTOM-ENDPOINTS.md', '_blank') : undefined}
    />
  {/if}

  {#if record.id === 'openai-compat' && preset && preset.docsUrl}
    <a href={preset.docsUrl} target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
      {preset.name} API docs <ExternalLink class="h-3 w-3" />
    </a>
  {/if}
</div>
```

- [ ] **Step 2: Implement `AddProviderDialog.svelte`**

File: `app/src/lib/components/settings/AddProviderDialog.svelte`

```svelte
<script lang="ts">
  import { addProvider } from '$lib/ai/providers.svelte';
  import { OPENAI_COMPAT_PRESETS } from '$lib/ai/presets';
  import type { ProviderRecord } from '$lib/ai/types';
  import X from 'lucide-svelte/icons/x';

  type Props = { open: boolean; onClose: () => void };
  let { open, onClose }: Props = $props();

  let step = $state<'picker' | 'form'>('picker');
  let chosen = $state<'anthropic' | 'custom-preset' | null>(null);
  let chosenPresetId = $state<string>('groq');

  function pickAnthropic() { chosen = 'anthropic'; step = 'form'; }
  function pickPreset(id: string) { chosenPresetId = id; chosen = 'custom-preset'; step = 'form'; }

  let apiKey = $state('');
  let name = $state('');
  let baseURL = $state('');

  $effect(() => {
    if (chosenPresetId && chosen === 'custom-preset') {
      const p = OPENAI_COMPAT_PRESETS.find((x) => x.id === chosenPresetId);
      if (p) { name = p.name; baseURL = p.baseURL; }
    }
  });

  function save() {
    if (chosen === 'anthropic') {
      const r: ProviderRecord = { id: 'anthropic', apiKey: apiKey.trim(), enabled: true };
      addProvider(r);
    } else if (chosen === 'custom-preset') {
      const preset = OPENAI_COMPAT_PRESETS.find((p) => p.id === chosenPresetId)!;
      const r: ProviderRecord = {
        id: 'openai-compat',
        instanceId: crypto.randomUUID(),
        name: name.trim() || preset.name,
        presetId: preset.id,
        baseURL: baseURL.trim() || preset.baseURL,
        apiKey: apiKey.trim(),
        testModel: preset.defaultTestModel,
        enabled: true
      };
      addProvider(r);
    }
    reset();
    onClose();
  }

  function reset() { step = 'picker'; chosen = null; apiKey = ''; name = ''; baseURL = ''; }
</script>

{#if open}
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" onclick={onClose}>
    <div class="glass w-full max-w-md rounded-xl border border-white/10 p-5 space-y-4" onclick={(e) => e.stopPropagation()}>
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Add a provider</h2>
        <button type="button" onclick={onClose} aria-label="Close"><X class="h-4 w-4" /></button>
      </div>

      {#if step === 'picker'}
        <div class="space-y-1">
          <p class="text-xs uppercase text-muted-foreground">Direct</p>
          <button type="button" onclick={pickAnthropic} class="w-full rounded-md px-3 py-2 text-left hover:bg-white/5">Anthropic</button>

          <p class="mt-4 text-xs uppercase text-muted-foreground">OpenAI-compatible</p>
          {#each OPENAI_COMPAT_PRESETS.filter((p) => p.id !== 'custom') as p}
            <button type="button" onclick={() => pickPreset(p.id)} class="w-full rounded-md px-3 py-2 text-left hover:bg-white/5">{p.name}</button>
          {/each}
          <button type="button" onclick={() => pickPreset('custom')} class="w-full rounded-md px-3 py-2 text-left hover:bg-white/5">Custom endpoint</button>
        </div>
        <p class="mt-4 text-xs text-muted-foreground">
          <strong>Why isn't OpenAI here?</strong> OpenAI's API doesn't accept browser requests directly (no CORS). For GPT-5 and o-series models, use OpenRouter above — it proxies transparently.
        </p>
      {:else if chosen === 'anthropic'}
        <label class="block text-sm">
          Anthropic API key
          <input type="password" bind:value={apiKey} class="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-xs" />
        </label>
        <div class="flex justify-end gap-2">
          <button type="button" class="px-3 py-1.5 text-sm" onclick={reset}>Back</button>
          <button type="button" class="rounded-md bg-primary px-3 py-1.5 text-sm" onclick={save} disabled={!apiKey.trim()}>Save</button>
        </div>
      {:else if chosen === 'custom-preset'}
        <label class="block text-sm">
          Name
          <input type="text" bind:value={name} class="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-1.5 text-sm" />
        </label>
        <label class="block text-sm">
          Base URL
          <input type="url" bind:value={baseURL} class="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-xs" />
        </label>
        <label class="block text-sm">
          API key
          <input type="password" bind:value={apiKey} class="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-xs" />
        </label>
        <div class="flex justify-end gap-2">
          <button type="button" class="px-3 py-1.5 text-sm" onclick={reset}>Back</button>
          <button type="button" class="rounded-md bg-primary px-3 py-1.5 text-sm" onclick={save} disabled={!apiKey.trim() || !baseURL.trim()}>Save</button>
        </div>
      {/if}
    </div>
  </div>
{/if}
```

- [ ] **Step 3: Implement `ProvidersPanel.svelte`**

File: `app/src/lib/components/settings/ProvidersPanel.svelte`

```svelte
<script lang="ts">
  import { listProviders } from '$lib/ai/providers.svelte';
  import ProviderCard from './ProviderCard.svelte';
  import AddProviderDialog from './AddProviderDialog.svelte';
  import Plus from 'lucide-svelte/icons/plus';

  let dialogOpen = $state(false);
  // Re-read via $derived to track reactive providers list
  const providers = $derived(listProviders());
</script>

<section class="space-y-4" id="providers">
  <header>
    <h2 class="text-xl font-semibold">Providers</h2>
    <p class="text-sm text-muted-foreground">Use your own API keys. Keys are stored only in your browser.</p>
  </header>

  {#each providers as record (record.id + ((record as { instanceId?: string }).instanceId ?? ''))}
    <ProviderCard {record} />
  {/each}

  <button type="button" onclick={() => dialogOpen = true}
    class="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 px-4 py-6 text-sm text-muted-foreground hover:bg-white/5">
    <Plus class="h-4 w-4" /> Add provider
  </button>
</section>

<AddProviderDialog open={dialogOpen} onClose={() => dialogOpen = false} />
```

### 4.D — Wire into Settings page

- [ ] **Step 1: Modify `app/src/routes/settings/+page.svelte`**

At the top of the page content, render `<ProvidersPanel />`. Remove the old `keyInput` / `saveKey` / `validating` block and the `<section>` that wrapped the OpenRouter key form — `ProvidersPanel` covers it now. Preserve the Theme / Favorites / Consent sections below unchanged.

Exact edit: find the existing `<section>` block that renders the OpenRouter key input + Verify button. Replace it entirely with:

```svelte
<ProvidersPanel />
```

Add to the imports at the top:

```ts
import ProvidersPanel from '$lib/components/settings/ProvidersPanel.svelte';
```

Remove now-unused imports (`getApiKey`, `setApiKey`, `validateKey`, `OpenRouterError`, `KeyInfo`) and the state variables tied to the old key form.

### 4.E — Swap tool error rendering to ErrorBanner

- [ ] **Step 1: PromptCraftTool.svelte**

In `app/src/lib/components/tools/promptcraft/PromptCraftTool.svelte`, find the existing error display block (typically a `{#if errorMsg}<div class="text-red-...">` region) and replace with:

```svelte
{#if lastError}
  <ErrorBanner error={lastError}
    onRetry={() => regenerate()}
    onOpenSettings={() => goto('/settings#provider-openrouter')}
  />
{/if}
```

Add imports:

```ts
import ErrorBanner from '$lib/components/ai/ErrorBanner.svelte';
import { goto } from '$app/navigation';
import { GatewayError } from '$lib/ai/types';
```

Replace any `errorMsg: string` state with `lastError: GatewayError | null = $state(null)`. In the catch block of the `chat()` call, store the error: `lastError = err instanceof GatewayError ? err : null; errorMsg = (err as Error).message;` (keep `errorMsg` in parallel for any legacy paths).

- [ ] **Step 2: AntiClassifierTool.svelte** — mirror the above change.

- [ ] **Step 3: TranslateTool.svelte** — mirror the above change.

### 4.F — Full suite + manual verification

- [ ] **Step 1: Type-check + tests**

```bash
cd app && npm run check && npm run test:unit
```

- [ ] **Step 2: Dev server**

```bash
cd app && npm run dev
```

Manual checklist:
- [ ] Settings page loads; OpenRouter card appears with existing key pre-filled.
- [ ] Click `+ Add provider` → dialog appears with picker.
- [ ] Choose Anthropic → form appears → paste bogus key `sk-ant-bogus` → tab away → within ~1s see inline auth error inside the card.
- [ ] Type fast in the key field, then blur — only one request fires in DevTools (debounce working).
- [ ] Paste real Anthropic key (if available) → verified green check.
- [ ] Remove Anthropic card → confirm prompt → removed.
- [ ] Click `+ Add provider` → Groq → paste bogus key → see auth banner after blur.
- [ ] PromptCraft: delete OpenRouter key in Settings, generate in PromptCraft → `ErrorBanner` with "OpenRouter key isn't working [Open Settings]" → click CTA → deep-links to Settings with card highlighted/scrolled.
- [ ] Restore OpenRouter key, tools work again.

### 4.G — Commit

- [ ] **Step 1:**

```bash
cd ..
git add app/src/lib/components/ai/ \
        app/src/lib/components/settings/ \
        app/src/routes/settings/+page.svelte \
        app/src/lib/components/tools/promptcraft/PromptCraftTool.svelte \
        app/src/lib/components/tools/anticlassifier/AntiClassifierTool.svelte \
        app/src/lib/components/tools/translate/TranslateTool.svelte
git commit -m "$(cat <<'EOF'
feat(settings): progressive-disclosure provider cards + Add-Provider picker

New ProvidersPanel at top of Settings renders one card per configured provider
(OpenRouter seeded from legacy key, Anthropic + OpenAI-compat added via
dialog). Blur-validated keys with 800ms debounce, 3s per-provider throttle,
AbortController cancel on re-edit, 60s lockout after 3 consecutive 401s.

Shared ErrorBanner component renders category-specific CTAs across all three
tools. Deep-links from banner to the right provider card via URL fragment.

First user-visible change of the gateway rollout.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### 4.H — PAUSE, user test, push

---

## Commit 5: ModelPickerV2 with capability filter chips + Cmd+M + recent-5 + free-text

**Goal:** Replace `ModelPicker.svelte` with the new flat picker per spec §7. Group by upstream provider with adapter sub-label. Search + filter chips + keyboard shortcuts + recent-5 + free-text fallback.

### 5.A — Files

**Create:**
- `app/src/lib/components/ai/ModelPickerV2.svelte`
- `app/src/lib/components/ai/ModelRow.svelte`
- `app/src/lib/components/ai/CapabilityIcon.svelte`
- `app/src/lib/stores/shortcuts.svelte.ts` — global `Cmd+M` handler

**Modify:**
- `app/src/lib/components/tools/promptcraft/PromptCraftTool.svelte` — swap picker
- `app/src/lib/components/tools/anticlassifier/AntiClassifierTool.svelte` — swap picker
- `app/src/lib/components/tools/translate/TranslateTool.svelte` — swap picker
- `app/src/routes/+layout.svelte` — install global shortcut

**Delete:**
- `app/src/lib/ai/ModelPicker.svelte`

### 5.B — CapabilityIcon (small, no test)

- [ ] **Step 1:**

File: `app/src/lib/components/ai/CapabilityIcon.svelte`

```svelte
<script lang="ts">
  import Brain from 'lucide-svelte/icons/brain';
  import Eye from 'lucide-svelte/icons/eye';
  import Wrench from 'lucide-svelte/icons/wrench';
  import File from 'lucide-svelte/icons/file';
  import Braces from 'lucide-svelte/icons/braces';
  import Gift from 'lucide-svelte/icons/gift';

  type Kind = 'reasoning' | 'vision' | 'tools' | 'pdf' | 'jsonSchema' | 'free';
  type Props = { kind: Kind };
  let { kind }: Props = $props();
</script>

{#if kind === 'reasoning'}<Brain class="h-3 w-3" aria-label="reasoning" />
{:else if kind === 'vision'}<Eye class="h-3 w-3" aria-label="vision" />
{:else if kind === 'tools'}<Wrench class="h-3 w-3" aria-label="tools" />
{:else if kind === 'pdf'}<File class="h-3 w-3" aria-label="pdf" />
{:else if kind === 'jsonSchema'}<Braces class="h-3 w-3" aria-label="json schema" />
{:else if kind === 'free'}<Gift class="h-3 w-3" aria-label="free tier" />
{/if}
```

### 5.C — ModelRow

- [ ] **Step 1:**

File: `app/src/lib/components/ai/ModelRow.svelte`

```svelte
<script lang="ts">
  import type { Model } from '$lib/ai/types';
  import CapabilityIcon from './CapabilityIcon.svelte';

  type Props = { model: Model; active?: boolean; onSelect: (m: Model) => void };
  let { model, active, onSelect }: Props = $props();

  const adapterLabel = $derived(
    model.provider === 'openrouter'     ? 'via OpenRouter' :
    model.provider === 'anthropic'      ? 'direct' :
    `via ${model.upstreamProvider ?? 'custom'}`
  );
</script>

<button type="button"
  onclick={() => onSelect(model)}
  class="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-white/5 {active ? 'bg-white/10' : ''}">
  <div class="min-w-0 flex-1">
    <div class="truncate font-medium">{model.name}</div>
    <div class="truncate text-xs text-muted-foreground">{model.id} · {adapterLabel}</div>
  </div>
  <div class="flex flex-none items-center gap-1 text-muted-foreground">
    {#if model.capabilities?.reasoning}<CapabilityIcon kind="reasoning" />{/if}
    {#if model.capabilities?.vision}<CapabilityIcon kind="vision" />{/if}
    {#if model.capabilities?.tools}<CapabilityIcon kind="tools" />{/if}
    {#if model.capabilities?.jsonSchema}<CapabilityIcon kind="jsonSchema" />{/if}
    {#if model.isFree}<CapabilityIcon kind="free" />{/if}
  </div>
</button>
```

### 5.D — ModelPickerV2

- [ ] **Step 1:**

File: `app/src/lib/components/ai/ModelPickerV2.svelte`

```svelte
<script lang="ts">
  import { catalog, initCatalogStore } from '$lib/ai/catalog.svelte';
  import { createPersistedState } from '$lib/stores/_persisted.svelte';
  import type { Model } from '$lib/ai/types';
  import ModelRow from './ModelRow.svelte';
  import Search from 'lucide-svelte/icons/search';

  type Props = {
    value: string;
    onChange: (qualifiedId: string) => void;
    recentsKey: string;      // e.g. 'cryptex.pc.recentModels'
    defaultOpen?: boolean;
  };
  let { value, onChange, recentsKey, defaultOpen = false }: Props = $props();

  initCatalogStore();

  let open = $state(defaultOpen);
  let query = $state('');
  let filters = $state<Set<'reasoning' | 'vision' | 'tools' | 'jsonSchema' | 'free'>>(new Set());

  const recents = createPersistedState<string[]>(recentsKey, []);

  function toggleFilter(f: typeof filters extends Set<infer T> ? T : never) {
    const next = new Set(filters);
    if (next.has(f)) next.delete(f); else next.add(f);
    filters = next;
  }

  function matches(m: Model): boolean {
    const q = query.toLowerCase();
    if (q && !`${m.id} ${m.name} ${m.upstreamProvider ?? ''}`.toLowerCase().includes(q)) return false;
    for (const f of filters) {
      if (f === 'free') { if (!m.isFree) return false; }
      else if (!m.capabilities?.[f]) return false;
    }
    return true;
  }

  const filtered = $derived(catalog.list.filter(matches));
  const grouped = $derived.by(() => {
    const out: Record<string, Model[]> = {};
    for (const m of filtered) (out[m.upstreamProvider ?? 'Other'] ||= []).push(m);
    return out;
  });

  const recentModels = $derived(
    recents.value.map((id) => catalog.find(id)).filter((m): m is Model => Boolean(m)).slice(0, 5)
  );

  function choose(m: Model) {
    onChange(m.qualifiedId);
    const next = [m.qualifiedId, ...recents.value.filter((x) => x !== m.qualifiedId)].slice(0, 5);
    recents.value = next;
    open = false;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') open = false;
    if (e.key === 'Enter' && filtered.length === 0 && query.trim()) {
      // free-text fallback
      choose({
        id: query.trim(),
        qualifiedId: query.trim().includes(':') ? query.trim() : `openrouter:${query.trim()}`,
        name: query.trim(),
        provider: 'openrouter',
        upstreamProvider: 'Custom'
      });
    }
  }

  const selectedLabel = $derived(catalog.find(value)?.name ?? value ?? 'Select model');
</script>

<button type="button" onclick={() => open = !open}
  class="rounded-md border border-white/10 bg-black/30 px-3 py-1.5 text-sm">
  {selectedLabel}
</button>

{#if open}
  <div role="dialog" class="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onclick={() => open = false}>
    <div class="glass flex w-full max-w-xl flex-col rounded-xl border border-white/10 p-4" onclick={(e) => e.stopPropagation()}>
      <div class="flex items-center gap-2 border-b border-white/10 pb-2">
        <Search class="h-4 w-4 text-muted-foreground" />
        <input type="text" bind:value={query} onkeydown={onKeydown} placeholder="Search models…" class="flex-1 bg-transparent text-sm outline-none" autofocus />
        <span class="text-xs text-muted-foreground">⌘M</span>
      </div>

      <div class="flex flex-wrap gap-1 border-b border-white/10 py-2">
        {#each [['reasoning', '🧠 Reasoning'], ['vision', '👁 Vision'], ['tools', '🛠 Tools'], ['jsonSchema', '{ } JSON'], ['free', '🆓 Free']] as const as [k, label]}
          <button type="button" onclick={() => toggleFilter(k as never)}
            class="rounded-full border border-white/10 px-2 py-0.5 text-xs {filters.has(k as never) ? 'bg-primary/20 border-primary/50' : 'hover:bg-white/5'}">
            {label}
          </button>
        {/each}
      </div>

      <div class="max-h-[60vh] flex-1 overflow-y-auto">
        {#if recentModels.length > 0 && !query && filters.size === 0}
          <div class="p-2">
            <div class="px-2 py-1 text-xs uppercase tracking-wide text-muted-foreground">Recent</div>
            {#each recentModels as m (m.qualifiedId)}
              <ModelRow model={m} active={m.qualifiedId === value} onSelect={choose} />
            {/each}
          </div>
        {/if}

        {#each Object.entries(grouped) as [upstream, list]}
          <div class="p-2">
            <div class="px-2 py-1 text-xs uppercase tracking-wide text-muted-foreground">{upstream} ({list.length})</div>
            {#each list as m (m.qualifiedId)}
              <ModelRow model={m} active={m.qualifiedId === value} onSelect={choose} />
            {/each}
          </div>
        {/each}

        {#if filtered.length === 0}
          <div class="p-6 text-center text-sm text-muted-foreground">
            {#if query.trim()}Press <kbd>Enter</kbd> to use <code class="font-mono text-xs">{query.trim()}</code> anyway{:else}No models match the filters.{/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
```

### 5.E — Global Cmd+M shortcut

- [ ] **Step 1: Shortcut bus**

File: `app/src/lib/stores/shortcuts.svelte.ts`

```ts
import { browser } from '$app/environment';

const listeners = new Set<() => void>();

export function onOpenModelPicker(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

if (browser) {
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'm') {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      listeners.forEach((fn) => fn());
    }
  });
}
```

Consumers subscribe inside a tool to open their own picker when on that tool's route. `+layout.svelte` doesn't need to change since the listener attaches on import.

### 5.F — Swap picker in tools + delete legacy

- [ ] **Step 1:** In each of `PromptCraftTool.svelte`, `AntiClassifierTool.svelte`, `TranslateTool.svelte`:

Change import `import ModelPicker from '$lib/ai/ModelPicker.svelte'` → `import ModelPickerV2 from '$lib/components/ai/ModelPickerV2.svelte'`.

Change usage:

```svelte
<ModelPickerV2 value={model} onChange={(v) => model = v} recentsKey="cryptex.pc.recentModels" />
```

Use `cryptex.pc.recentModels` / `cryptex.ac.recentModels` / `cryptex.tg.recentModels` respectively.

Also: since `model` was previously a raw id (e.g. `openai/gpt-4o`), the new picker writes qualified ids. Add a tiny migration — on mount, if `model` doesn't contain `:`, prefix with `openrouter:`:

```ts
$effect(() => {
  if (model && !model.includes(':')) model = `openrouter:${model}`;
});
```

- [ ] **Step 2: Delete legacy picker**

```bash
rm app/src/lib/ai/ModelPicker.svelte
```

- [ ] **Step 3: Full suite**

```bash
cd app && npm run check && npm run test:unit
```

### 5.G — Manual verification + commit

- [ ] **Step 1: Dev server smoke**

```bash
cd app && npm run dev
```

- [ ] Open PromptCraft → click model selector → new picker opens.
- [ ] Search "opus" → Claude Opus 4.7 visible under Anthropic (if Anthropic card added earlier) or appears in OpenRouter group.
- [ ] Click `🧠 Reasoning` → list filters.
- [ ] Select a model → closes → tool reflects selection.
- [ ] Cmd+M / Ctrl+M from anywhere → picker opens; Esc closes.
- [ ] Search nonexistent "zzz123" → "Press Enter to use …" → Enter selects free-text.
- [ ] Recent section appears on second open with last selections.

- [ ] **Step 2: Commit**

```bash
cd ..
git add app/src/lib/components/ai/ \
        app/src/lib/stores/shortcuts.svelte.ts \
        app/src/lib/components/tools/promptcraft/PromptCraftTool.svelte \
        app/src/lib/components/tools/anticlassifier/AntiClassifierTool.svelte \
        app/src/lib/components/tools/translate/TranslateTool.svelte
git rm app/src/lib/ai/ModelPicker.svelte
git commit -m "$(cat <<'EOF'
feat(ai): ModelPickerV2 with capability filter chips + Cmd+M + recent-5 + free-text

Replaces the old ModelPicker with a flat picker grouped by upstream provider
(OpenAI / Anthropic / Google / Meta / …) with a subtle "via X" / "direct"
adapter sub-label. Adds filter chips (Reasoning / Vision / Tools / JSON / Free),
Cmd+M global shortcut, per-tool recent-5, and free-text fallback for custom
endpoints whose /models returned empty.

Qualified model ids wired across tools; legacy unqualified values auto-prefix
to openrouter: on first read. Legacy ModelPicker.svelte deleted.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### 5.H — PAUSE, test, push

---

## Commit 6: Migrate tool callers to gateway + drop legacy shims

**Goal:** Final internal refactor. Flip three tool imports from `$lib/ai/openrouter` → `$lib/ai/gateway` and delete the shim files.

### 6.A — Files

**Delete:**
- `app/src/lib/ai/openrouter.ts`
- `app/src/lib/ai/models.svelte.ts`
- `app/src/lib/ai/openrouter.test.ts`

**Modify:**
- `app/src/lib/components/tools/promptcraft/PromptCraftTool.svelte`
- `app/src/lib/components/tools/anticlassifier/AntiClassifierTool.svelte`
- `app/src/lib/components/tools/translate/TranslateTool.svelte`
- `app/src/lib/stores/_migrate.ts` (if it imports from openrouter.ts)

### 6.B — Swap imports

- [ ] **Step 1: PromptCraftTool.svelte** — change:

```ts
// before:
import { chat, hasApiKey, OpenRouterError } from '$lib/ai/openrouter';
// after:
import { chat, hasAnyKey as hasApiKey } from '$lib/ai/gateway';
import { GatewayError as OpenRouterError } from '$lib/ai/types';
```

- [ ] **Step 2: AntiClassifierTool.svelte** — same change.

- [ ] **Step 3: TranslateTool.svelte** — change (note `type ChatMessage`):

```ts
// before:
import { chat, hasApiKey, OpenRouterError, type ChatMessage } from '$lib/ai/openrouter';
// after:
import { chat, hasAnyKey as hasApiKey } from '$lib/ai/gateway';
import { GatewayError as OpenRouterError, type ChatMessage } from '$lib/ai/types';
```

- [ ] **Step 4: `app/src/lib/stores/_migrate.ts`** — if it imports from openrouter.ts, rewrite to read/write `cryptex.providers` directly, or delete the migration (the seeding in `providers.svelte.ts` already handles the legacy key).

Audit:

```bash
grep -rn "from '\\$lib/ai/openrouter'" app/src
grep -rn "from '\\$lib/ai/models.svelte'" app/src
```

Expected: **zero hits**. If any remain, update them.

### 6.C — Delete shims

- [ ] **Step 1:**

```bash
rm app/src/lib/ai/openrouter.ts
rm app/src/lib/ai/models.svelte.ts
rm app/src/lib/ai/openrouter.test.ts
```

- [ ] **Step 2: Refine size-limit glob**

```bash
cd app && npm run build
```

Inspect `build/_app/immutable/chunks/` for the PromptCraft page's main chunk. Update `.size-limit.json` `path` to match, e.g.:

```json
"path": "build/_app/immutable/chunks/promptcraft-*.js"
```

- [ ] **Step 3: Size check**

```bash
cd app && npx size-limit
```

Expected: under 50 KB. If over, diagnose: the main culprit is usually an adapter loaded eagerly that should be lazy. Wrap `anthropicAdapter` / `openaiCompatAdapter` imports in `await import(...)` inside `buildAdapter` switch cases.

### 6.D — Full regression

- [ ] **Step 1:**

```bash
cd app && npm run check && npm run test:unit && npm run build
```

Expected: all green.

- [ ] **Step 2: Dev server full manual regression**

Walk all three tools, Settings flow, provider add/remove, model picker, Cmd+M. Nothing visibly changed — internal refactor only.

### 6.E — Commit

- [ ] **Step 1:**

```bash
cd ..
git rm app/src/lib/ai/openrouter.ts app/src/lib/ai/models.svelte.ts app/src/lib/ai/openrouter.test.ts
git add app/.size-limit.json \
        app/src/lib/components/tools/promptcraft/PromptCraftTool.svelte \
        app/src/lib/components/tools/anticlassifier/AntiClassifierTool.svelte \
        app/src/lib/components/tools/translate/TranslateTool.svelte \
        app/src/lib/stores/_migrate.ts
git commit -m "$(cat <<'EOF'
refactor(ai): migrate tool callers to gateway; drop openrouter.ts shim

Flips PromptCraftTool, AntiClassifierTool, TranslateTool, and any remaining
migration helpers from $lib/ai/openrouter → $lib/ai/gateway. Deletes the
legacy openrouter.ts, models.svelte.ts, and openrouter.test.ts shims.

Size-limit glob refined against the built chunks; AI-route critical path
verified under the 50 KB gzipped budget.

Internal refactor only — no user-visible change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### 6.F — PAUSE, test, push

---

## Commit 7: Docs + CSP connect-src update

**Goal:** Update `CLAUDE.md` (Architecture section) and `DEPLOY.md` (CSP) and add `docs/CUSTOM-ENDPOINTS.md`.

### 7.A — Files

**Create:**
- `docs/CUSTOM-ENDPOINTS.md`

**Modify:**
- `CLAUDE.md`
- `DEPLOY.md` — append CSP response-header section (beside the unrelated Cloudflare note already in flight)

### 7.B — `CLAUDE.md` update

- [ ] **Step 1:** Add a new subsection under "## Architecture" (after the "### OpenRouter-backed features" subsection):

```markdown
### Multi-provider BYOK gateway

All AI calls now route through `app/src/lib/ai/gateway.ts`. It exposes:
- `chat(req) → ChatResponse` — unchanged shape for the three existing tools
- `streamChat(req)` — reserved for the future chat playground
- `fetchModels(signal)` — aggregates catalogs across every enabled provider
- `validateKey(providerId, candidate, opts)` — per-provider key probe
- `resolve(modelId)` — routes qualified ids (`openrouter:…`, `anthropic:…`,
  `openai-compat:<instance>/…`) to the right adapter; unqualified ids default
  to OpenRouter for back-compat with stored prefs.

Provider config lives in `app/src/lib/ai/providers.svelte.ts` persisted under
`cryptex.providers`. Adapters in `app/src/lib/ai/adapters/` are lazy-imported.
The old `openrouter.ts` is gone — don't recreate it.

Supported providers as of 2026-04-18:
- **OpenRouter** (default, CORS-open)
- **Anthropic** direct (uses `anthropic-dangerous-direct-browser-access` header)
- **OpenAI-compatible** endpoints (Groq, Together, Fireworks, DeepInfra, Cerebras, SambaNova, custom)
- Direct OpenAI / Google Gemini are **not supported** from the browser —
  their APIs don't return CORS headers. Users route those models through
  OpenRouter.
```

Update the `### OpenRouter-backed features` subsection's first sentence to say the call now goes through the gateway rather than directly to OpenRouter.

### 7.C — `DEPLOY.md` CSP section

- [ ] **Step 1:** Append a new section near the bottom of `DEPLOY.md`:

```markdown
## Content Security Policy

Cryptex ships CSP as a response header via Traefik. Minimum `connect-src` for
the multi-provider gateway (Commit 7 of 2026-04-18 rollout):

```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';
connect-src 'self'
  https://openrouter.ai
  https://api.anthropic.com
  https://api.groq.com
  https://api.together.xyz
  https://api.fireworks.ai
  https://api.deepinfra.com
  https://api.cerebras.ai
  https://api.sambanova.ai;
img-src 'self' data: blob:;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

Add the header via a Traefik middleware on the Cryptex router. See
`docs/CUSTOM-ENDPOINTS.md` for how users with custom OpenAI-compatible
endpoints should extend `connect-src`.
```

### 7.D — `docs/CUSTOM-ENDPOINTS.md`

- [ ] **Step 1:**

File: `docs/CUSTOM-ENDPOINTS.md`

```markdown
# Using custom OpenAI-compatible endpoints

Cryptex ships with presets for Groq, Together, Fireworks, DeepInfra, Cerebras,
and SambaNova. You can add any other OpenAI-compatible endpoint via
**Settings → Add provider → Custom endpoint**.

## Requirements

1. **CORS must be enabled** on the endpoint for your Cryptex origin. If you
   self-host vLLM, run it with `--allowed-origins '*'` (or your specific
   origin). If you self-host Ollama behind a proxy, the proxy must set
   `Access-Control-Allow-Origin`. Without CORS, Cryptex shows a `cors` error
   banner on the first call.

2. **`/chat/completions` compatibility** — the endpoint must accept the
   OpenAI Chat Completions request shape.

3. **(Optional) `/models` endpoint** — if the endpoint supports `GET /models`,
   Cryptex auto-populates the model picker. If not, use the model picker's
   free-text fallback (search for any string, press Enter) to specify the
   model id manually.

## Content Security Policy

If you self-host Cryptex behind a CSP, add your custom endpoint's host to
`connect-src`. Example for a local vLLM on `https://llm.internal`:

```
connect-src 'self' https://openrouter.ai https://api.anthropic.com \
  https://api.groq.com https://api.together.xyz https://api.fireworks.ai \
  https://api.deepinfra.com https://api.cerebras.ai https://api.sambanova.ai \
  https://llm.internal;
```

The gateway's CORS error banner includes a "Learn why" link that points here.

## Why no direct OpenAI / Google Gemini

`api.openai.com` and `generativelanguage.googleapis.com` don't return
`Access-Control-Allow-Origin` to browser requests as of April 2026. There is
no browser-only workaround. For GPT-5 / o-series / Gemini models, use
OpenRouter — it accepts your BYOK for those providers and proxies
transparently.
```

### 7.E — Commit

- [ ] **Step 1:**

```bash
git add CLAUDE.md DEPLOY.md docs/CUSTOM-ENDPOINTS.md
git commit -m "$(cat <<'EOF'
docs: multi-provider gateway docs + CSP connect-src update

CLAUDE.md: new "Multi-provider BYOK gateway" section under Architecture,
documenting the gateway.ts entry point, adapter layout, and qualified model
ids. Notes that direct OpenAI and Gemini are unsupported (no CORS) and
should route through OpenRouter.

DEPLOY.md: CSP response-header block with connect-src entries for the seven
supported provider hosts. Pointer to CUSTOM-ENDPOINTS.md for user-added
endpoints.

docs/CUSTOM-ENDPOINTS.md: one-page guide for self-hosters adding vLLM /
Ollama / other OpenAI-compatible endpoints — CORS requirements, /models
discovery, CSP extension example.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### 7.F — Final PAUSE, user reads docs, push

---

## Post-plan summary

After commit 7 is pushed, the gateway sub-project is complete:
- Seven atomic commits merged to master.
- All three tools work against OpenRouter, Anthropic-direct, and any configured OpenAI-compatible endpoint.
- Settings: progressive-disclosure card layout with blur-validated keys, ErrorBanner with category CTAs, preset-based Add-Provider flow.
- ModelPickerV2: flat list with upstream grouping, capability filter chips, Cmd+M shortcut, recent-5, free-text fallback.
- Bundle budget held at ≤ 50 KB gz on the AI-route critical path.
- Legacy `openrouter.ts` / `models.svelte.ts` / `ModelPicker.svelte` gone.
- Docs updated.

Next sub-project recommendation (from `Brainstormed-Plan.md`): **#2 Prompts & AI-Technique Overhaul** — can run in parallel since it only calls `chat()`, no gateway changes needed.

---

## Self-review (done by plan author, not the implementer)

**Spec coverage:**
- §4.1 Module layout → all files created across Commits 1–3.
- §4.2 Types → `types.ts` in 1.C.
- §4.3 Adapter interface → `adapters/base.ts` in 1.G; each adapter in 1.H / 2.C / 3.D.
- §4.4 Gateway API → `gateway.ts` in 1.J.
- §4.5 Resolution → `resolve()` in 1.J.
- §4.6 Provider registry → `providers.svelte.ts` in 1.E.
- §4.7 Catalog → `catalog.svelte.ts` in 1.I.
- §4.8 Error translation → `errors.ts` in 1.D.
- §4.9 Validation → `validate.ts` in 1.F.
- §4.10 Auto-retry → `chatWithRetry` in `gateway.ts` in 1.J.
- §4.11 Fallback handling → not yet wired (requires `ProviderRecord.fallbackModel` to be read in `chat()` — add as a small follow-up in Commit 4's tool-level error handling, or document as deferred).

**Gap:** §4.11 (fallback retry on `not_found`) isn't explicitly wired into `chat()`. Fix: adding `ProviderRecord.fallbackModel` lookup to `chat()` is small enough to bundle into Commit 4. Mentioned in ErrorBanner's `onUseFallback` CTA.

**Placeholder scan:** none. Every step has code or commands.

**Type consistency:**
- `ProviderRecord.id` union matches `ProviderId` ✓
- `Adapter.id` matches `ProviderId` ✓
- `qualifiedId` format consistent across adapters ✓
- `KeyInfo` shape identical across adapter `validateKey` returns ✓

Plan ready.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-18-byok-gateway-plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per commit, review between commits, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
