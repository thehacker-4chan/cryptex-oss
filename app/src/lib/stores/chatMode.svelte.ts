import { browser } from '$app/environment';

export type ChatMode = 'chat' | 'tools';

const KEY = 'cryptex.ui.mode';

function readInitial(): ChatMode {
  if (!browser) return 'tools';
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (parsed === 'chat' || parsed === 'tools') return parsed;
    }
  } catch { /* ignore */ }
  return 'tools';
}

function persist(v: ChatMode): void {
  if (!browser) return;
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* ignore */ }
}

function createChatMode() {
  let _value = $state<ChatMode>(readInitial());
  return {
    get value() { return _value; },
    set value(next: ChatMode) { _value = next; persist(next); }
  };
}

export const chatMode = createChatMode();
