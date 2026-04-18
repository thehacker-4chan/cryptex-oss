<script lang="ts">
  import { Tabs as TabsPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';
  let { class: className, ...restProps }: TabsPrimitive.RootProps & { class?: string } = $props();
</script>

<TabsPrimitive.Root class={cn('', className)} {...restProps} />
