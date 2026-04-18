<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import { badgeVariants, type Props } from './index.js';
  let { class: className, variant = 'default', ...restProps }: Props & { [key: string]: unknown } = $props();
</script>

<div class={cn(badgeVariants({ variant }), className)} {...restProps}></div>
