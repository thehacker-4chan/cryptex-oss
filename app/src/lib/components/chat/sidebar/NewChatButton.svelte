<script lang="ts">
  import { repo } from '$lib/chat/repo';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import Plus from 'lucide-svelte/icons/plus';

  async function newChat() {
    const chat = await repo.createChat({ title: 'New chat', modelQualifiedId: 'openrouter:openrouter/auto' });
    goto(`${base}/chat/${chat.id}`);
  }
</script>

<button type="button" onclick={newChat} class="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-white/15 py-2 text-sm text-muted-foreground hover:bg-white/5">
  <Plus size={14} /> New chat
</button>
