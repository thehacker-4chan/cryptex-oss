<script lang="ts">
  import { Avatar as AvatarPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';
  let { class: className, ...restProps }: AvatarPrimitive.RootProps & { class?: string } = $props();
</script>

<AvatarPrimitive.Root
  class={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className)}
  {...restProps}
/>
