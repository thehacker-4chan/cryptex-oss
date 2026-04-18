<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let {
    class: className,
    direction = 'horizontal',
    children,
    ...restProps
  }: { class?: string; direction?: 'horizontal' | 'vertical'; children?: Snippet; [key: string]: unknown } = $props();
</script>

<div
  class={cn(
    'flex h-full w-full data-[panel-group-direction=vertical]:flex-col',
    className
  )}
  data-panel-group
  data-panel-group-direction={direction}
  {...restProps}
>
  {@render children?.()}
</div>
