<script lang="ts">
  import DecodeTool from '$lib/components/tools/decode/DecodeTool.svelte';
  import RouteShell from '$lib/components/chat/workspace/RouteShell.svelte';
</script>
<svelte:head><title>Decode · Cryptex</title></svelte:head>
<RouteShell skeleton="tools">
  <DecodeTool />
</RouteShell>
