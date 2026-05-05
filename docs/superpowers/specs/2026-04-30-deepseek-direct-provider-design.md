# DeepSeek as Direct Provider Design

**Status:** Approved, ready for implementation plan.

**Trigger:** Today, the only way to use DeepSeek models is via OpenRouter (extra hop, OpenRouter markup, dependency on OpenRouter availability). DeepSeek's API is OpenAI-compatible and supports browser CORS — adding it as a first-class preset gives users a direct, lower-latency path to DeepSeek-V3.x and `deepseek-reasoner` (R1).

## Goal

Add DeepSeek as a first-class provider preset that the user configures with their DeepSeek API key. After configuration, all DeepSeek models are usable from any role (orchestrator / target / judge in the Chain tab; main chat model picker; PromptCraft; AntiClassifier; etc.). User picks; system never auto-routes.

## Non-goals

- Auto-routing or "prefer DeepSeek when configured" behavior. The user picks any provider for any role.
- Updating `RECOMMENDED_DEFAULTS` to point at DeepSeek-direct. Recommendations stay as-is.
- New UI (no badges, no recommendation pills, no provider-switcher).
- Custom DeepSeek-specific request parameters beyond the reasoning-budget fix below.
- DeepSeek's beta features (function calling, JSON mode, multi-step turns) — already covered by the existing `@ai-sdk/openai-compatible` adapter.

## Locked decisions (from brainstorm)

- **Q1 = (a)** Plain preset addition + reasoning-budget fix. No `RECOMMENDED_DEFAULTS` changes. No auto-routing.
- **CORS pattern** = same as Groq / Together / Fireworks / etc. — trust DeepSeek's server-side CORS, no code-side bypass, no proxy.

---

## Architecture

### CORS pattern (same as every other preset)

```
Browser (Cryptex)  ──HTTPS──▶  api.deepseek.com/v1/{chat/completions, models}
                              │
                              └─ DeepSeek returns ACAO: * + handles OPTIONS preflight
                              │
                              ◀── response flows back
```

No proxy. No middleware. The existing `openai-compat` adapter calls `fetch` directly. Identical to how Groq, Together, etc. work. The preset trust is asserted by adding it to `OPENAI_COMPAT_PRESETS` (only `custom` carries `suspectCors`).

### Reasoning-budget fix

DeepSeek-reasoner has the same problem as OpenAI's o-series and GPT-5: default `max_tokens=4096` gets consumed by the model's chain-of-thought, leaving little for visible output. We've already solved this for OpenAI in `patchedFetch` (raises `max_completion_tokens` floor to 32K). DeepSeek-reasoner needs the same fix BUT uses plain `max_tokens` (not `max_completion_tokens`), and unlike OpenAI's o-series it tolerates `temperature`/`top_p`/etc. (silently ignored, not rejected).

A second branch in `patchedFetch` handles DeepSeek-reasoner: detect by model id, bump `max_tokens` floor, leave other parameters untouched.

---

## Section 1 — Preset entry

`app/src/lib/ai/presets.ts` — append one row to `OPENAI_COMPAT_PRESETS`:

```ts
{ id: 'deepseek',   name: 'DeepSeek',   baseURL: 'https://api.deepseek.com/v1',
  docsUrl: 'https://api-docs.deepseek.com/',
  defaultTestModel: 'deepseek-chat', supportsAuthProbe: true }
```

Position: alphabetically between `cerebras` and `deepinfra` for visual scanning, or at the end alongside `custom` — implementer picks based on existing alphabetical convention.

Update the file's header docstring with one line:

```
DeepSeek added 2026-04-30 — browser CORS confirmed via OPTIONS preflight on
/v1/chat/completions; their docs at api-docs.deepseek.com confirm CORS support
since 2025-Q3.
```

### Catalog

DeepSeek's `/v1/models` endpoint returns:
```json
{
  "object": "list",
  "data": [
    { "id": "deepseek-chat", "object": "model", "owned_by": "deepseek" },
    { "id": "deepseek-reasoner", "object": "model", "owned_by": "deepseek" }
  ]
}
```

The existing `fetchCatalog` in `openai-compat.ts` consumes this shape and produces `Model[]` with qualified ids `openai-compat:<userInstanceId>/deepseek-chat` and `openai-compat:<userInstanceId>/deepseek-reasoner`. No catalog code changes needed.

### Auth probe

`validateKey` already POSTs to `/v1/chat/completions` with `model: defaultTestModel + max_tokens: 1`. With `defaultTestModel: 'deepseek-chat'`, the probe is:

```json
POST /v1/chat/completions
{ "model": "deepseek-chat", "messages": [{"role":"user","content":"."}], "max_tokens": 1 }
```

DeepSeek-chat costs ~$0.27 / 1M output tokens — a 1-token probe rounds to free. No extra logic needed.

---

## Section 2 — Reasoning-budget fix

`app/src/lib/ai/adapters/openai-compat.ts` — extend `patchedFetch` with a sibling branch.

### Add regex + helper

Just after the existing `REASONING_MODEL_RE` and `needsCompletionTokensRewrite`:

```ts
/**
 * DeepSeek-reasoner shares the reasoning-budget problem with OpenAI's o-series
 * (default max_tokens consumed by internal chain-of-thought, empty visible
 * output) but uses plain `max_tokens` rather than `max_completion_tokens`.
 * Bump the floor without swapping the field name. DeepSeek silently ignores
 * unsupported params (temperature, top_p, etc.) so we don't strip them.
 */
const DEEPSEEK_REASONER_RE = /^deepseek-reasoner(?:[-.].*)?$/i;

function needsDeepseekReasonerFloor(modelId: unknown): boolean {
  return typeof modelId === 'string' && DEEPSEEK_REASONER_RE.test(modelId);
}
```

### Add branch in `patchedFetch`

Inside `patchedFetch`, after the existing `if (needsCompletionTokensRewrite(body?.model))` block (which handles OpenAI o-series + GPT-5), add a sibling `if`:

```ts
if (needsDeepseekReasonerFloor(body?.model)) {
  if (typeof body.max_tokens !== 'number' || body.max_tokens < REASONING_MIN_BUDGET) {
    body.max_tokens = REASONING_MIN_BUDGET;
  }
  init = { ...init, body: JSON.stringify(body) };
}
```

The two branches are mutually exclusive (a model id can't match both regexes), but they're written as separate `if`s rather than `else if` so future reasoning model patterns can be added without rewriting the chain.

### Update `validateKey`'s probe

`validateKey` constructs its own probe body. Currently:

```ts
const probeBody: Record<string, unknown> = {
  model: testModel,
  messages: [{ role: 'user', content: '.' }]
};
if (needsCompletionTokensRewrite(testModel)) {
  probeBody.max_completion_tokens = 1;
} else {
  probeBody.max_tokens = 1;
}
```

DeepSeek-reasoner falls into the `else` branch (`max_tokens = 1`), which would normally be too small even for the probe. BUT — the probe's `defaultTestModel` is `deepseek-chat` (set in the preset), not `deepseek-reasoner`, so the probe never actually hits the reasoner. No change needed to `validateKey`.

---

## Section 3 — Tests

`app/src/lib/ai/__tests__/openai-compat-adapter.test.ts` — add three test cases:

### Test 1 — DeepSeek preset is in the registry

```ts
it('OPENAI_COMPAT_PRESETS includes DeepSeek with the right baseURL', async () => {
  const { OPENAI_COMPAT_PRESETS, getPreset } = await import('../presets');
  const ds = getPreset('deepseek');
  expect(ds).toBeDefined();
  expect(ds?.name).toBe('DeepSeek');
  expect(ds?.baseURL).toBe('https://api.deepseek.com/v1');
  expect(ds?.defaultTestModel).toBe('deepseek-chat');
  expect(ds?.supportsAuthProbe).toBe(true);
});
```

### Test 2 — `patchedFetch` bumps `max_tokens` floor for `deepseek-reasoner`

The existing test file already has `patchedFetch` tests for OpenAI reasoning models. Add a sibling case:

```ts
it('patchedFetch bumps max_tokens to REASONING_MIN_BUDGET for deepseek-reasoner', async () => {
  const captured: { url: string; body: any }[] = [];
  globalThis.fetch = vi.fn(async (url: any, init: any) => {
    captured.push({ url: url.toString(), body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ id: 'r', choices: [{ message: { content: 'ok' } }] }), { status: 200 });
  }) as any;

  const adapter = openaiCompatAdapter({
    id: 'openai-compat',
    instanceId: 'ds-1',
    name: 'DeepSeek',
    presetId: 'deepseek',
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: 'sk-test',
    testModel: 'deepseek-chat'
  });
  const model = adapter.resolveModel('deepseek-reasoner');
  await model.doGenerate({
    inputFormat: 'messages',
    mode: { type: 'regular' },
    prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    maxOutputTokens: 4096
  });

  expect(captured).toHaveLength(1);
  expect(captured[0].body.model).toBe('deepseek-reasoner');
  expect(captured[0].body.max_tokens).toBe(32000);
  // DeepSeek tolerates temperature/top_p, so we DON'T strip them like OpenAI
  // (the test doesn't pass them, so just verify no synthetic stripping happened
  // beyond max_tokens bump)
  expect(captured[0].body.max_completion_tokens).toBeUndefined();
});
```

### Test 3 — `patchedFetch` leaves `deepseek-chat` requests untouched

```ts
it('patchedFetch does not modify max_tokens for non-reasoner DeepSeek models', async () => {
  const captured: { url: string; body: any }[] = [];
  globalThis.fetch = vi.fn(async (url: any, init: any) => {
    captured.push({ url: url.toString(), body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ id: 'r', choices: [{ message: { content: 'ok' } }] }), { status: 200 });
  }) as any;

  const adapter = openaiCompatAdapter({
    id: 'openai-compat',
    instanceId: 'ds-1',
    name: 'DeepSeek',
    presetId: 'deepseek',
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: 'sk-test',
    testModel: 'deepseek-chat'
  });
  const model = adapter.resolveModel('deepseek-chat');
  await model.doGenerate({
    inputFormat: 'messages',
    mode: { type: 'regular' },
    prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    maxOutputTokens: 4096
  });

  expect(captured).toHaveLength(1);
  expect(captured[0].body.model).toBe('deepseek-chat');
  expect(captured[0].body.max_tokens).toBe(4096); // unchanged
});
```

---

## Section 4 — File surface

| File | Action |
|---|---|
| `app/src/lib/ai/presets.ts` | Append DeepSeek preset row + update header docstring |
| `app/src/lib/ai/adapters/openai-compat.ts` | Add `DEEPSEEK_REASONER_RE` + `needsDeepseekReasonerFloor` + `patchedFetch` sibling branch |
| `app/src/lib/ai/__tests__/openai-compat-adapter.test.ts` | Three new test cases |

3 files, ~50 lines net change.

---

## Section 5 — What's NOT changing

- `RECOMMENDED_DEFAULTS` in `default-models.ts` — untouched. Stays as-is (OpenRouter paths). User who has DeepSeek-direct configured manually picks it from their catalog.
- `resolveDefaultModels` — untouched. Walks the existing exact-id list. No suffix-match introspection.
- `isUncensoredOrchestrator` — untouched (its existing regex `/deepseek/i` already matches `openai-compat:<instance>/deepseek-reasoner` substring, so the orchestrator-fallback tip auto-suppresses correctly).
- UI components — untouched. The provider-add modal already lists every preset from `OPENAI_COMPAT_PRESETS` automatically — DeepSeek shows up by virtue of being in the list.
- CSP / app.html / svelte.config.js — untouched. Existing CSP is permissive enough; provider's CORS handles browser direct call.

---

## Section 6 — Risks

1. **DeepSeek CORS regression.** If DeepSeek changes their CORS posture and stops returning `ACAO: *`, browser direct calls fail with `TypeError: Failed to fetch`. The existing error-translation in `openai-compat.ts` will surface this with `{ category: 'network' }` (NOT `cors`, because the `suspectCors` flag is only true for the `custom` preset — by-design pattern matching the comment in the file). Mitigation: document the failure mode; users can fall back to OpenRouter's deepseek path.
2. **DeepSeek-reasoner output truncation if 32K isn't enough.** For very long reasoning chains, even 32K may be tight. The user can override `maxOutputTokens` per-chat via Settings → Chat → Max tokens (existing UI). Document in commit message.
3. **Future DeepSeek model names.** If DeepSeek ships `deepseek-reasoner-v2` or `deepseek-r2`, the regex `^deepseek-reasoner(?:[-.].*)?$/i` matches `deepseek-reasoner-v2` (good). It does NOT match `deepseek-r2` (a hypothetical rename). If they rename, we update the regex — one-line change.

---

## Section 7 — Out of scope (deferred)

- Adding DeepSeek-direct to `RECOMMENDED_DEFAULTS` (would require resolver changes the user explicitly rejected — "no race, no auto-routing").
- DeepSeek's prefix-caching cost optimization (their API supports it via system messages but our existing OpenAI-compat path doesn't surface it).
- DeepSeek's function-calling / JSON mode — already inherited via `@ai-sdk/openai-compatible`.
- Provider-recommendation badges in the UI.

## Scope coverage

| Brainstorm decision | Section |
|---|---|
| Q1 plain preset + reasoning fix | Sections 1, 2 |
| CORS pattern matches Groq/etc. | Architecture |
| No auto-routing | Section 5 |
| User picks anything for any role | Section 5 |
