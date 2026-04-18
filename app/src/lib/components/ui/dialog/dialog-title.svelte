<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';
  let { class: className, ...restProps }: DialogPrimitive.TitleProps & { class?: string } = $props();
</script>

<DialogPrimitive.Title
  class={cn('text-lg font-semibold leading-none tracking-tight', className)}
  {...restProps}
/>
