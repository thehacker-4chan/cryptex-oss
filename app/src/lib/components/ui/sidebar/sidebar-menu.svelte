<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children, ...restProps }: { class?: string; children?: Snippet; [key: string]: unknown } = $props();
</script>

<ul class={cn('flex w-full min-w-0 flex-col gap-1', className)} data-sidebar-menu {...restProps}>
  {@render children?.()}
</ul>
