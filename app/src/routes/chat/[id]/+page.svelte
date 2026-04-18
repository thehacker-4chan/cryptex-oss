<script lang="ts">
  import { page } from '$app/stores';
  import { repo } from '$lib/chat/repo';
  import type { ChatRow } from '$lib/chat/types';
  import ChatWorkspace from '$lib/components/chat/workspace/ChatWorkspace.svelte';

  let chat = $state<ChatRow | null>(null);
  let loading = $state(true);
  let missing = $state(false);

  async function load(id: string) {
    loading = true; missing = false;
    const row = await repo.getChat(id);
    if (!row) { missing = true; chat = null; } else { chat = row; }
    loading = false;
  }

  $effect(() => { if ($page.params.id) load($page.params.id); });
</script>

{#if loading}
  <p class="m-auto text-sm text-muted-foreground">Loading…</p>
{:else if missing}
  <p class="m-auto text-sm text-muted-foreground">Chat not found.</p>
{:else if chat}
  <ChatWorkspace {chat} />
{/if}
