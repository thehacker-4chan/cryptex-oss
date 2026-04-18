<script lang="ts">
  import type { Snippet } from 'svelte';
  import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';
  import Check from 'lucide-svelte/icons/check';
  let { class: className, children, checked, ...restProps }: DropdownMenuPrimitive.CheckboxItemProps & { class?: string; children?: Snippet } = $props();
</script>

<DropdownMenuPrimitive.CheckboxItem
  {checked}
  class={cn(
    'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
    className
  )}
  {...restProps}
>
  <span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
    {#if checked}
      <Check class="h-4 w-4" />
    {/if}
  </span>
  {@render children?.()}
</DropdownMenuPrimitive.CheckboxItem>
