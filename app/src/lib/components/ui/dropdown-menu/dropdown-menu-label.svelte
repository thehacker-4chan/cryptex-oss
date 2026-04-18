<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, inset, children, ...restProps }: { class?: string; inset?: boolean; children?: Snippet; [key: string]: unknown } = $props();
</script>

<div class={cn('px-2 py-1.5 text-sm font-semibold', inset && 'pl-8', className)} {...restProps}>
  {@render children?.()}
</div>
