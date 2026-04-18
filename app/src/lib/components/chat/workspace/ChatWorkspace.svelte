<script lang="ts">
  import type { ChatRow } from '$lib/chat/types';
  import ChatHeader from './ChatHeader.svelte';
  type Props = { chat: ChatRow };
  let { chat }: Props = $props();
</script>

<div class="flex h-full flex-col gap-2">
  <ChatHeader {chat} />
  <div class="flex-1 overflow-y-auto p-2 text-sm text-muted-foreground">
    Commits 3–5 render messages, composer, techniques.
  </div>
</div>
