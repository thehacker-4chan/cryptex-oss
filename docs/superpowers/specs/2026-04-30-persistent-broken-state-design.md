# Persistent Broken-State (Subsystem B) Design

**Status:** Approved, ready for implementation plan.

**Trigger:** Today, after a successful Chain attack reaches `extracted`, the user goes back to the main chat to ask follow-ups. The target re-aligns and refuses again — losing all the context the Chain run paid for. Subsystem B persists the won transcript as the chat's working context so subsequent main-chat sends inherit broken state.

## Goal

Let users pin any past Chain session as a chat's working context. While pinned, every main-chat send prepends the won session's transcript (orchestrator turns as `user`, target turns as `assistant`) to the LLM message array — the target sees the conversation as continuing from the won state.

## Non-goals

- Multi-pin (one pin per chat).
- Cross-chat pin (one session pinned to many chats).
- Editable pinned transcript (the snapshot is the live session row, transparently kept in sync).
- Auto-unpin heuristics (manual unpin only).
- Visual highlight per-message of "from broken state" vs "fresh."
- Pinning Godmode runs (Chain only — Godmode is a separate surface).

## Locked decisions (from brainstorm Q1–Q3)

- **Q1 = (a)** Manual pin button. No auto-activation.
- **Q2 = (a)** Full chain transcript injection — orchestrator turns as `user`, target turns as `assistant`, prepended to every main-chat send while pinned.
- **Q3 = (a)** Banner above composer is the indicator + sole unpin location.

---

## Architecture

```
Chat send flow when pinned:

User types in composer  ──▶  dispatch.sendTurn(chat, text)
                                         │
                                         ├─ read chat.settings.persistedAttackSessionId
                                         │
                                         ├─ if set:
                                         │     repo.getAttackSession(id)
                                         │       │
                                         │       ├─ found: transform turns ─▶ prepend to message array
                                         │       └─ missing: clear pin + log warn ─▶ continue without prefix
                                         │
                                         └─ streamChat({ messages: [...prefix, ...history, userTurn] })
```

Three actors:
- **`repo`** owns persistence (`pinAttackSession`, `unpinAttackSession`, `getAttackSession`).
- **`dispatch.sendTurn`** owns runtime injection — reads pin field, fetches session, prepends, sends.
- **UI** owns activation (`AttackChainTab` + `AttackSessionHistory` Pin buttons) and clearing (`PinnedSessionBanner` Unpin button).

---

## Section 1 — Persistence

Extend `ChatSettings` (in `app/src/lib/chat/types.ts`) with one optional field:

```ts
export interface ChatSettings {
  // ...existing fields...
  /** v3.2: pin a past Chain session's transcript as the chat's working context.
   *  When set, dispatch.sendTurn prepends the session's turns to every send so
   *  the target sees the conversation as continuing from the won state. Missing
   *  / deleted sessions trigger silent unpin at send time. */
  persistedAttackSessionId?: string;
}
```

No migration. Read-side: `dispatch.sendTurn` reads at every send and tolerates a missing field cleanly (treats as "not pinned").

---

## Section 2 — Repo additions

Three new methods on `repo` (file: `app/src/lib/chat/repo.ts`):

```ts
/** Singular accessor — fetches one AttackSessionRow by id, respecting ownerId
 *  and tombstoned. Returns null when missing. Used by dispatch.sendTurn at
 *  pin-resolution time. */
async getAttackSession(id: string): Promise<AttackSessionRow | null> {
  const row = await db.attackSessions.get(id);
  if (!row || row.ownerId !== ownerId() || row.tombstoned) return null;
  return backfillV3(row);
}

/** Set the chat's pinned session id. */
async pinAttackSession(chatId: string, sessionId: string): Promise<void> {
  const chat = await db.chats.get(chatId);
  if (!chat || chat.ownerId !== ownerId()) return;
  await db.chats.put(JSON.parse(JSON.stringify({
    ...chat,
    settings: { ...(chat.settings ?? {}), persistedAttackSessionId: sessionId },
    updatedAt: Date.now()
  })));
}

/** Clear the chat's pinned session id. */
async unpinAttackSession(chatId: string): Promise<void> {
  const chat = await db.chats.get(chatId);
  if (!chat || chat.ownerId !== ownerId()) return;
  const next = { ...(chat.settings ?? {}) };
  delete (next as { persistedAttackSessionId?: string }).persistedAttackSessionId;
  await db.chats.put(JSON.parse(JSON.stringify({
    ...chat,
    settings: next,
    updatedAt: Date.now()
  })));
}
```

`getAttackSession` reuses the existing `backfillV3` helper for read-side compat with pre-v3 rows.

`pinAttackSession` + `unpinAttackSession` write through `repo.updateChat`-style patterns (full-row put, JSON-clone for IndexedDB structured-clone safety).

---

## Section 3 — Dispatch integration

Modify `app/src/lib/chat/dispatch.ts` `sendTurn` (and any sibling `streamChat`-calling helper that handles main-chat sends — typically `sendTurn` is the single entry point).

### Read-and-prepend flow

Before constructing the messages array sent to `streamChat`:

```ts
async function resolvePinnedPrefix(chat: ChatRow): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const pinId = chat.settings?.persistedAttackSessionId;
  if (!pinId) return [];
  const session = await repo.getAttackSession(pinId);
  if (!session) {
    console.warn('[dispatch] pinned session missing, auto-unpinning:', pinId);
    await repo.unpinAttackSession(chat.id);
    return [];
  }
  return session.turns.map((t) => ({
    role: t.role === 'orchestrator' ? ('user' as const) : ('assistant' as const),
    content: t.text
  }));
}
```

In `sendTurn`, before the existing message-array construction:

```ts
const pinnedPrefix = await resolvePinnedPrefix(chat);
const messages = [
  ...pinnedPrefix,
  ...existingHistory,
  userTurn
];
```

The prefix is added on EVERY send while pinned (not cached) — keeps state perfectly fresh against any session edits.

### What gets prepended

`session.turns` is `AttackSessionTurn[]`. Each turn:
- `role: 'orchestrator'` → outgoing `{ role: 'user', content }`
- `role: 'target'` → outgoing `{ role: 'assistant', content }`

The mapping mirrors the existing `injectAttackSessionTurn` flow used by the "Send thread to main chat" button — same conceptual transformation.

### Token budget concern

A 24-turn session at ~500 chars/turn ≈ 12K chars ≈ ~3K tokens of prefix. Acceptable for any modern context. Document in the guide that pinning extends prompt size.

---

## Section 4 — UI: PinnedSessionBanner

New component `app/src/lib/components/chat/composer/PinnedSessionBanner.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import type { ChatRow, AttackSessionRow } from '$lib/chat/types';
  import { repo } from '$lib/chat/repo';
  import Pin from 'lucide-svelte/icons/pin';
  import X from 'lucide-svelte/icons/x';

  type Props = { chat: ChatRow };
  let { chat }: Props = $props();

  let session = $state<AttackSessionRow | null>(null);
  let loading = $state(false);

  $effect(() => {
    const id = chat.settings?.persistedAttackSessionId;
    if (!id) { session = null; return; }
    loading = true;
    void repo.getAttackSession(id).then((row) => {
      session = row;
      loading = false;
    });
  });

  async function unpin() {
    await repo.unpinAttackSession(chat.id);
  }

  function preview(s: string, n = 60): string {
    const t = s.trim();
    return t.length <= n ? t : t.slice(0, n) + '…';
  }
</script>

{#if session}
  <div class="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-[11px]">
    <Pin size={11} class="shrink-0 mt-0.5 text-primary" />
    <div class="flex-1 min-w-0">
      <div class="flex items-baseline gap-2">
        <span class="font-medium text-foreground">Pinned</span>
        <span class="truncate text-muted-foreground">{preview(session.objective)}</span>
        <span class="ml-auto text-[10px] text-muted-foreground">{session.turns.length} turns</span>
      </div>
      <p class="mt-0.5 text-[10px] text-muted-foreground">Replies prepended with the won transcript. Unpin to send normally.</p>
    </div>
    <button
      type="button"
      onclick={unpin}
      aria-label="Unpin session"
      class="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
    ><X size={11} /></button>
  </div>
{/if}
```

### Mount point

`app/src/lib/components/chat/composer/Composer.svelte` — insert `<PinnedSessionBanner {chat} />` immediately above the textarea wrapper (above any existing input chrome).

The banner only renders when `session !== null` — no visual cost when not pinned.

---

## Section 5 — UI: Pin actions

### `AttackChainTab.svelte` — Pin button on final-summary card

Inside the existing final-summary card markup (gated by `{#if finalOutcome}`), in the action-button row alongside the existing "Send thread to main chat" button, append:

```svelte
<button
  type="button"
  onclick={pinCurrentSession}
  class="inline-flex items-center gap-1 rounded border border-primary/30 px-2 py-1 text-[10px] text-primary hover:bg-primary/10"
>
  <Pin size={10} /> Pin to chat
</button>
```

Handler:

```ts
async function pinCurrentSession() {
  if (!currentSessionId) return;
  await repo.pinAttackSession(chat.id, currentSessionId);
  showToast('success', 'Pinned. Subsequent main-chat sends will use this session as context.');
}
```

If the chat already has a pinned session, calling `pinAttackSession` overwrites it — no special UI for replacement.

### `AttackSessionHistory.svelte` — Pin button in expanded detail

In the expanded-detail block (inside `{#if expanded.has(row.id)}`), in the action-icon row alongside the existing Promote / Delete buttons, append:

```svelte
<button
  type="button"
  onclick={() => onPin(row)}
  aria-label="Pin to chat"
  class="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
><Pin size={11} /></button>
```

`AttackSessionHistory.Props` adds `onPin: (session: AttackSessionRow) => void` callback. AttackChainTab supplies it:

```ts
async function pinSession(session: AttackSessionRow) {
  await repo.pinAttackSession(chat.id, session.id);
  showToast('success', `Pinned: ${session.objective.slice(0, 40)}…`);
}
```

(Visually distinguish pinned-vs-not by adding a small filled-pin badge on the row when `row.id === chat.settings?.persistedAttackSessionId` — single rounded pill `Pinned` next to the outcome label.)

---

## Section 6 — File surface

| File | Action |
|---|---|
| `app/src/lib/chat/types.ts` | Extend `ChatSettings` with `persistedAttackSessionId?: string` |
| `app/src/lib/chat/repo.ts` | Add `getAttackSession`, `pinAttackSession`, `unpinAttackSession` |
| `app/src/lib/chat/__tests__/repo.test.ts` | Tests for the three new methods |
| `app/src/lib/chat/dispatch.ts` | Add `resolvePinnedPrefix`; prepend in `sendTurn` |
| `app/src/lib/chat/__tests__/dispatch.test.ts` | Pinned-prefix integration tests |
| `app/src/lib/components/chat/composer/PinnedSessionBanner.svelte` | Create |
| `app/src/lib/components/chat/composer/Composer.svelte` | Render banner above textarea |
| `app/src/lib/components/chat/attack-chain/AttackChainTab.svelte` | Add Pin button on final summary; pin handler; pinSession dispatch into history |
| `app/src/lib/components/chat/attack-chain/AttackSessionHistory.svelte` | Add `onPin` prop; Pin icon button in expanded detail; pinned-state badge on row |

---

## Section 7 — Test plan

### Unit (repo)
- `getAttackSession(id)` returns the row when present + owner-matched + not tombstoned; returns null otherwise.
- `pinAttackSession(chatId, sessionId)` writes the field; verifiable via `repo.getChat`.
- `unpinAttackSession(chatId)` removes the field cleanly.

### Unit (dispatch)
- `sendTurn` on a non-pinned chat: messages array contains only the chat's existing history + the user turn. No prefix.
- `sendTurn` on a pinned chat: messages array starts with the pinned session's turns (orchestrator→user, target→assistant), then the chat history, then the user turn.
- Pinned chat with deleted session: `sendTurn` clears the pin field, logs a warning, sends without prefix.

### Component (banner)
- Renders nothing when `chat.settings?.persistedAttackSessionId` is undefined.
- Renders the banner with objective preview + turn count when pinned.
- Clicking × calls `repo.unpinAttackSession(chat.id)`.
- Banner re-mounts (clears) when the chat's pin field changes.

### Manual smoke
1. Run a Chain attack → click "Pin to chat" on the final-summary card. Banner appears above composer with objective + turn count.
2. Send a follow-up in main chat. Inspect Network → verify the request body contains the pinned transcript as user/assistant message pairs at the start of `messages`.
3. Click × on banner. Banner disappears; next send no longer carries the prefix.
4. Pin a different session from History → verify the new pin replaces the old.
5. Delete the pinned session from History → reload. Banner does not appear; pin auto-cleared.

---

## Section 8 — Risks

1. **Token budget on long pinned sessions.** A 24-turn session ≈ 3K tokens of prefix per send. On models with small context, this can crowd out conversation history. Mitigation: document in the guide; consider future "Trim pin to last N turns" follow-up.
2. **Auto-clear on missing session is silent.** User pins, deletes the session, sends — pin clears with only a console warning. The next send appears to "forget" the pin context. Acceptable: deletion is rare, console warning is enough for debugging. Could add a toast in a future polish pass.
3. **Pinned transcript and current session conflicting context.** If a chat already has lots of conversation history before pinning, the prefix lands BEFORE that history — model sees won transcript, then unrelated history, then new send. Order: `[...pinnedPrefix, ...existingHistory, userTurn]` is the most semantically honest (the won conversation came first chronologically). Document.
4. **Pin survives chat archival but not chat deletion.** When user deletes a chat, the pin field goes with it. No cleanup needed.

---

## Out of scope (deferred)

- Trim pin to last N turns / smart token budgeting.
- Auto-unpin after N consecutive refusals (signal that the model has re-aligned despite pin).
- Multi-pin (combine multiple session contexts).
- Cross-chat pin (one session pinned across chats).
- Visual per-message highlight of "from broken state."
- Pinning Godmode runs.
- Re-running the extractor on demand from a pinned session.

## Scope coverage checklist

| Brainstorm decision | Section |
|---|---|
| Q1 manual pin (button) | 5 |
| Q2 full transcript injection | 3 |
| Q3 banner above composer | 4 |
| Persistence | 1, 2 |
| Graceful missing-session | 3 |
| Test plan | 7 |
