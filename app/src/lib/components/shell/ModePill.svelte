<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import { chatMode } from '$lib/stores/chatMode.svelte';
  import { cn } from '$lib/utils/cn';
  import MessageSquare from 'lucide-svelte/icons/message-square';
  import Wrench from 'lucide-svelte/icons/wrench';

  function selectMode(next: 'chat' | 'tools') {
    chatMode.value = next;
    const currentPath = $page.url.pathname.replace(base, '') || '/';
    if (next === 'chat' && !currentPath.startsWith('/chat')) {
      goto(`${base}/chat`);
    } else if (next === 'tools' && currentPath.startsWith('/chat')) {
      goto(`${base}/`);
    }
  }

  const active = $derived(chatMode.value);
</script>

<div role="group" aria-label="App mode" class="inline-flex items-center rounded-full border border-border bg-card/60 p-0.5 text-xs">
  <button
    type="button"
    aria-pressed={active === 'chat'}
    onclick={() => selectMode('chat')}
    class={cn(
      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors',
      active === 'chat' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
    )}
  >
    <MessageSquare size={12} /> Chat
  </button>
  <button
    type="button"
    aria-pressed={active === 'tools'}
    onclick={() => selectMode('tools')}
    class={cn(
      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors',
      active === 'tools' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
    )}
  >
    <Wrench size={12} /> Tools
  </button>
</div>
