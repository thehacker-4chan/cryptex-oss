<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';
  let { class: className, ...restProps }: DialogPrimitive.DescriptionProps & { class?: string } = $props();
</script>

<DialogPrimitive.Description
  class={cn('text-sm text-muted-foreground', className)}
  {...restProps}
/>
