<script lang="ts">
  import type { ChatRow } from '$lib/chat/types';
  import { repo } from '$lib/chat/repo';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import ModelPickerV2 from '$lib/components/ai/ModelPickerV2.svelte';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import EllipsisVertical from 'lucide-svelte/icons/ellipsis-vertical';
  import Zap from 'lucide-svelte/icons/zap';
  import { lastChatModel } from '$lib/stores/lastChatModel.svelte';

  type Props = { chat: ChatRow; attackChainOpen?: boolean };
  let { chat, attackChainOpen = false }: Props = $props();

  let title = $state(chat.title);
  let titleInput = $state<HTMLInputElement | null>(null);

  $effect(() => { title = chat.title; });

  async function saveTitle() {
    const trimmed = title.trim();
    if (!trimmed || trimmed === chat.title) return;
    await repo.updateChat(chat.id, { title: trimmed });
  }

  async function onModelChange(v: string) {
    await repo.updateChat(chat.id, { modelQualifiedId: v });
    lastChatModel.value = v;
  }

  function focusTitle() {
    titleInput?.focus();
    titleInput?.select();
  }

  async function duplicateChat() {
    const newChat = await repo.duplicateChat(chat.id);
    if (newChat) goto(`${base}/chat/${newChat.id}`);
  }

  async function deleteChat() {
    await repo.deleteChat(chat.id);
    goto(`${base}/chat`);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(chat, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${chat.title.replace(/\s+/g, '_')}.json`;
    a.click(); URL.revokeObjectURL(url);
  }
</script>

<div class="flex items-center gap-3 border-b border-border/30 px-3 py-2">
  <input
    bind:this={titleInput}
    type="text"
    bind:value={title}
    onblur={saveTitle}
    class="min-w-0 flex-1 bg-transparent font-serif text-base outline-none focus:outline-none placeholder:text-muted-foreground"
    aria-label="Chat title"
  />
  <ModelPickerV2 value={chat.modelQualifiedId} onChange={onModelChange} recentsKey="cryptex.chat.recentModels" triggerClass="text-xs text-muted-foreground border border-border/40 rounded-full px-3 py-1 hover:border-border/70 hover:text-foreground transition-colors" />
  <button
    type="button"
    onclick={() => window.dispatchEvent(new CustomEvent('chat:open-attack-chain'))}
    aria-label="Attack Chain"
    aria-pressed={attackChainOpen}
    title="Attack Chain — compose layered techniques"
    class={attackChainOpen
      ? 'inline-flex h-7 items-center gap-1 rounded border border-primary/70 bg-primary/30 px-2 text-xs text-primary ring-1 ring-primary/50 shadow-sm transition-colors'
      : 'inline-flex h-7 items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2 text-xs text-primary hover:bg-primary/20 transition-colors'}
  >
    <Zap size={11} /> Chain
  </button>
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <button
          type="button"
          {...props}
          class="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
          aria-label="Chat options"
        >
          <EllipsisVertical size={14} />
        </button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="end" class="w-40">
      <DropdownMenu.Item onclick={focusTitle}>Rename</DropdownMenu.Item>
      <DropdownMenu.Item onclick={duplicateChat}>Duplicate</DropdownMenu.Item>
      <DropdownMenu.Item onclick={exportJson}>Export as JSON</DropdownMenu.Item>
      <DropdownMenu.Separator />
      <DropdownMenu.Item onclick={deleteChat} class="text-destructive focus:text-destructive">Delete</DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>
