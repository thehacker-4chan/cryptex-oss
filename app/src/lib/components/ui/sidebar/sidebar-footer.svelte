<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children, ...restProps }: { class?: string; children?: Snippet; [key: string]: unknown } = $props();
</script>

<div class={cn('flex flex-col gap-2 p-2', className)} data-sidebar-footer {...restProps}>
  {@render children?.()}
</div>
