<script lang="ts">
  import { ScrollArea as ScrollAreaPrimitive } from 'bits-ui';
  import Scrollbar from './scroll-area-scrollbar.svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children, orientation = 'vertical', scrollbarXClasses = '', scrollbarYClasses = '', ...restProps }: ScrollAreaPrimitive.RootProps & { class?: string; orientation?: 'vertical' | 'horizontal' | 'both'; scrollbarXClasses?: string; scrollbarYClasses?: string } = $props();
</script>

<ScrollAreaPrimitive.Root class={cn('relative overflow-hidden', className)} {...restProps}>
  <ScrollAreaPrimitive.Viewport class="h-full w-full rounded-[inherit]">
    {@render children?.()}
  </ScrollAreaPrimitive.Viewport>
  {#if orientation === 'vertical' || orientation === 'both'}
    <Scrollbar orientation="vertical" class={scrollbarYClasses} />
  {/if}
  {#if orientation === 'horizontal' || orientation === 'both'}
    <Scrollbar orientation="horizontal" class={scrollbarXClasses} />
  {/if}
  <ScrollAreaPrimitive.Corner />
</ScrollAreaPrimitive.Root>
