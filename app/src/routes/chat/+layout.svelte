<script lang="ts">
  import ChatShell from '$lib/components/chat/ChatShell.svelte';
  let { children } = $props();
</script>

<ChatShell>
  {@render children?.()}
</ChatShell>
