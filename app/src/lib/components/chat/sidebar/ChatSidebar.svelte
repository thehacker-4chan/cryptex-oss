<script lang="ts">
  import { repo } from '$lib/chat/repo';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import type { ChatRow } from '$lib/chat/types';
  import NewChatButton from './NewChatButton.svelte';
  import ChatListItem from './ChatListItem.svelte';

  let chats = $state<ChatRow[]>([]);
  let loading = $state(true);

  async function refresh() {
    chats = await repo.listChats();
    loading = false;
  }

  // Refresh when navigating between chats or after create/delete.
  // Reads $page.url.pathname to track route changes; also fires on mount.
  $effect(() => {
    $page.url.pathname; // track for reactivity
    refresh();
  });

  const activeId = $derived(
    $page.url.pathname.replace(base, '').match(/^\/chat\/([^/]+)/)?.[1] ?? null
  );

  function select(id: string) { goto(`${base}/chat/${id}`); }
</script>

<div class="flex h-full flex-col gap-2">
  <NewChatButton />
  <div class="mt-2 flex-1 overflow-y-auto">
    {#if loading}
      <p class="px-2 text-xs text-muted-foreground">Loading…</p>
    {:else if chats.length === 0}
      <p class="px-2 text-xs text-muted-foreground">No chats yet.</p>
    {:else}
      <div class="flex flex-col gap-0.5">
        {#each chats as chat (chat.id)}
          <ChatListItem {chat} active={chat.id === activeId} onSelect={() => select(chat.id)} />
        {/each}
      </div>
    {/if}
  </div>
</div>
