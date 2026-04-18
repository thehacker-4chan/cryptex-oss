<script lang="ts">
  import { Avatar as AvatarPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';
  let { class: className, ...restProps }: AvatarPrimitive.FallbackProps & { class?: string } = $props();
</script>

<AvatarPrimitive.Fallback
  class={cn('flex h-full w-full items-center justify-center rounded-full bg-muted', className)}
  {...restProps}
/>
