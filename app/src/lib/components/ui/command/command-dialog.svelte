<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import Root from './command.svelte';
  let { open, onOpenChange, children, ...restProps }: { open?: boolean; onOpenChange?: (v: boolean) => void; children?: Snippet; [key: string]: unknown } = $props();
</script>

<DialogPrimitive.Root bind:open {onOpenChange}>
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay class="fixed inset-0 z-50 bg-black/80" />
    <DialogPrimitive.Content class="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-0 shadow-lg duration-200 sm:rounded-lg overflow-hidden">
      <Root {...restProps}>
        {@render children?.()}
      </Root>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
</DialogPrimitive.Root>
