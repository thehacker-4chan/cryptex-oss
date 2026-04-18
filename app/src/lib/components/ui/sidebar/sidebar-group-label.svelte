<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children, ...restProps }: { class?: string; children?: Snippet; [key: string]: unknown } = $props();
</script>

<div
  class={cn('flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-muted-foreground/70 outline-none', className)}
  data-sidebar-group-label
  {...restProps}
>
  {@render children?.()}
</div>
