<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children, ...restProps }: { class?: string; children?: Snippet; [key: string]: unknown } = $props();
</script>

<li class={cn('group/menu-item relative', className)} data-sidebar-menu-item {...restProps}>
  {@render children?.()}
</li>
