import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import MessageBubble from '../MessageBubble.svelte';
import type { ChatRow, MessageRow } from '$lib/chat/types';
import { DEFAULT_CHAT_SETTINGS } from '$lib/chat/types';

function makeChat(): ChatRow {
  return {
    id: 'c1',
    ownerId: 'local',
    title: 't',
    createdAt: 0,
    updatedAt: 0,
    modelQualifiedId: 'openrouter:openai/gpt-4o',
    settings: { ...DEFAULT_CHAT_SETTINGS },
    tags: []
  };
}

function makeMsg(overrides: Partial<MessageRow>): MessageRow {
  return {
    id: 'm1',
    ownerId: 'local',
    chatId: 'c1',
    role: 'assistant',
    createdAt: Date.now(),
    content: 'hello world',
    tags: [],
    ...overrides
  };
}

describe('MessageBubble truncation banner', () => {
  it('renders Continue button when finishReason === length', () => {
    const { getByText } = render(MessageBubble, {
      chat: makeChat(),
      message: makeMsg({ finishReason: 'length' })
    });
    expect(getByText('Continue')).toBeTruthy();
    expect(getByText(/Response truncated/)).toBeTruthy();
  });

  it('renders Continue button when message.truncated === true', () => {
    const { getByText } = render(MessageBubble, {
      chat: makeChat(),
      message: makeMsg({ truncated: true })
    });
    expect(getByText('Continue')).toBeTruthy();
  });

  it('does not render banner on user messages even with finishReason set', () => {
    const { queryByText } = render(MessageBubble, {
      chat: makeChat(),
      message: makeMsg({ role: 'user', content: 'hi', finishReason: 'length' })
    });
    expect(queryByText('Continue')).toBeNull();
  });

  it('does not render banner for the live streaming placeholder', () => {
    const { queryByText } = render(MessageBubble, {
      chat: makeChat(),
      message: makeMsg({ id: 'streaming', finishReason: 'length' }),
      live: true
    });
    expect(queryByText('Continue')).toBeNull();
  });
});
