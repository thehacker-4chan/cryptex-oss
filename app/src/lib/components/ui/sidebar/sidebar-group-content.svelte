<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children, ...restProps }: { class?: string; children?: Snippet; [key: string]: unknown } = $props();
</script>

<div class={cn('w-full text-sm', className)} data-sidebar-group-content {...restProps}>
  {@render children?.()}
</div>
