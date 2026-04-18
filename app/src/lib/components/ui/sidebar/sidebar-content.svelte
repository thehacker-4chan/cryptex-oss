<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children, ...restProps }: { class?: string; children?: Snippet; [key: string]: unknown } = $props();
</script>

<div class={cn('flex min-h-0 flex-1 flex-col gap-2 overflow-auto', className)} data-sidebar-content {...restProps}>
  {@render children?.()}
</div>
