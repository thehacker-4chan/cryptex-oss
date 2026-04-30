<script lang="ts">
  import TransformTool from '$lib/components/tools/transform/TransformTool.svelte';
  import RouteShell from '$lib/components/chat/workspace/RouteShell.svelte';
</script>
<svelte:head><title>Transform · Cryptex</title></svelte:head>
<RouteShell skeleton="tools">
  <TransformTool />
</RouteShell>
