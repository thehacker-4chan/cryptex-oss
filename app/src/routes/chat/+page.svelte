<script lang="ts">
  import { repo } from '$lib/chat/repo';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';

  let empty = $state(false);

  onMount(async () => {
    const list = await repo.listChats();
    if (list.length > 0) {
      goto(`${base}/chat/${list[0].id}`, { replaceState: true });
    } else {
      empty = true;
    }
  });
</script>

{#if empty}
  <div class="flex h-full flex-col items-center justify-center gap-2 text-center">
    <p class="font-serif text-lg">No chats yet</p>
    <p class="text-sm text-muted-foreground">Click <kbd class="rounded border px-1 py-0.5 text-xs">+ New chat</kbd> to begin.</p>
  </div>
{/if}
