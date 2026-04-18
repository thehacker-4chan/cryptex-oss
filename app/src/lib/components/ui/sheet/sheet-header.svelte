<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children, ...restProps }: { class?: string; children?: Snippet; [key: string]: unknown } = $props();
</script>

<div class={cn('flex flex-col space-y-2 text-center sm:text-left', className)} {...restProps}>
  {@render children?.()}
</div>
