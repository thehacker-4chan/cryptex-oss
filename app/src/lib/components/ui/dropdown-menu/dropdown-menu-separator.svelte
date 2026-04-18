<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';
  let { class: className, ...restProps }: DropdownMenuPrimitive.SeparatorProps & { class?: string } = $props();
</script>

<DropdownMenuPrimitive.Separator class={cn('-mx-1 my-1 h-px bg-muted', className)} {...restProps} />
