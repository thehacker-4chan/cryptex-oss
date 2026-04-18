<script lang="ts">
  import { Command as CommandPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';
  import Search from 'lucide-svelte/icons/search';
  let { class: className, ...restProps }: CommandPrimitive.InputProps & { class?: string } = $props();
</script>

<div class="flex items-center border-b px-3">
  <Search class="mr-2 h-4 w-4 shrink-0 opacity-50" />
  <CommandPrimitive.Input
    class={cn(
      'flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...restProps}
  />
</div>
