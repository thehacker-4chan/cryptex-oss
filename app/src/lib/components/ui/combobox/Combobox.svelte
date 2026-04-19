<script lang="ts" module>
  export type ComboboxOption = {
    id: string;
    label: string;
    group?: string;
    description?: string;
  };
</script>

<script lang="ts">
  /**
   * Combobox — searchable-dropdown primitive.
   *
   * Native <input> + filtered <ul> list. Deliberately does not depend on
   * bits-ui's Combobox because that API carries substantial overhead for
   * our use (virtualization, multi-select, complex key handling) that we
   * do not need. This primitive's job is: show options, filter by input
   * text, dispatch onChange when the user picks one.
   *
   * Matching: case-insensitive substring against label + description + id
   * + group. Grouped rendering uses <li> headers styled like optgroup.
   * Keyboard nav: ArrowUp/Down to move, Enter to pick, Esc to close.
   * Clicking outside closes.
   */
  import { cn } from '$lib/utils/cn';
  import ChevronDown from 'lucide-svelte/icons/chevron-down';
  import Search from 'lucide-svelte/icons/search';

  type Props = {
    value: string;
    options: ComboboxOption[];
    placeholder?: string;
    onChange: (id: string) => void;
    class?: string;
  };

  let { value, options, placeholder = 'Search...', onChange, class: className }: Props = $props();

  let open = $state(false);
  let query = $state('');
  let activeIndex = $state(0);
  let containerEl = $state<HTMLDivElement | null>(null);
  let inputEl = $state<HTMLInputElement | null>(null);

  // The currently-selected option (for the trigger label)
  const selected = $derived(options.find((o) => o.id === value));

  // Flatten filtered options in display order; header rows have id === '__header__:<group>'.
  type Row =
    | { kind: 'header'; group: string }
    | { kind: 'option'; option: ComboboxOption };

  const filtered = $derived(() => {
    const q = query.toLowerCase().trim();
    const matches = options.filter((o) => {
      if (!q) return true;
      return (
        o.label.toLowerCase().includes(q) ||
        (o.description ?? '').toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        (o.group ?? '').toLowerCase().includes(q)
      );
    });

    // If any option has a group, render grouped with headers; otherwise flat.
    const hasGroups = matches.some((o) => o.group);
    if (!hasGroups) {
      return matches.map<Row>((option) => ({ kind: 'option', option }));
    }

    const byGroup = new Map<string, ComboboxOption[]>();
    for (const o of matches) {
      const g = o.group ?? 'Other';
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(o);
    }
    const rows: Row[] = [];
    for (const [group, opts] of byGroup) {
      rows.push({ kind: 'header', group });
      for (const option of opts) rows.push({ kind: 'option', option });
    }
    return rows;
  });

  // Only <option> rows are navigable
  const navigableIndices = $derived(() => {
    const rows = filtered();
    const idx: number[] = [];
    rows.forEach((r, i) => { if (r.kind === 'option') idx.push(i); });
    return idx;
  });

  // Reset active index when filter changes
  $effect(() => {
    void query;
    void options;
    activeIndex = 0;
  });

  function openPopover() {
    if (open) return;
    open = true;
    queueMicrotask(() => inputEl?.focus());
  }

  function closePopover() {
    open = false;
    query = '';
  }

  function pick(opt: ComboboxOption) {
    onChange(opt.id);
    closePopover();
  }

  function onTriggerClick() {
    if (open) closePopover();
    else openPopover();
  }

  function onKeydown(e: KeyboardEvent) {
    const nav = navigableIndices();
    if (nav.length === 0) {
      if (e.key === 'Escape') closePopover();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % nav.length;
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + nav.length) % nav.length;
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const rows = filtered();
      const row = rows[nav[activeIndex]];
      if (row && row.kind === 'option') pick(row.option);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closePopover();
    }
  }

  function onDocumentClick(e: MouseEvent) {
    if (!open) return;
    if (containerEl && !containerEl.contains(e.target as Node)) {
      closePopover();
    }
  }

  $effect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => onDocumentClick(e);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  });
</script>

<div bind:this={containerEl} class={cn('relative', className)}>
  <button
    type="button"
    onclick={onTriggerClick}
    aria-haspopup="listbox"
    aria-expanded={open}
    class="flex w-full items-center justify-between rounded-lg border border-border bg-background/70 px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <span class="truncate {selected ? 'text-foreground' : 'text-muted-foreground'}">
      {selected ? selected.label : placeholder}
    </span>
    <ChevronDown size={14} class="ml-2 shrink-0 text-muted-foreground" />
  </button>

  {#if open}
    <div
      role="listbox"
      class="absolute left-0 right-0 z-50 mt-1 max-h-80 overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
    >
      <div class="flex items-center border-b border-border px-3">
        <Search size={14} class="mr-2 shrink-0 text-muted-foreground" />
        <input
          bind:this={inputEl}
          bind:value={query}
          onkeydown={onKeydown}
          type="text"
          {placeholder}
          class="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <ul class="max-h-64 overflow-y-auto py-1">
        {#if filtered().length === 0}
          <li class="px-3 py-2 text-xs text-muted-foreground">No matches</li>
        {/if}
        {#each filtered() as row, i (i)}
          {#if row.kind === 'header'}
            <li
              class="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
              role="presentation"
            >
              {row.group}
            </li>
          {:else}
            {@const navIdx = navigableIndices().indexOf(i)}
            {@const isActive = navIdx === activeIndex}
            <li role="option" aria-selected={row.option.id === value}>
              <button
                type="button"
                onmouseenter={() => (activeIndex = navIdx)}
                onclick={() => pick(row.option)}
                class={cn(
                  'flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left text-xs transition-colors',
                  isActive ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-muted/40',
                  row.option.id === value ? 'font-semibold' : ''
                )}
              >
                <span class="truncate font-medium">{row.option.label}</span>
                {#if row.option.description}
                  <span class="truncate text-[10px] text-muted-foreground">{row.option.description}</span>
                {/if}
              </button>
            </li>
          {/if}
        {/each}
      </ul>
    </div>
  {/if}
</div>
