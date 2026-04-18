<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  let { class: className, inset, children, ...restProps }: DropdownMenuPrimitive.SubTriggerProps & { class?: string; inset?: boolean } = $props();
</script>

<DropdownMenuPrimitive.SubTrigger
  class={cn(
    'flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent',
    inset && 'pl-8',
    className
  )}
  {...restProps}
>
  {@render children?.()}
  <ChevronRight class="ml-auto h-4 w-4" />
</DropdownMenuPrimitive.SubTrigger>
