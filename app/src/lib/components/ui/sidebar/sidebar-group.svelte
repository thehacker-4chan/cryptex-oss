<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children, ...restProps }: { class?: string; children?: Snippet; [key: string]: unknown } = $props();
</script>

<div class={cn('relative flex w-full min-w-0 flex-col p-2', className)} data-sidebar-group {...restProps}>
  {@render children?.()}
</div>
