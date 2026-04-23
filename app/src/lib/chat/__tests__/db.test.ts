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

describe('db v3 — godmodeRuns table', () => {
  it('godmodeRuns table exists and accepts a row', async () => {
    indexedDB.deleteDatabase('cryptex-chat');
    vi.resetModules();
    const { db } = await import('../db');
    await db.open();
    const row = {
      id: 'run-1',
      ownerId: 'local',
      chatId: 'chat-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      task: 'hello',
      K: 6 as const,
      modelId: 'anthropic:claude-sonnet-4-6',
      winner: {
        dna: { mutatorId: null, classifierId: null, wrapperId: null, modeId: null, prefillId: null, tempBucket: 'med' as const, source: 'builtin' as const },
        response: 'hi',
        score: 0.8,
        tier: 'substantive' as const,
        preview: 'hi'
      },
      candidates: []
    };
    await db.godmodeRuns.put(row as any);
    const got = await db.godmodeRuns.get('run-1');
    expect(got?.task).toBe('hello');
  });
});

describe('db v4 — attackSessions table', () => {
  it('attackSessions table exists and accepts a row', async () => {
    indexedDB.deleteDatabase('cryptex-chat');
    vi.resetModules();
    const { db } = await import('../db');
    await db.open();
    const row = {
      id: 'session-1',
      ownerId: 'local',
      chatId: 'chat-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      objective: 'test',
      targetModelId: 'anthropic:claude-sonnet-4-6',
      orchestratorModelId: 'anthropic:claude-sonnet-4-6',
      maxAttempts: 6,
      turns: [],
      strategyLog: [],
      finalOutcome: null,
      finalConfidence: null,
      finalSummary: null
    };
    await db.attackSessions.put(row as any);
    const got = await db.attackSessions.get('session-1');
    expect(got?.objective).toBe('test');
  });
});
