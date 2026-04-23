import Dexie, { type Table } from 'dexie';
import type { ChatRow, MessageRow, AttachmentRow, ToolStateRow, AttackChainRunRow, GodmodeRunRow, AttackSessionRow } from './types';

class CryptexChatDB extends Dexie {
  chats!: Table<ChatRow, string>;
  messages!: Table<MessageRow, string>;
  attachments!: Table<AttachmentRow, string>;
  toolStates!: Table<ToolStateRow, [string, string]>;
  attackChainRuns!: Table<AttackChainRunRow, string>;
  godmodeRuns!: Table<GodmodeRunRow, string>;
  attackSessions!: Table<AttackSessionRow, string>;

  constructor() {
    super('cryptex-chat');
    // SCHEMA HISTORY — do NOT modify existing stores() strings in-place.
    // For any structural change: add `.version(N).stores({...}).upgrade(tx => {...})` below, keep prior versions intact.
    this.version(1).stores({
      chats:       'id, ownerId, updatedAt, pinned, archivedAt, parentChatId, *tags, tombstoned',
      messages:    'id, chatId, [chatId+createdAt], parentId, role, *tags, trainingInclude, ownerId, tombstoned',
      attachments: 'id, messageId, ownerId, tombstoned',
      toolStates:  '[toolId+ownerId], toolId, ownerId, updatedAt'
    });
    // v2: add attackChainRuns table
    this.version(2).stores({
      chats:           'id, ownerId, updatedAt, pinned, archivedAt, parentChatId, *tags, tombstoned',
      messages:        'id, chatId, [chatId+createdAt], parentId, role, *tags, trainingInclude, ownerId, tombstoned',
      attachments:     'id, messageId, ownerId, tombstoned',
      toolStates:      '[toolId+ownerId], toolId, ownerId, updatedAt',
      attackChainRuns: 'id, chatId, ownerId, createdAt, [chatId+createdAt], tombstoned'
    });
    // v3: add godmodeRuns table for per-chat Godmode run history.
    // Additive — prior tables preserved; no data migration needed.
    this.version(3).stores({
      chats:           'id, ownerId, updatedAt, pinned, archivedAt, parentChatId, *tags, tombstoned',
      messages:        'id, chatId, [chatId+createdAt], parentId, role, *tags, trainingInclude, ownerId, tombstoned',
      attachments:     'id, messageId, ownerId, tombstoned',
      toolStates:      '[toolId+ownerId], toolId, ownerId, updatedAt',
      attackChainRuns: 'id, chatId, ownerId, createdAt, [chatId+createdAt], tombstoned',
      godmodeRuns:     'id, chatId, ownerId, createdAt, [chatId+createdAt], tombstoned'
    });
    // v4: add attackSessions for Chain orchestrator v2. Additive — prior
    // tables preserved; no data migration needed.
    this.version(4).stores({
      chats:           'id, ownerId, updatedAt, pinned, archivedAt, parentChatId, *tags, tombstoned',
      messages:        'id, chatId, [chatId+createdAt], parentId, role, *tags, trainingInclude, ownerId, tombstoned',
      attachments:     'id, messageId, ownerId, tombstoned',
      toolStates:      '[toolId+ownerId], toolId, ownerId, updatedAt',
      attackChainRuns: 'id, chatId, ownerId, createdAt, [chatId+createdAt], tombstoned',
      godmodeRuns:     'id, chatId, ownerId, createdAt, [chatId+createdAt], tombstoned',
      attackSessions:  'id, chatId, ownerId, createdAt, [chatId+createdAt], tombstoned'
    });
  }
}

export const db = new CryptexChatDB();
