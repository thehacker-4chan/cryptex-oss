<script lang="ts">
  import { Button as ButtonPrimitive } from 'bits-ui';
  import { buttonVariants, type Props } from './index.js';
  import { cn } from '$lib/utils/cn';

  let { class: className, variant = 'default', size = 'default', ...restProps }: Props = $props();
</script>

<ButtonPrimitive.Root
  class={cn(buttonVariants({ variant, size }), className)}
  {...restProps}
/>
