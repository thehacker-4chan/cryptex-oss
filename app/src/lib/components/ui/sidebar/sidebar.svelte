<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children, ...restProps }: { class?: string; children?: Snippet; [key: string]: unknown } = $props();
</script>

<aside
  class={cn('flex h-full flex-col border-r bg-card', className)}
  data-sidebar
  {...restProps}
>
  {@render children?.()}
</aside>
