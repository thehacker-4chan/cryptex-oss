<script lang="ts">
  import type { Snippet } from 'svelte';
  let { children, ...restProps }: { children?: Snippet; [key: string]: unknown } = $props();
</script>

<div data-sidebar-provider {...restProps}>
  {@render children?.()}
</div>
