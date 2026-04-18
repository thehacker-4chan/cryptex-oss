<script lang="ts">
  import { Toaster as SonnerToaster } from 'sonner';
  import type { ComponentProps } from 'svelte';

  type Props = Partial<ComponentProps<typeof SonnerToaster>> & { class?: string };
  let { theme = 'system', ...restProps }: Props = $props();
</script>

<SonnerToaster {theme} {...restProps} />
