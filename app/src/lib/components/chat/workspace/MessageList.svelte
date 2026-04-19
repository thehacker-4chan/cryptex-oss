<script lang="ts">
  import type { MessageRow, ChatRow } from '$lib/chat/types';
  import MessageBubble from './MessageBubble.svelte';
  import { tick } from 'svelte';

  type Props = {
    chat: ChatRow;
    messages: MessageRow[];
    streaming?: boolean;
    streamingContent?: string;
    streamingReasoning?: string;
  };
  let {
    chat,
    messages,
    streaming = false,
    streamingContent = '',
    streamingReasoning = ''
  }: Props = $props();

  let scrollEl = $state<HTMLElement | null>(null);

  function isNearBottom(): boolean {
    if (!scrollEl) return true;
    return scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 100;
  }

  export async function scrollToBottom() {
    await tick();
    if (!scrollEl) return;
    const target = scrollEl.scrollHeight;
    const distance = target - scrollEl.scrollTop;
    scrollEl.scrollTo({ top: target, behavior: distance < 800 ? 'smooth' : 'auto' });
  }

  export async function scrollToBottomIfPinned(threshold = 100) {
    await tick();
    if (!scrollEl) return;
    const distance = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
    if (distance < threshold) scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
  }

  const streamingMessage = $derived<MessageRow>({
    id: 'streaming',
    ownerId: 'local',
    chatId: chat.id,
    role: 'assistant',
    createdAt: Date.now(),
    content: streamingContent,
    reasoning: streamingReasoning || undefined,
    tags: []
  } as MessageRow);
</script>

<div
  bind:this={scrollEl}
  role="log"
  aria-live="polite"
  class="cryptex-scroll flex-1 overflow-y-auto px-3 py-2"
>
  {#each messages as msg (msg.id)}
    <MessageBubble message={msg} {chat} />
  {/each}
  {#if streaming}
    <MessageBubble message={streamingMessage} {chat} live={true} />
  {/if}
</div>
