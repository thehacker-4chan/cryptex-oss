<script lang="ts">
  import { Avatar as AvatarPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';
  let { class: className, ...restProps }: AvatarPrimitive.ImageProps & { class?: string } = $props();
</script>

<AvatarPrimitive.Image class={cn('aspect-square h-full w-full', className)} {...restProps} />
