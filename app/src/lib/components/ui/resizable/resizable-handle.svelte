<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import GripVertical from 'lucide-svelte/icons/grip-vertical';
  let { class: className, withHandle = false, ...restProps }: { class?: string; withHandle?: boolean; [key: string]: unknown } = $props();
</script>

<div
  aria-hidden="true"
  tabindex="-1"
  class={cn(
    'relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90',
    className
  )}
  data-panel-resize-handle
  {...restProps}
>
  {#if withHandle}
    <div class="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
      <GripVertical class="h-2.5 w-2.5" />
    </div>
  {/if}
</div>
