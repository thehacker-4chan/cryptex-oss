<script lang="ts">
  import { Command as CommandPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';
  let { class: className, ...restProps }: CommandPrimitive.ListProps & { class?: string } = $props();
</script>

<CommandPrimitive.List
  class={cn('max-h-[300px] overflow-y-auto overflow-x-hidden', className)}
  {...restProps}
/>
