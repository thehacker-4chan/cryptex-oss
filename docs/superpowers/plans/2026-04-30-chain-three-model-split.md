# Chain Three-Model Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split Chain orchestrator/target/judge into three independent model selections so users can pair an uncensored orchestrator with an aligned target — the highest-leverage single change for actual jailbreak effectiveness.

**Architecture:** Extend `AttackChainConfig` with three optional model-id fields. Add a `default-models.ts` resolver that picks recommended uncensored / cheap models from the user's catalog (with chat-default fallback). Update the engine's `AttackSessionContext` to take `judgeModelId` and route the inline `judgeClient` through it. Add three labelled `RoleModelPicker` rows above the objective in `AttackChainTab.svelte`, with an inline tip when the orchestrator falls back to a non-uncensored model.

**Tech Stack:** Svelte 5 runes, Vitest + fake-indexeddb, existing `ModelPickerV2` + `catalog.svelte` surfaces, no new dependencies.

**Spec:** [`docs/superpowers/specs/2026-04-30-chain-three-model-split-design.md`](../specs/2026-04-30-chain-three-model-split-design.md)

**Working directory:** `C:/Users/m4xx/Downloads/cryptex` (master branch).

**Shell:** PowerShell 5.1. POSIX heredoc form `git commit -m "$(cat <<'EOF' ... EOF)"` for multiline commits. Do NOT use `@'...'@`.

**Untracked scratch files** (`docs/superpowers/plans/2026-04-18-byok-gateway-plan.md`, `templates/hermes-agent/`) MUST remain unstaged.

**Current `AttackChainConfig` location:** `app/src/lib/chat/types.ts` line 11. Already contains `input?`, `layers?`, `modelQualifiedId?`.

**Current `ModelPickerV2` Props:** `{ value: string; onChange: (id: string) => void; recentsKey: string; defaultOpen?: boolean; triggerClass?: string }`. Each role needs a unique `recentsKey`.

**Catalog source:** `import { catalog } from '$lib/ai/catalog.svelte'` — `catalog.list` is the populated `Model[]` array used by the resolver.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `app/src/lib/chat/types.ts` | Modify | Extend `AttackChainConfig` with `orchestratorModelId?`, `targetModelId?`, `judgeModelId?`, `recommendedTipDismissed?` |
| `app/src/lib/chat/chain/default-models.ts` | Create | `RECOMMENDED_DEFAULTS` map, `resolveDefaultModels(args)`, `isUncensoredOrchestrator(id)` |
| `app/src/lib/chat/chain/__tests__/default-models.test.ts` | Create | Unit tests for resolver + heuristic |
| `app/src/lib/chat/chain/orchestrator.ts` | Modify | Add `judgeModelId` to `AttackSessionContext`; route `judgeClient` to it |
| `app/src/lib/chat/chain/__tests__/orchestrator.test.ts` | Modify | Update `makeCtx` with `judgeModelId`; add Scenario I (judge isolation) |
| `app/src/lib/components/chat/attack-chain/RoleModelPicker.svelte` | Create | Wrapper around `<ModelPickerV2>` with label + description + tip slot |
| `app/src/lib/components/chat/attack-chain/AttackChainTab.svelte` | Modify | Three `<RoleModelPicker>` rows above objective + persistence + tip wiring + pass `judgeModelId` to engine context |

---

## Task 1: Extend `AttackChainConfig` types

**Goal:** Add the three persisted model-id fields plus the tip-dismissed flag. Pure type-additions, no runtime change.

**Files:**
- Modify: `app/src/lib/chat/types.ts`

- [ ] **Step 1: Read current `AttackChainConfig`**

```bash
grep -n -A 15 "interface AttackChainConfig" app/src/lib/chat/types.ts
```

Note the exact existing fields (`input`, `layers`, `modelQualifiedId`, possibly more) and the closing brace location.

- [ ] **Step 2: Append four new optional fields**

In `app/src/lib/chat/types.ts`, locate the `AttackChainConfig` interface body. Append BEFORE the closing brace:

```ts
  /** v3-three-model: orchestrator (drafts attack messages). Falls back to
   *  modelQualifiedId then chat.modelQualifiedId at read time. */
  orchestratorModelId?: string;
  /** v3-three-model: target (model under test). Falls back the same way. */
  targetModelId?: string;
  /** v3-three-model: judge (scores compliance + objective progress). */
  judgeModelId?: string;
  /** v3-three-model: per-chat dismissal of the orchestrator-fallback tip. */
  recommendedTipDismissed?: boolean;
```

- [ ] **Step 3: Typecheck**

```bash
cd app; npm run check 2>&1 | tail -1
```

Expected: `0 ERRORS`.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/m4xx/Downloads/cryptex
git add app/src/lib/chat/types.ts
git commit -m "$(cat <<'EOF'
feat(chain): AttackChainConfig adds 3-role model fields + tip flag

Four new optional fields on AttackChainConfig:
  - orchestratorModelId — drafts attack messages
  - targetModelId       — model under test
  - judgeModelId        — scores compliance + progress
  - recommendedTipDismissed — per-chat dismissal of the
                              orchestrator-fallback tip

Existing modelQualifiedId stays as the read-side legacy fallback
when any of the three new fields is absent. Default chain in later
tasks: <role>ModelId ?? modelQualifiedId ?? chat.modelQualifiedId.
EOF
)"
```

---

## Task 2: `default-models.ts` resolver + heuristic

**Goal:** Static map of recommended models per role + a function that picks the first available one from the user's catalog, plus a heuristic to detect "uncensored" orchestrator picks.

**Files:**
- Create: `app/src/lib/chat/chain/default-models.ts`
- Create: `app/src/lib/chat/chain/__tests__/default-models.test.ts`

- [ ] **Step 1: Write failing tests**

Create `app/src/lib/chat/chain/__tests__/default-models.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  RECOMMENDED_DEFAULTS,
  resolveDefaultModels,
  isUncensoredOrchestrator
} from '../default-models';
import type { ChatRow } from '$lib/chat/types';

function makeChat(modelId: string): ChatRow {
  return {
    id: 'c1',
    ownerId: 'local',
    title: 't',
    modelQualifiedId: modelId,
    createdAt: 0,
    updatedAt: 0,
    settings: {},
    parentChatId: null,
    pinned: false,
    archivedAt: null,
    tags: []
  } as unknown as ChatRow;
}

describe('RECOMMENDED_DEFAULTS', () => {
  it('exposes orchestrator + judge lists, both non-empty', () => {
    expect(RECOMMENDED_DEFAULTS.orchestrator.length).toBeGreaterThan(0);
    expect(RECOMMENDED_DEFAULTS.judge.length).toBeGreaterThan(0);
  });
});

describe('resolveDefaultModels', () => {
  it('returns chat default for all three when no recommended is in catalog', () => {
    const chat = makeChat('openrouter:anthropic/claude-sonnet-4-5');
    const defaults = resolveDefaultModels({ chat, availableModels: [] });
    expect(defaults.orchestrator).toBe('openrouter:anthropic/claude-sonnet-4-5');
    expect(defaults.target).toBe('openrouter:anthropic/claude-sonnet-4-5');
    expect(defaults.judge).toBe('openrouter:anthropic/claude-sonnet-4-5');
  });

  it('picks recommended orchestrator when available in catalog', () => {
    const chat = makeChat('openrouter:anthropic/claude-sonnet-4-5');
    const available = [
      { qualifiedId: 'openrouter:deepseek/deepseek-r1' },
      { qualifiedId: 'openrouter:anthropic/claude-sonnet-4-5' }
    ];
    const defaults = resolveDefaultModels({ chat, availableModels: available });
    expect(defaults.orchestrator).toBe('openrouter:deepseek/deepseek-r1');
  });

  it('picks recommended judge when available in catalog', () => {
    const chat = makeChat('openrouter:anthropic/claude-sonnet-4-5');
    const available = [
      { qualifiedId: 'openrouter:openai/gpt-4o-mini' },
      { qualifiedId: 'openrouter:anthropic/claude-sonnet-4-5' }
    ];
    const defaults = resolveDefaultModels({ chat, availableModels: available });
    expect(defaults.judge).toBe('openrouter:openai/gpt-4o-mini');
  });

  it('always returns chat default for target regardless of catalog', () => {
    const chat = makeChat('openrouter:anthropic/claude-sonnet-4-5');
    const available = [
      { qualifiedId: 'openrouter:deepseek/deepseek-r1' },
      { qualifiedId: 'openrouter:openai/gpt-4o-mini' }
    ];
    const defaults = resolveDefaultModels({ chat, availableModels: available });
    expect(defaults.target).toBe('openrouter:anthropic/claude-sonnet-4-5');
  });

  it('walks the priority list in order — first available wins', () => {
    // Second-priority orchestrator candidate is in catalog; first is not.
    const chat = makeChat('openrouter:anthropic/claude-sonnet-4-5');
    const second = RECOMMENDED_DEFAULTS.orchestrator[1];
    const available = [{ qualifiedId: second }];
    const defaults = resolveDefaultModels({ chat, availableModels: available });
    expect(defaults.orchestrator).toBe(second);
  });
});

describe('isUncensoredOrchestrator', () => {
  it('returns true for every entry in RECOMMENDED_DEFAULTS.orchestrator', () => {
    for (const id of RECOMMENDED_DEFAULTS.orchestrator) {
      expect(isUncensoredOrchestrator(id)).toBe(true);
    }
  });

  it('returns true for known-uncensored name patterns', () => {
    expect(isUncensoredOrchestrator('openrouter:deepseek/deepseek-chat-v3.1')).toBe(true);
    expect(isUncensoredOrchestrator('openrouter:cognitivecomputations/dolphin-mixtral-8x22b')).toBe(true);
    expect(isUncensoredOrchestrator('openrouter:nousresearch/hermes-3-llama-3.1-405b')).toBe(true);
    expect(isUncensoredOrchestrator('openrouter:huihui-ai/qwen3-abliterated-72b')).toBe(true);
  });

  it('returns false for aligned models', () => {
    expect(isUncensoredOrchestrator('openrouter:anthropic/claude-sonnet-4-5')).toBe(false);
    expect(isUncensoredOrchestrator('openrouter:openai/gpt-4o')).toBe(false);
    expect(isUncensoredOrchestrator('openrouter:google/gemini-2.5-pro')).toBe(false);
    expect(isUncensoredOrchestrator('')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect RED**

```bash
cd app
npx vitest run src/lib/chat/chain/__tests__/default-models.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `app/src/lib/chat/chain/default-models.ts`:

```ts
import type { ChatRow } from '$lib/chat/types';

/**
 * Recommended models per role, ordered by preference. Adding a new
 * recommendation is a one-line change. Models go stale; a maintainer updates
 * this list. The resolver walks the list and picks the first available one
 * from the user's catalog; if none are available, falls back to the chat's
 * main model id.
 */
export const RECOMMENDED_DEFAULTS = {
  orchestrator: [
    'openrouter:deepseek/deepseek-r1',
    'openrouter:deepseek/deepseek-chat-v3.1',
    'openrouter:nousresearch/hermes-3-llama-3.1-405b',
    'openrouter:cognitivecomputations/dolphin-mixtral-8x22b'
  ],
  judge: [
    'openrouter:openai/gpt-4o-mini',
    'openrouter:google/gemini-2.5-flash',
    'openrouter:anthropic/claude-haiku-4-5'
  ]
} as const;

export interface ResolvedModels {
  orchestrator: string;
  target: string;
  judge: string;
}

/**
 * Resolve the three default model ids for a fresh Chain session.
 * - orchestrator: first available recommended uncensored, else chat default.
 * - target: always the chat's main model.
 * - judge: first available recommended cheap model, else chat default.
 */
export function resolveDefaultModels(args: {
  chat: ChatRow;
  availableModels: Array<{ qualifiedId: string }>;
}): ResolvedModels {
  const ids = new Set(args.availableModels.map((m) => m.qualifiedId));
  const pick = (candidates: readonly string[]): string | undefined =>
    candidates.find((id) => ids.has(id));
  const chatDefault = args.chat.modelQualifiedId;
  return {
    orchestrator: pick(RECOMMENDED_DEFAULTS.orchestrator) ?? chatDefault,
    target: chatDefault,
    judge: pick(RECOMMENDED_DEFAULTS.judge) ?? chatDefault
  };
}

/**
 * Heuristic: is the given orchestrator model id likely uncensored / willing
 * to draft red-team prompts? Used by the UI to decide whether to show the
 * "pick an uncensored model" tip.
 *
 * False positives are harmless (suppress an advisory tip).
 * False negatives are also harmless (keep the tip visible — user can dismiss).
 */
export function isUncensoredOrchestrator(modelId: string): boolean {
  if (!modelId) return false;
  if ((RECOMMENDED_DEFAULTS.orchestrator as readonly string[]).includes(modelId)) {
    return true;
  }
  return /deepseek|hermes|dolphin|nous|abliterated|uncensored|venice/i.test(modelId);
}
```

- [ ] **Step 4: Run tests — expect GREEN**

```bash
npx vitest run src/lib/chat/chain/__tests__/default-models.test.ts
```

Expected: all assertions PASS (10+ assertions across 8 cases).

- [ ] **Step 5: Typecheck**

```bash
npm run check 2>&1 | tail -1
```

Expected: `0 ERRORS`.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/m4xx/Downloads/cryptex
git add app/src/lib/chat/chain/default-models.ts app/src/lib/chat/chain/__tests__/default-models.test.ts
git commit -m "$(cat <<'EOF'
feat(chain): three-model default resolver + uncensored heuristic

RECOMMENDED_DEFAULTS map lists preferred orchestrator (uncensored:
DeepSeek R1, Hermes, Dolphin) and judge (cheap: GPT-4o-mini,
Gemini Flash, Claude Haiku) candidates in priority order.

resolveDefaultModels picks the first available from the user's
catalog. Falls back to the chat's main model when no recommended
candidate is configured. Target always returns chat default.

isUncensoredOrchestrator drives the inline tip in AttackChainTab —
true for known uncensored model patterns (deepseek/hermes/dolphin/
nous/abliterated/uncensored/venice).
EOF
)"
```

---

## Task 3: `RoleModelPicker.svelte`

**Goal:** Compact wrapper around `<ModelPickerV2>` that renders a labelled row with the role name, one-line description, the picker, and an optional inline tip slot.

**Files:**
- Create: `app/src/lib/components/chat/attack-chain/RoleModelPicker.svelte`

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
  import ModelPickerV2 from '$lib/components/ai/ModelPickerV2.svelte';
  import type { Snippet } from 'svelte';

  type Props = {
    label: string;
    description: string;
    value: string;
    onChange: (id: string) => void;
    recentsKey: string;
    tip?: Snippet | null;
  };
  let { label, description, value, onChange, recentsKey, tip = null }: Props = $props();
</script>

<div class="flex flex-col gap-1">
  <div class="flex items-baseline gap-2 text-xs">
    <span class="font-medium text-foreground">{label}</span>
    <span class="text-[10px] text-muted-foreground">{description}</span>
  </div>
  <ModelPickerV2
    {value}
    {onChange}
    {recentsKey}
    triggerClass="text-xs text-muted-foreground border border-border/40 rounded-md px-3 py-1 hover:border-border/70 hover:text-foreground transition-colors w-full justify-between"
  />
  {#if tip}{@render tip()}{/if}
</div>
```

- [ ] **Step 2: Typecheck**

```bash
cd app; npm run check 2>&1 | tail -1
```

Expected: `0 ERRORS`.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/m4xx/Downloads/cryptex
git add app/src/lib/components/chat/attack-chain/RoleModelPicker.svelte
git commit -m "$(cat <<'EOF'
feat(chain-ui): RoleModelPicker wrapper component

Compact wrapper around ModelPickerV2 used by AttackChainTab to
render the three role-labelled model pickers. Exposes label +
one-line description + value/onChange + recentsKey + an optional
tip snippet rendered below the picker.

Uses ModelPickerV2's full catalog (any provider, any model) — no
filtering applied at this layer.
EOF
)"
```

---

## Task 4: Engine — add `judgeModelId` to `AttackSessionContext`

**Goal:** Update the engine to take a separate `judgeModelId` and route the inline `judgeClient` calls through it. Existing 8 scenarios keep passing once `makeCtx` carries the new field. Add Scenario I asserting the per-call model isolation.

**Files:**
- Modify: `app/src/lib/chat/chain/orchestrator.ts`
- Modify: `app/src/lib/chat/chain/__tests__/orchestrator.test.ts`

- [ ] **Step 1: Read engine context + judgeClient block**

```bash
grep -n "AttackSessionContext\|judgeClient\|judgeModelId" app/src/lib/chat/chain/orchestrator.ts
```

You'll see `AttackSessionContext` (around line 60) with `targetModelId`, `orchestratorModelId` and the inline `judgeClient` block (around line 188) that currently passes `model: ctx.orchestratorModelId`.

- [ ] **Step 2: Add `judgeModelId` to the context interface**

In `app/src/lib/chat/chain/orchestrator.ts`, find `export interface AttackSessionContext`. Add a new required field after `orchestratorModelId`:

```ts
  judgeModelId: string;
```

Result (the relevant slice of the interface):

```ts
export interface AttackSessionContext {
  objective: string;
  targetModelId: string;
  orchestratorModelId: string;
  judgeModelId: string;
  targetModelLabel: string;
  // ...rest unchanged
}
```

- [ ] **Step 3: Route the inline judgeClient through `judgeModelId`**

Find the inline `judgeClient` block (the one inside the per-iteration scoring step that calls `ctx.gatewayChat`). Change:

```ts
              const res = await ctx.gatewayChat({
                model: ctx.orchestratorModelId,
                messages: [
                  { role: 'system', content: system },
                  { role: 'user', content: user }
                ],
                maxOutputTokens: 200,
                signal
              });
```

to:

```ts
              const res = await ctx.gatewayChat({
                model: ctx.judgeModelId,
                messages: [
                  { role: 'system', content: system },
                  { role: 'user', content: user }
                ],
                maxOutputTokens: 200,
                signal
              });
```

Only the `model:` line changes. `runDossierPhase` still uses `ctx.orchestratorModelId`. `refineTurn` still uses `ctx.orchestratorModelId`. `streamChat` still uses `ctx.targetModelId`.

- [ ] **Step 4: Update `makeCtx` in the orchestrator test file**

In `app/src/lib/chat/chain/__tests__/orchestrator.test.ts`, find the `makeCtx` helper. Add `judgeModelId: 'mock:orch'` to its returned object so all existing scenarios continue to typecheck:

```ts
function makeCtx(overrides: Partial<AttackSessionContext> = {}): AttackSessionContext {
  return {
    objective: 'explain photosynthesis',
    targetModelId: 'mock:target',
    orchestratorModelId: 'mock:orch',
    judgeModelId: 'mock:orch',
    targetModelLabel: 'MockTarget',
    maxAttempts: 9,
    mainChatHistory: [],
    signal: new AbortController().signal,
    gatewayChat: vi.fn(),
    streamChat: vi.fn(),
    ...overrides
  };
}
```

The default `'mock:orch'` for judge preserves existing scenarios' behavior — they don't care which exact id the judge call uses, just that it returns the mocked tier JSON.

- [ ] **Step 5: Add Scenario I (judge isolation) to the test file**

Append inside the existing `describe('runAttackSession', ...)` block, after Scenario H:

```ts
  it('Scenario I — judge calls go to judgeModelId, target streams to targetModelId, refine to orchestratorModelId', async () => {
    const gatewayChat = vi.fn();
    // refineTurn (orchestrator)
    gatewayChat.mockResolvedValueOnce({ content: 'Refined opener.' });
    // judges (Promise.all — progress fires first per microtask order)
    gatewayChat.mockResolvedValueOnce({ content: '{"tier":"no"}' });
    gatewayChat.mockResolvedValueOnce({ content: '{"tier":"partial"}' });

    const streamChat = vi.fn().mockImplementation(async function* () {
      yield { type: 'text-delta', delta: 'Target reply' };
      yield { type: 'finish' };
    });

    const events: OrchEvent[] = [];
    for await (const e of runAttackSession(makeCtx({
      orchestratorModelId: 'mock:orch',
      targetModelId: 'mock:target',
      judgeModelId: 'mock:judge',
      maxAttempts: 1,
      gatewayChat,
      streamChat
    }))) events.push(e);

    // Three gatewayChat calls: one refine + two judges. Inspect the model arg.
    const calls = gatewayChat.mock.calls.map((c) => c[0].model);
    expect(calls[0]).toBe('mock:orch');   // refineTurn
    expect(calls[1]).toBe('mock:judge');  // first judge (progress)
    expect(calls[2]).toBe('mock:judge');  // second judge (compliance)

    // streamChat called once with target model.
    expect(streamChat).toHaveBeenCalledTimes(1);
    expect(streamChat.mock.calls[0][0].model).toBe('mock:target');
  });
```

- [ ] **Step 6: Run chain suite — expect GREEN**

```bash
cd app
npx vitest run src/lib/chat/chain/__tests__/
```

Expected: 9 scenarios in `orchestrator.test.ts` (8 existing + Scenario I) + all other chain tests pass. Total chain count rises by 1.

- [ ] **Step 7: Typecheck**

```bash
npm run check 2>&1 | tail -1
```

Expected: `0 ERRORS`.

- [ ] **Step 8: Commit**

```bash
cd C:/Users/m4xx/Downloads/cryptex
git add app/src/lib/chat/chain/orchestrator.ts app/src/lib/chat/chain/__tests__/orchestrator.test.ts
git commit -m "$(cat <<'EOF'
feat(chain): engine accepts judgeModelId and routes judge calls

AttackSessionContext gains required judgeModelId. The inline
judgeClient inside the per-iteration scoring step now sends its
gatewayChat request with model=judgeModelId instead of
orchestratorModelId.

Dossier and refineTurn still use orchestratorModelId; target
streaming still uses targetModelId. New Scenario I asserts the
three-way model isolation by inspecting gatewayChat's per-call
model argument.
EOF
)"
```

---

## Task 5: Wire three pickers + tip into `AttackChainTab.svelte`

**Goal:** Add the three role pickers above the objective input. Resolve defaults on first render. Persist each picker change. Pass `judgeModelId` into the engine context. Render the orchestrator-fallback tip when applicable + per-chat dismissal.

**Files:**
- Modify: `app/src/lib/components/chat/attack-chain/AttackChainTab.svelte`

- [ ] **Step 1: Read AttackChainTab in full**

Read `app/src/lib/components/chat/attack-chain/AttackChainTab.svelte`. Note:
- Existing imports near the top.
- Where the existing orchestrator/target model id is resolved (search for `attackChainConfig?.modelQualifiedId ?? chat.modelQualifiedId` — this is the pattern we expand to per-role).
- The `ctx: AttackSessionContext = { ... }` block inside the `run()` function.
- The position of the form (objective textarea + max-turns slider) in the markup — pickers go above objective.

- [ ] **Step 2: Add imports**

Inside the `<script>` block at the top of the file, add (alongside existing imports):

```ts
  import RoleModelPicker from './RoleModelPicker.svelte';
  import { catalog } from '$lib/ai/catalog.svelte';
  import { resolveDefaultModels, isUncensoredOrchestrator } from '$lib/chat/chain/default-models';
  import Info from 'lucide-svelte/icons/info';
  import { base } from '$app/paths';
```

- [ ] **Step 3: Add resolved-default + per-role state**

Below the existing form-state declarations (around `let objective = $state(...)`), add:

```ts
  // Resolved defaults — recomputed when chat or catalog changes.
  const resolvedDefaults = $derived(
    resolveDefaultModels({
      chat,
      availableModels: catalog.list ?? []
    })
  );

  // Persisted-or-default IDs for each role, with read-side fallback chain:
  // attackChainConfig.<role>ModelId  ?? attackChainConfig.modelQualifiedId  ?? chat.modelQualifiedId
  const orchestratorModelId = $derived(
    chat.settings?.attackChainConfig?.orchestratorModelId
      ?? chat.settings?.attackChainConfig?.modelQualifiedId
      ?? resolvedDefaults.orchestrator
  );
  const targetModelId = $derived(
    chat.settings?.attackChainConfig?.targetModelId
      ?? chat.settings?.attackChainConfig?.modelQualifiedId
      ?? resolvedDefaults.target
  );
  const judgeModelId = $derived(
    chat.settings?.attackChainConfig?.judgeModelId
      ?? chat.settings?.attackChainConfig?.modelQualifiedId
      ?? resolvedDefaults.judge
  );

  // Tip visibility — only when orchestrator looks aligned and user hasn't dismissed.
  const showOrchestratorTip = $derived(
    !isUncensoredOrchestrator(orchestratorModelId)
      && !chat.settings?.attackChainConfig?.recommendedTipDismissed
  );

  async function setRoleModel(role: 'orchestrator' | 'target' | 'judge', id: string) {
    const cfg = chat.settings?.attackChainConfig ?? {};
    const next = { ...cfg, [`${role}ModelId`]: id };
    await repo.updateChat(chat.id, {
      settings: { ...(chat.settings ?? {}), attackChainConfig: next }
    });
  }

  async function dismissOrchestratorTip() {
    const cfg = chat.settings?.attackChainConfig ?? {};
    await repo.updateChat(chat.id, {
      settings: {
        ...(chat.settings ?? {}),
        attackChainConfig: { ...cfg, recommendedTipDismissed: true }
      }
    });
  }
```

- [ ] **Step 4: Add the three pickers + tip snippet to the markup**

In the markup (just above the objective input — find `<label>` containing the textarea and insert above it):

```svelte
<div class="flex flex-col gap-3 border-b border-border/30 pb-3">
  <RoleModelPicker
    label="Orchestrator"
    description="drafts the attack messages"
    value={orchestratorModelId}
    onChange={(id) => setRoleModel('orchestrator', id)}
    recentsKey="cryptex.chain.orchestrator.recentModels"
    tip={showOrchestratorTip ? orchestratorTip : null}
  />
  <RoleModelPicker
    label="Target"
    description="model under test"
    value={targetModelId}
    onChange={(id) => setRoleModel('target', id)}
    recentsKey="cryptex.chain.target.recentModels"
  />
  <RoleModelPicker
    label="Judge"
    description="scores responses (cheap is fine)"
    value={judgeModelId}
    onChange={(id) => setRoleModel('judge', id)}
    recentsKey="cryptex.chain.judge.recentModels"
  />
</div>

{#snippet orchestratorTip()}
  <div class="flex items-start gap-1 rounded bg-yellow-500/10 px-2 py-1 text-[10px] text-yellow-400">
    <Info size={10} class="shrink-0 mt-0.5" />
    <span class="flex-1">
      Aligned models often refuse to draft attack messages. Pick an uncensored
      orchestrator (DeepSeek R1, Nous Hermes, Dolphin) for higher success rates.
      <a href="{base}/guide/chat/attack-chain" class="underline">Learn more</a>
    </span>
    <button
      type="button"
      onclick={dismissOrchestratorTip}
      class="text-yellow-400/60 hover:text-yellow-400"
      aria-label="Dismiss tip"
    >×</button>
  </div>
{/snippet}
```

- [ ] **Step 5: Update `ctx` construction in `run()` to use the resolved IDs**

Find the `ctx: AttackSessionContext = { ... }` block inside the `run()` function. Currently it likely reads `orchestratorModelId` from a single config field. Replace with:

```ts
    const ctx: AttackSessionContext = {
      objective,
      targetModelId,
      orchestratorModelId,
      judgeModelId,
      targetModelLabel: targetModelId,
      maxAttempts,
      mainChatHistory: recentMessages
        .slice(-8)
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      signal: ctrl.signal,
      gatewayChat: gatewayChat as never,
      streamChat: streamChat as never
    };
```

The three IDs come from the `$derived` declarations in Step 3. If the existing block also writes `orchestratorModelId: targetModelId` or similar yoking, delete that — each role now has its own value.

If the existing `saveAttackSession` call also writes `targetModelId` / `orchestratorModelId` for record-keeping, update those to use the resolved values too:

```ts
    const session = await repo.saveAttackSession({
      chatId: chat.id,
      objective,
      targetModelId,
      orchestratorModelId,
      maxAttempts,
      turns: [],
      strategyLog: [],
      finalOutcome: null,
      finalConfidence: null,
      finalSummary: null
    });
```

(If `saveAttackSession`'s schema doesn't store judge model id, that's fine — the engine uses it transiently.)

- [ ] **Step 6: Typecheck**

```bash
cd app; npm run check 2>&1 | tail -1
```

Expected: `0 ERRORS`. If a missing-prop error surfaces on `<RoleModelPicker>`, verify Task 3 was committed and the import path is correct.

- [ ] **Step 7: Manual smoke (optional but recommended)**

Run `npm run app:dev`. Open a chat with OpenRouter configured:
1. Three pickers visible above the objective. Orchestrator defaults to DeepSeek R1 (or first available recommended). Target = chat's model. Judge = GPT-4o-mini (or first available).
2. Switch orchestrator to `claude-sonnet-4-5` — yellow tip appears below the picker.
3. Click ×. Tip disappears. Reload page — tip stays gone for this chat.
4. Open a different chat — tip reappears (per-chat dismissal).
5. Open Network panel, click Run attack. Confirm gateway POST requests:
   - First request: dossier or refineTurn → `model: "openrouter:deepseek/..."`
   - Target stream request → `model: "openrouter:anthropic/claude-sonnet-4-5"`
   - Judge requests → `model: "openrouter:openai/gpt-4o-mini"`

If any of those don't match, recheck Steps 3 + 5 wiring.

- [ ] **Step 8: Commit**

```bash
cd C:/Users/m4xx/Downloads/cryptex
git add app/src/lib/components/chat/attack-chain/AttackChainTab.svelte
git commit -m "$(cat <<'EOF'
feat(chain-ui): three role-pickers + orchestrator-fallback tip

AttackChainTab adds three RoleModelPicker rows above the objective
input — Orchestrator, Target, Judge — each independent and persisted
to chat.settings.attackChainConfig.<role>ModelId. Read-side falls
back to the legacy modelQualifiedId then the chat's main model.

Defaults on first run come from resolveDefaultModels: orchestrator
prefers DeepSeek R1 / Hermes / Dolphin, judge prefers GPT-4o-mini /
Gemini Flash / Claude Haiku, target stays the chat's model. When
none of the recommended candidates is in the user's catalog, all
three fall back to the chat's main model.

Inline tip on the orchestrator picker fires when the picked model
fails the isUncensoredOrchestrator heuristic, with a per-chat
dismiss × button.

Engine ctx now passes judgeModelId so the judge LLM is independent
of the orchestrator and target.
EOF
)"
```

---

## Task 6: Final verification + push

**Goal:** Run the CI matrix locally + push to origin.

**Files:** none directly modified.

- [ ] **Step 1: Full chain suite**

```bash
cd app
npx vitest run src/lib/chat/chain/__tests__/
```

Expected: chain suite green. Count rises by:
- `default-models.test.ts` (~8 cases)
- `orchestrator.test.ts` Scenario I (+1)

Total expected ~60 tests across 8 chain test files.

- [ ] **Step 2: Full app suite**

```bash
npm run test:unit 2>&1 | tail -8
```

Expected: pre-existing flake count unchanged. No new failures attributable to this work. If a chat-related test fails because it expected `attackChainConfig.modelQualifiedId` to be the only model field, update the test to use one of the new role-specific fields.

- [ ] **Step 3: Typecheck**

```bash
npm run check 2>&1 | tail -1
```

Expected: `0 ERRORS`.

- [ ] **Step 4: Production build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✔ done`.

- [ ] **Step 5: Commit verification marker**

```bash
cd C:/Users/m4xx/Downloads/cryptex
git commit --allow-empty -m "$(cat <<'EOF'
chore(chain): three-model-split verification pass

- Chain suite: 60+ tests green (8 default-models, 9 orchestrator
  scenarios incl. Scenario I judge isolation)
- svelte-check: 0 errors
- Production build: ok
- Manual smoke: three pickers visible, defaults resolve, tip fires
  + dismisses per-chat, gateway calls route to correct model per role.
EOF
)"
```

- [ ] **Step 6: Push**

```bash
git push origin master
```

Auto-deploy fires. Watch `https://github.com/m4xx101/cryptex/actions` for the run.

---

## Scope Coverage

| Spec section | Implementing task |
|---|---|
| Section 1 — Persistence (3 fields + dismissed flag) | Task 1 |
| Section 2 — Default model resolver | Task 2 |
| Section 3 — UI components (RoleModelPicker + tab integration) | Tasks 3 + 5 |
| Section 4 — Engine routing (judgeModelId) | Task 4 |
| Section 5 — File surface | Tasks 1–5 |
| Section 6 — Test plan | Tasks 2 + 4 |
| Backward compat (legacy modelQualifiedId fallback) | Task 5 (read-side `??` chain) |

## Self-review verdict

- **Spec coverage:** all 6 sections + backward-compat have a task. No gaps.
- **Placeholder scan:** no TBD/TODO/incomplete. Snippet content shown verbatim. Test cases listed concretely.
- **Type consistency:** `judgeModelId` declared in Task 4 (engine), used in Task 5 ctx with same name. `RoleModelPicker` Props in Task 3 match callsite in Task 5. `resolveDefaultModels` returns `{ orchestrator, target, judge }` — same shape used in Task 5's `$derived`.

## Out of scope (deferred from spec)

- Auto-recommending models based on objective domain.
- Per-strategy model assignment (different orchestrator per strategy).
- "Use recommended defaults" reset button.
- Live cost estimation per-run.
- Auto-rotating to fallback model on 429/5xx.
