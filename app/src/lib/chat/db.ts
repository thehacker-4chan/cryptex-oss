import Dexie, { type Table } from 'dexie';
import type { ChatRow, MessageRow, AttachmentRow, ToolStateRow } from './types';

class CryptexChatDB extends Dexie {
  chats!: Table<ChatRow, string>;
  messages!: Table<MessageRow, string>;
  attachments!: Table<AttachmentRow, string>;
  toolStates!: Table<ToolStateRow, [string, string]>;

  constructor() {
    super('cryptex-chat');
    // SCHEMA HISTORY — do NOT modify existing stores() strings in-place.
    // For any structural change: add `.version(2).stores({...}).upgrade(tx => {...})` below, keep version(1) intact.
    this.version(1).stores({
      chats:       'id, ownerId, updatedAt, pinned, archivedAt, parentChatId, *tags, tombstoned',
      messages:    'id, chatId, [chatId+createdAt], parentId, role, *tags, trainingInclude, ownerId, tombstoned',
      attachments: 'id, messageId, ownerId, tombstoned',
      toolStates:  '[toolId+ownerId], toolId, ownerId, updatedAt'
    });
  }
}

export const db = new CryptexChatDB();
