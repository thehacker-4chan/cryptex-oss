<script lang="ts">
  import EmojiTool from '$lib/components/tools/emoji/EmojiTool.svelte';
  import RouteShell from '$lib/components/chat/workspace/RouteShell.svelte';
</script>
<svelte:head><title>Emoji · Steganography · Cryptex</title></svelte:head>
<RouteShell skeleton="tools">
  <EmojiTool />
</RouteShell>
