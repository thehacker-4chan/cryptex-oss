<script lang="ts">
  import { cn } from '$lib/utils/cn';
  let { class: className, ...restProps }: { class?: string; [key: string]: unknown } = $props();
</script>

<div class={cn('animate-pulse rounded-md bg-muted', className)} {...restProps}></div>
