<script lang="ts">
  import ChatShell from '$lib/components/chat/ChatShell.svelte';
  import RouteShell from '$lib/components/chat/workspace/RouteShell.svelte';
  import { onMount } from 'svelte';
  import { installChatShortcuts } from '$lib/stores/chatShortcuts.svelte';
  import { session } from '$lib/auth/session.svelte';
  import { featureFlags } from '$lib/config/featureFlags';
  import SignInWall from '$lib/components/billing/SignInWall.svelte';
  let { children } = $props();
  onMount(() => installChatShortcuts());
</script>

{#if featureFlags.authEnabled && !session.isSignedIn}
  <SignInWall feature="Chat" />
{:else}
  <RouteShell skeleton="chat">
    <ChatShell>{@render children?.()}</ChatShell>
  </RouteShell>
{/if}
