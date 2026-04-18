import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

beforeEach(async () => {
  // wipe IDB between tests
  indexedDB.deleteDatabase('cryptex-chat');
  vi.resetModules();
});

describe('CryptexChatDB', () => {
  it('exposes chats, messages, attachments, toolStates tables', async () => {
    const { db } = await import('../db');
    expect(db.chats).toBeDefined();
    expect(db.messages).toBeDefined();
    expect(db.attachments).toBeDefined();
    expect(db.toolStates).toBeDefined();
  });

  it('round-trips a chat row', async () => {
    const { db } = await import('../db');
    await db.chats.put({
      id: 'c1', ownerId: 'local', title: 't', createdAt: 1, updatedAt: 1,
      modelQualifiedId: 'openrouter:x/y', settings: {
        systemPrompt: '', temperature: 0.7, activeMode: null, godmodeEnabled: false,
        enabledToolIds: [], toolChoice: 'auto', maxToolCalls: 4
      }, tags: []
    });
    const got = await db.chats.get('c1');
    expect(got?.title).toBe('t');
  });
});
