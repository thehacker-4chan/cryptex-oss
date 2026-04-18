<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children, ...restProps }: { class?: string; children?: Snippet; [key: string]: unknown } = $props();
</script>

<div class={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...restProps}>
  {@render children?.()}
</div>
