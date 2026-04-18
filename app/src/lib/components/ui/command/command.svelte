<script lang="ts">
  import { Command as CommandPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';
  let { class: className, ...restProps }: CommandPrimitive.RootProps & { class?: string } = $props();
</script>

<CommandPrimitive.Root
  class={cn('flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground', className)}
  {...restProps}
/>
