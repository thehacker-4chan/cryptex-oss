import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

beforeEach(() => {
  indexedDB.deleteDatabase('cryptex-chat');
  vi.resetModules();
});

describe('chat repo', () => {
  it('createChat writes a row with ownerId=local and default settings', async () => {
    const { repo } = await import('../repo');
    const chat = await repo.createChat({ title: 'Test', modelQualifiedId: 'openrouter:auto' });
    expect(chat.id).toBeTruthy();
    expect(chat.ownerId).toBe('local');
    expect(chat.title).toBe('Test');
    expect(chat.settings.temperature).toBe(0.7);
    expect(chat.tags).toEqual([]);
  });

  it('listChats returns rows in updatedAt desc order, excludes tombstoned', async () => {
    const { repo } = await import('../repo');
    const a = await repo.createChat({ title: 'A', modelQualifiedId: 'x' });
    await new Promise(r => setTimeout(r, 5));
    const b = await repo.createChat({ title: 'B', modelQualifiedId: 'x' });
    await repo.deleteChat(a.id);
    const list = await repo.listChats();
    expect(list.map(c => c.id)).toEqual([b.id]);
  });

  it('saveMessage assigns ULID, preserves contentRaw', async () => {
    const { repo } = await import('../repo');
    const chat = await repo.createChat({ title: 't', modelQualifiedId: 'x' });
    const msg = await repo.saveMessage({
      chatId: chat.id, role: 'user',
      content: 'hello wrapped', contentRaw: 'hello', tags: []
    });
    expect(msg.id).toBeTruthy();
    expect(msg.ownerId).toBe('local');
    expect(msg.content).toBe('hello wrapped');
    expect(msg.contentRaw).toBe('hello');
  });

  it('listMessages returns in createdAt ascending', async () => {
    const { repo } = await import('../repo');
    const chat = await repo.createChat({ title: 't', modelQualifiedId: 'x' });
    await repo.saveMessage({ chatId: chat.id, role: 'user', content: '1', tags: [] });
    await new Promise(r => setTimeout(r, 5));
    await repo.saveMessage({ chatId: chat.id, role: 'assistant', content: '2', tags: [] });
    const list = await repo.listMessages(chat.id);
    expect(list.map(m => m.content)).toEqual(['1', '2']);
  });

  it('saveMessage bumps parent chat updatedAt', async () => {
    const { repo } = await import('../repo');
    const chat = await repo.createChat({ title: 't', modelQualifiedId: 'x' });
    const before = chat.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    await repo.saveMessage({ chatId: chat.id, role: 'user', content: 'hi', tags: [] });
    const after = await repo.getChat(chat.id);
    expect(after!.updatedAt).toBeGreaterThan(before);
  });
});
