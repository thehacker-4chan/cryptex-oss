<script lang="ts">
  import { allTechniques } from '$lib/chat/techniques/registry';
  import type { Technique } from '$lib/chat/techniques/types';
  import { onMount } from 'svelte';

  let visible = $state(false);
  let x = $state(0);
  let y = $state(0);
  let selectedText = $state('');
  let composerRange = $state<{ start: number; end: number; textarea: HTMLTextAreaElement } | null>(null);
  let popoverQuery = $state('');
  let popoverEl = $state<HTMLDivElement | null>(null);

  // Only local (deterministic) techniques in the popover — no LLM call needed
  const localTechniques = allTechniques().filter((t) => t.local);

  const visibleTechniques = $derived((): Technique[] => {
    const q = popoverQuery.toLowerCase().trim();
    if (!q) return localTechniques.slice(0, 30);
    return localTechniques.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    ).slice(0, 30);
  });

  function clampToViewport(px: number, py: number, width = 288, height = 260): { x: number; y: number } {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let cx = Math.min(px, vw - width - 8);
    cx = Math.max(cx, 8);
    let cy = py;
    // Prefer below selection; flip above if not enough room
    if (cy + height > vh - 8) cy = py - height - 28;
    cy = Math.max(cy, 8);
    return { x: cx, y: cy };
  }

  function onMouseUp(e: MouseEvent) {
    // Small delay so selection is finalised
    requestAnimationFrame(() => {
      // Only activate for selections inside the composer textarea
      const active = document.activeElement as HTMLTextAreaElement | null;
      const composerEl = active?.closest?.('.composer-textarea');
      const textarea = composerEl?.querySelector('textarea') as HTMLTextAreaElement | null;

      if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
        const text = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd).trim();
        if (!text || text.length < 2) { visible = false; return; }
        selectedText = text;
        composerRange = { start: textarea.selectionStart, end: textarea.selectionEnd, textarea };
        const pos = clampToViewport(e.clientX + window.scrollX, e.clientY + window.scrollY + 12);
        x = pos.x; y = pos.y;
        popoverQuery = '';
        visible = true;
        return;
      }

      // Selection outside composer — dismiss popover, do nothing
      visible = false;
      composerRange = null;
    });
  }

  function onDocClick(e: MouseEvent) {
    if (!visible) return;
    if (popoverEl && popoverEl.contains(e.target as Node)) return;
    visible = false;
    composerRange = null;
  }

  async function applyTechnique(t: Technique) {
    if (!t.local) return;
    const result = await t.apply(selectedText, { originalInput: selectedText, callLLM: async () => '', signal: undefined as unknown as AbortSignal });
    const output = result.output;

    if (composerRange) {
      const { start, end, textarea } = composerRange;
      textarea.setRangeText(output, start, end, 'end');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      window.dispatchEvent(
        new CustomEvent('technique:apply-selection', {
          detail: { techniqueId: t.id, selectedText, transformed: output }
        })
      );
    }
    visible = false;
    composerRange = null;
  }

  onMount(() => {
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('click', onDocClick, true);
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('click', onDocClick, true);
    };
  });
</script>

{#if visible}
  <div
    bind:this={popoverEl}
    role="menu"
    class="fixed z-40 w-72 rounded-lg border border-border/60 bg-popover shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
    style="left: {x}px; top: {y}px;"
  >
    <div class="px-2 pt-2">
      <!-- svelte-ignore a11y_autofocus -->
      <input
        autofocus
        type="text"
        bind:value={popoverQuery}
        placeholder="Filter techniques…"
        class="w-full rounded border border-border/40 bg-background px-2 py-1 text-xs outline-none focus:border-primary/50"
      />
    </div>
    <div class="max-h-48 overflow-y-auto cryptex-scroll p-1">
      {#each visibleTechniques() as t (t.id)}
        <button
          type="button"
          role="menuitem"
          onclick={() => applyTechnique(t)}
          class="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted/40 transition-colors"
        >
          <span class="mt-0.5 shrink-0 text-muted-foreground">{t.icon ?? '◈'}</span>
          <span class="flex flex-col min-w-0">
            <span class="font-medium text-foreground">{t.name}</span>
            <span class="truncate text-[10px] text-muted-foreground">{t.description}</span>
          </span>
        </button>
      {/each}
      {#if visibleTechniques().length === 0}
        <p class="px-2 py-3 text-center text-[11px] text-muted-foreground">No techniques match "{popoverQuery}"</p>
      {/if}
    </div>
  </div>
{/if}
