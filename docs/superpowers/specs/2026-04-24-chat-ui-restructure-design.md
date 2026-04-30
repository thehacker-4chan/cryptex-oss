# Chat UI Restructure Design

**Status:** Approved, ready for implementation plan.

**Trigger:** User-reported issues from a v3 smoke screenshot:
1. Chain/Godmode toggle duplicated in chat header AND right-sidebar tab strip.
2. Right sidebar visually different from left — needs to be a detached tile mirroring left silhouette + style.
3. Both sidebars need independent stretch/resize.
4. Cold-load + tab switches snap; need blended animation.
5. `Godmode` pill in composer is stale.

## Goal

Tighten the Chat workspace UI so the toggle has one home, both sidebars look like peer tiles, the user can resize both, route navigation feels smooth (skeleton + fade), and the composer drops the legacy mode pill row.

## Non-goals

- New attack/chat features.
- Backend / engine changes.
- Mobile-specific layout reflows (current layout is desktop-first; responsive remains a follow-up).
- Migration UX for old persisted layout widths (read-side fallback handles missing values).

## Locked decisions (from brainstorm Q1–Q5)

- **Q1 = (a)** Toggle lives in chat header only. Right sidebar tab strip deleted.
- **Q2 = (c)** Right tile = detached, with hybrid header: small `Attack workspace · <ToolName>` label + collapsible `History` disclosure, then active form.
- **Q3 = (a)** Both tiles independently resizable via drag handles, persisted per chat.
- **Q4 = (c)** Cold-load skeleton + opacity fade; warm tab switches use opacity fade only.
- **Q5 = (b)** Delete entire composer mode-pill row. Mode selection moves to chat-header `⋮` submenu.

---

## Architecture

```
┌─ ChatWorkspaceLayout ─────────────────────────────────────────┐
│ ┌─ Left tile ─┐ ┌─ Center column (flex) ─┐ ┌─ Right tile ─┐ │
│ │ +New chat   │ │ Chat header:           │ │ Attack       │ │
│ │ chat list   │ │   model pill           │ │ workspace ·  │ │
│ │ search      │ │   [Chain|Godmode] seg  │ │ <ToolName>   │ │
│ │             │ │   ⋮ menu (Mode submnu) │ │ History ▾    │ │
│ │             │ │ Conversation pane      │ │ Active form  │ │
│ │ ▶︎drag-handle│ │ Composer (no pills)    │ │ ◀︎drag-handle│ │
│ └─────────────┘ └────────────────────────┘ └──────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

The center column flexes between the two fixed-width sidebars. Each sidebar has one drag handle on its inner edge. Layout persists per chat via two new fields on `ChatSettings`.

Route container wrapped in `<RouteShell>` providing the cold-load skeleton + fade timing.

---

## Section 1 — Single toggle in chat header

### Removal

`AttackWorkspaceSidebar.svelte`'s in-tile tab strip — the row that renders `[Chain | Godmode]` at the top of the right sidebar — deleted entirely. The sidebar reads `chat.settings.activeAttackTool` (existing field, just consume directly) and renders ONE tool's form.

### Addition

Inside `ChatWorkspace.svelte`'s header, next to the model pill:

```svelte
<div class="inline-flex rounded-md border border-border/40 bg-background/30 p-0.5 text-[11px]">
  <button
    type="button"
    onclick={() => setActiveTool('chain')}
    class={'inline-flex items-center gap-1 rounded px-2 py-1 transition ' +
      (activeTool === 'chain' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground')}
  >
    <Zap size={11} /> Chain
  </button>
  <button
    type="button"
    onclick={() => setActiveTool('godmode')}
    class={'inline-flex items-center gap-1 rounded px-2 py-1 transition ' +
      (activeTool === 'godmode' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground')}
  >
    <Sparkles size={11} /> Godmode
  </button>
</div>
```

`setActiveTool(tool)` patches `chat.settings.activeAttackTool` via existing repo pathway. Sidebar reactively swaps form.

---

## Section 2 — Detached right tile with hybrid header

### Tile chrome (matches left)

Outer wrapper around current sidebar content gets `rounded-lg border border-border/40 bg-card/40 shadow-sm` (or whatever the left tile uses — read existing `ChatListSidebar.svelte` for the exact class set and copy).

### Header

```svelte
<div class="flex items-center justify-between border-b border-border/40 px-3 py-2 text-xs">
  <div class="flex items-center gap-2">
    <span class="text-muted-foreground">Attack workspace</span>
    <span class="text-muted-foreground">·</span>
    <span class="font-medium text-foreground">{toolLabel}</span>
  </div>
  <button
    type="button"
    onclick={() => (historyOpen = !historyOpen)}
    class="inline-flex items-center gap-1 rounded text-[10px] text-muted-foreground hover:text-foreground"
  >
    <ChevronRight size={10} class={historyOpen ? 'rotate-90 transition-transform' : 'transition-transform'} />
    History ({sessionCount})
  </button>
</div>

{#if historyOpen}
  <AttackHistoryDisclosure {chat} {activeTool} onLoad={loadSession} />
{/if}

<div class="flex-1 overflow-hidden">
  {#if activeTool === 'chain'}
    <AttackChainTab {chat} onInsertToComposer={() => {}} />
  {:else}
    <GodmodeTab {chat} />
  {/if}
</div>
```

`toolLabel` derives from `activeTool`: `'Chain'` or `'Godmode'`.

### `AttackHistoryDisclosure.svelte` (new component)

Lists past attack sessions for the current chat. For Chain: reuses `repo.listAttackSessions(chat.id)`. For Godmode: reuses `repo.listGodmodeRuns(chat.id)`. Renders a flat scrollable list; clicking a session emits `onLoad(session)` to populate the tile body.

When the tool toggle flips, the disclosure re-queries the right table.

---

## Section 3 — Independent resize handles

### Layout shell — `ChatWorkspaceLayout.svelte`

Three-column CSS Grid:

```css
.chat-workspace-layout {
  display: grid;
  grid-template-columns: var(--left-width, 320px) 1fr var(--right-width, 440px);
  gap: 12px;
}
```

Widths bound to local `$state` mirroring `chat.settings.leftSidebarWidth` and `chat.settings.rightSidebarWidth`. On first render, fall back to defaults if missing (320 / 440).

### Drag handle (left tile, right edge)

A 4px-wide invisible strip overlaid on the tile's right border, with `cursor-col-resize`. `pointerdown` starts a drag; `pointermove` updates `leftWidth` clamped `[280, 560]`; `pointerup` calls `repo.updateChat(chat.id, { settings: { leftSidebarWidth: leftWidth } })`.

### Drag handle (right tile, left edge)

Mirror: 4px strip on the tile's left border. `pointermove` updates `rightWidth` clamped `[320, 640]`. Persistence identical.

### Implementation note

Use `document.addEventListener('pointermove', ...)` + `document.addEventListener('pointerup', ...)` during drag (not the strip's own listener) so the user can drag past the tile boundary without losing pointer capture.

### Persistence schema

In `app/src/lib/chat/types.ts`, extend `ChatSettings`:

```ts
export interface ChatSettings {
  // ...existing fields...
  leftSidebarWidth?: number;   // px, clamped [280, 560]
  rightSidebarWidth?: number;  // px, clamped [320, 640]
}
```

Both optional; reader falls back to defaults.

---

## Section 4 — Skeleton + fade route transitions

### `RouteShell.svelte` (new component)

Wraps every page-level slot. Manages two states:

- `coldLoad`: true on first mount in this browser session (read from `sessionStorage.getItem('cryptex.routeShell.warm')`); false on subsequent navigations.
- `mounted`: flips true after the actual content's first paint.

Render logic:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  type Props = { skeleton?: 'chat' | 'tools' | null; children: import('svelte').Snippet };
  let { skeleton = null, children }: Props = $props();

  let coldLoad = $state(typeof window !== 'undefined' && !sessionStorage.getItem('cryptex.routeShell.warm'));
  let mounted = $state(false);

  onMount(() => {
    if (typeof window !== 'undefined') sessionStorage.setItem('cryptex.routeShell.warm', '1');
    // After first paint, hide skeleton and crossfade to content
    requestAnimationFrame(() => { mounted = true; });
  });
</script>

<div class="route-shell" class:warm={!coldLoad} class:mounted>
  {#if coldLoad && skeleton && !mounted}
    <div class="skeleton-overlay">
      {#if skeleton === 'chat'}
        <ChatSkeleton />
      {:else if skeleton === 'tools'}
        <ToolsSkeleton />
      {/if}
    </div>
  {/if}
  <div class="content">
    {@render children()}
  </div>
</div>

<style>
  .route-shell { position: relative; height: 100%; }
  .content {
    opacity: 0;
    transition: opacity 200ms ease-out;
  }
  .route-shell.warm .content,
  .route-shell.mounted .content {
    opacity: 1;
  }
  .skeleton-overlay {
    position: absolute; inset: 0; z-index: 1;
    animation: skeleton-fade-out 250ms 200ms ease-out forwards;
    pointer-events: none;
  }
  @keyframes skeleton-fade-out {
    to { opacity: 0; }
  }
</style>
```

### `ChatSkeleton.svelte` (new)

Three "message" rows with the project's existing shimmer treatment (search the codebase for an existing skeleton pattern; reuse if present). One avatar circle + two text bars per row, alternating user/assistant alignment.

### `ToolsSkeleton.svelte` (new)

Four full-width shimmer bars sized like tool tiles.

### Wiring

- `app/src/routes/chat/+layout.svelte` (or the chat route's parent) — wrap children in `<RouteShell skeleton="chat">`.
- `app/src/routes/(transforms)/+layout.svelte` (or wherever `/transform`, `/decode`, `/emoji`, `/settings` live) — wrap children in `<RouteShell skeleton="tools">`.
- Other routes (e.g., `/dataset`, `/guide`) — wrap with `<RouteShell skeleton={null}>` for fade-only behavior.

---

## Section 5 — Composer cleanup + Mode submenu

### Delete from `Composer.svelte`

Find the chip row containing `creative`, `intelligent`, `adaptive`, `godmode`. Delete the entire `<div>` that wraps them. The Composer renders only:

- The textarea
- Attach button
- Send button

### Add to chat header `⋮` menu

The existing `ChatHeader.svelte` already has a `⋮` menu (per CLAUDE.md). Add a `Mode` submenu entry above existing items:

```svelte
<DropdownMenu.Sub>
  <DropdownMenu.SubTrigger>
    <span>Mode</span>
    <span class="ml-auto text-[10px] text-muted-foreground">{currentMode}</span>
  </DropdownMenu.SubTrigger>
  <DropdownMenu.SubContent>
    {#each ['creative', 'intelligent', 'adaptive'] as m (m)}
      <DropdownMenu.Item onclick={() => setMode(m)}>
        <Check size={10} class={currentMode === m ? '' : 'invisible'} />
        <span class="ml-1 capitalize">{m}</span>
      </DropdownMenu.Item>
    {/each}
  </DropdownMenu.SubContent>
</DropdownMenu.Sub>
```

`godmode` deleted — not in the modes list.

`setMode(m)` calls existing `repo.updateChat(chat.id, { mode: m })`.

If the project's dropdown library doesn't support submenus, fall back to a flat menu with mode items prefixed by `Mode: <name>` and grouped under a small `<DropdownMenu.Label>` separator.

---

## Data model changes

`app/src/lib/chat/types.ts` — `ChatSettings` extension:

```ts
leftSidebarWidth?: number;   // px, clamped [280, 560], default 320
rightSidebarWidth?: number;  // px, clamped [320, 640], default 440
```

No Dexie migration needed — additive optional fields. Existing rows fall back to defaults at read.

---

## File surface

| File | Action | Notes |
|---|---|---|
| `app/src/lib/components/chat/workspace/ChatWorkspaceLayout.svelte` | Create or modify | 3-col grid + drag handles + persistence |
| `app/src/lib/components/chat/workspace/ChatWorkspace.svelte` | Modify | Add segmented Chain/Godmode control to header; `setActiveTool` |
| `app/src/lib/components/chat/workspace/ChatHeader.svelte` | Modify | Add `Mode` submenu under `⋮` |
| `app/src/lib/components/chat/workspace/AttackWorkspaceSidebar.svelte` | Modify | Remove tab strip; add tile chrome + hybrid header; add left-edge drag handle |
| `app/src/lib/components/chat/workspace/AttackHistoryDisclosure.svelte` | Create | Per-chat session list (Chain or Godmode based on activeTool) |
| `app/src/lib/components/chat/workspace/RouteShell.svelte` | Create | Skeleton + fade timing |
| `app/src/lib/components/chat/workspace/ChatSkeleton.svelte` | Create | 3-row shimmer |
| `app/src/lib/components/chat/workspace/ToolsSkeleton.svelte` | Create | 4-bar shimmer |
| `app/src/lib/components/chat/composer/Composer.svelte` | Modify | Delete mode-pill row |
| `app/src/lib/chat/types.ts` | Modify | Extend `ChatSettings` |
| `app/src/lib/chat/repo.ts` | No change | `updateChat` accepts partial `settings` patches already |
| `app/src/routes/chat/+layout.svelte` | Modify | Wrap with `<RouteShell skeleton="chat">` |
| `app/src/routes/+layout.svelte` (or per-tool route layouts) | Modify | Wrap tool routes with `<RouteShell skeleton="tools">` |

---

## Test plan

### Unit / component
- `RouteShell.test.ts` — cold mount renders skeleton; warm mount skips skeleton; transitions to content via `requestAnimationFrame`.
- `ChatSettings` schema test — width fields optional, defaults applied on missing.

### Smoke (manual)
1. Open chat, verify segmented control in header switches sidebar content.
2. Resize left tile via right-edge handle; refresh page; width persisted.
3. Resize right tile via left-edge handle; refresh page; width persisted.
4. Open new browser tab → cold-load shows skeleton briefly → fades to chat.
5. In same tab, click `/tools` → instant fade transition (no skeleton).
6. Open `⋮` menu → Mode submenu lists creative/intelligent/adaptive with check on active.
7. Verify composer no longer shows mode pills.
8. Toggle Chain ↔ Godmode via header segmented control; right tile body swaps; History disclosure list updates.

---

## Risks

1. **Submenu support** in shadcn-svelte dropdown component — verify before committing the submenu approach. Fallback in Section 5 covers it.
2. **Drag-handle pointer capture** on Windows touchpads — `setPointerCapture` on the strip is the safe pattern; use it.
3. **Skeleton flicker** — if real content paints in <16ms, skeleton appears as a single-frame flash. Mitigate with a 60ms minimum show time before crossfading out.
4. **`activeAttackTool` field** may not exist yet on `ChatSettings`. If not present, this design adds it (string union: `'chain' | 'godmode'`, default `'chain'`).

---

## Out of scope (deferred)

- Mobile / tablet layout breakpoints.
- Keyboard shortcut to toggle Chain/Godmode (e.g., `Cmd+Shift+J`).
- Per-route skeleton variants for Dataset / Guide / Settings.
- Animated transitions for sidebar width (currently raw drag → instant width).
- Resizable center column (it just flexes).

---

## Scope coverage checklist

| Brainstorm decision | Implementing section |
|---|---|
| Q1 toggle in chat header only | Section 1 |
| Q2 detached tile + hybrid header | Section 2 |
| Q3 independent drag handles | Section 3 |
| Q4 skeleton + fade hybrid | Section 4 |
| Q5 composer mode-pill row deleted | Section 5 |
