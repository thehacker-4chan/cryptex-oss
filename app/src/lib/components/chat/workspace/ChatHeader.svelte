<script lang="ts">
  import type { ChatRow } from '$lib/chat/types';
  import { repo } from '$lib/chat/repo';
  type Props = { chat: ChatRow };
  let { chat }: Props = $props();
  let title = $state(chat.title);

  $effect(() => { title = chat.title; });

  async function saveTitle() {
    const trimmed = title.trim();
    if (!trimmed || trimmed === chat.title) return;
    await repo.updateChat(chat.id, { title: trimmed });
  }
</script>

<div class="flex items-center gap-2 border-b border-white/10 pb-2">
  <input
    type="text"
    bind:value={title}
    onblur={saveTitle}
    class="flex-1 bg-transparent font-serif text-lg outline-none focus:ring-0"
    aria-label="Chat title"
  />
</div>
