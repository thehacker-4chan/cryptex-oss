<script lang="ts">
  import type { ChatRow } from '$lib/chat/types';
  import { cn } from '$lib/utils/cn';
  type Props = { chat: ChatRow; active: boolean; onSelect: () => void };
  let { chat, active, onSelect }: Props = $props();
  const when = $derived(new Date(chat.updatedAt).toLocaleDateString());
</script>

<button type="button" onclick={onSelect}
  class={cn('flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/5', active && 'bg-white/10')}>
  <span class="truncate w-full">{chat.title}</span>
  <span class="text-xs text-muted-foreground">{when}</span>
</button>
