<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, isActive = false, children, ...restProps }: { class?: string; isActive?: boolean; children?: Snippet; [key: string]: unknown } = $props();
</script>

<button
  class={cn(
    'flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 active:bg-accent active:text-accent-foreground disabled:pointer-events-none disabled:opacity-50',
    isActive && 'bg-accent font-medium text-accent-foreground',
    className
  )}
  data-sidebar-menu-button
  data-active={isActive}
  {...restProps}
>
  {@render children?.()}
</button>
