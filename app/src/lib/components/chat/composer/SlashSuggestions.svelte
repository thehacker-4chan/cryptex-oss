<script lang="ts" module>
  export type SlashEntry = {
    id: string;
    name: string;
    description: string;
    icon?: string;
    group?: string;  // 'Mutators' | 'Composites' | 'Utility'
  };
</script>

<script lang="ts">
  /**
   * Cmd-K style slash command picker.
   *
   * Upgrades over the original: a text input at the top that fuzzy-filters
   * the suggestion list (in addition to the draft-based pre-filter done by
   * Composer.svelte). Rows are grouped by category headers (Mutators,
   * Composites, Utility). Keyboard navigation is preserved: ArrowUp/Down
   * move the highlight, Enter/Tab pick the highlighted row, Escape is
   * handled by the parent composer (clears the draft).
   *
   * Props:
   * - suggestions: pre-filtered entries from the Composer's draft-prefix match
   * - selectedIndex: keyboard-navigation index, controlled by the parent
   * - onSelect: callback when a row is picked by click
   * - query: the current slash query (so the popover can reset when the
   *   parent query changes)
   */
  import Search from 'lucide-svelte/icons/search';

  type Props = {
    suggestions: SlashEntry[];
    selectedIndex: number;
    onSelect: (t: SlashEntry) => void;
    query?: string;
  };
  let { suggestions, selectedIndex, onSelect, query = '' }: Props = $props();

  let innerQuery = $state('');

  // Reset the inline filter whenever the parent's slash query changes — keeps
  // the popover's own search in sync with what the user has typed so far.
  $effect(() => {
    void query;
    innerQuery = '';
  });

  const filtered = $derived(() => {
    const q = innerQuery.toLowerCase().trim();
    if (!q) return suggestions;
    return suggestions.filter((t) =>
      t.id.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      (t.group ?? '').toLowerCase().includes(q)
    );
  });

  // Build a flat rows list with group headers. Each navigable row carries its
  // index in the flat-suggestions array so the parent's selectedIndex still
  // applies when the inner filter narrows the list.
  type Row =
    | { kind: 'header'; group: string }
    | { kind: 'entry'; entry: SlashEntry };

  const rows = $derived(() => {
    const list = filtered();
    const hasGroups = list.some((t) => t.group);
    if (!hasGroups) return list.map<Row>((entry) => ({ kind: 'entry', entry }));
    const byGroup = new Map<string, SlashEntry[]>();
    for (const t of list) {
      const g = t.group ?? 'Other';
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(t);
    }
    const out: Row[] = [];
    for (const [group, entries] of byGroup) {
      out.push({ kind: 'header', group });
      for (const entry of entries) out.push({ kind: 'entry', entry });
    }
    return out;
  });
</script>

{#if suggestions.length > 0}
  <div
    role="listbox"
    aria-label="Slash command suggestions"
    class="absolute bottom-full left-0 z-50 mb-1 w-96 overflow-hidden rounded-lg border border-border/60 bg-popover shadow-lg"
  >
    <div class="flex items-center border-b border-border/60 px-3">
      <Search size={12} class="mr-2 shrink-0 text-muted-foreground" />
      <input
        bind:value={innerQuery}
        type="text"
        placeholder="Search techniques..."
        class="h-9 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
      />
    </div>
    <div class="max-h-80 overflow-y-auto py-1">
      {#if filtered().length === 0}
        <div class="px-3 py-2 text-xs text-muted-foreground">No matches</div>
      {/if}
      {#each rows() as row, i (i)}
        {#if row.kind === 'header'}
          <div class="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {row.group}
          </div>
        {:else}
          {@const entry = row.entry}
          {@const parentIdx = suggestions.findIndex((s) => s.id === entry.id)}
          {@const isActive = parentIdx === selectedIndex}
          <button
            type="button"
            role="option"
            aria-selected={isActive}
            onclick={() => onSelect(entry)}
            class="flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs transition-colors
              {isActive ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-muted/40'}"
          >
            <span class="mt-0.5 text-base leading-none">{entry.icon ?? '*'}</span>
            <span class="flex min-w-0 flex-col">
              <span class="font-mono font-semibold">/{entry.id}</span>
              <span class="truncate text-[10px] text-muted-foreground">{entry.description}</span>
            </span>
          </button>
        {/if}
      {/each}
    </div>
  </div>
{/if}
