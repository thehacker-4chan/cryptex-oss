import { ulid } from 'ulid';
import { db } from './db';
import { session } from '$lib/auth/session.svelte';
import type {
  ChatRow, MessageRow, AttachmentRow, ChatSettings
} from './types';
import { DEFAULT_CHAT_SETTINGS } from './types';

function ownerId(): string { return session.currentUser.id; }

export const repo = {
  async createChat(input: { title: string; modelQualifiedId: string; settings?: Partial<ChatSettings>; parentChatId?: string; parentMessageId?: string }): Promise<ChatRow> {
    const now = Date.now();
    const row: ChatRow = {
      id: ulid(),
      ownerId: ownerId(),
      title: input.title,
      createdAt: now,
      updatedAt: now,
      modelQualifiedId: input.modelQualifiedId,
      settings: { ...DEFAULT_CHAT_SETTINGS, ...(input.settings ?? {}) },
      parentChatId: input.parentChatId,
      parentMessageId: input.parentMessageId,
      tags: []
    };
    await db.chats.put(row);
    return row;
  },

  async listChats(): Promise<ChatRow[]> {
    const all = await db.chats.where('ownerId').equals(ownerId()).toArray();
    return all
      .filter((c) => !c.tombstoned && !c.archivedAt)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async getChat(id: string): Promise<ChatRow | undefined> {
    const row = await db.chats.get(id);
    if (!row || row.ownerId !== ownerId() || row.tombstoned) return undefined;
    return row;
  },

  async updateChat(id: string, patch: Partial<ChatRow>): Promise<void> {
    const existing = await this.getChat(id);
    if (!existing) return;
    await db.chats.put({ ...existing, ...patch, updatedAt: Date.now() });
  },

  async deleteChat(id: string): Promise<void> {
    const existing = await this.getChat(id);
    if (!existing) return;
    await db.chats.put({ ...existing, tombstoned: true, updatedAt: Date.now() });
  },

  async saveMessage(input: Omit<MessageRow, 'id' | 'ownerId' | 'createdAt'>): Promise<MessageRow> {
    const row: MessageRow = {
      ...input,
      id: ulid(),
      ownerId: ownerId(),
      createdAt: Date.now(),
      tags: input.tags ?? []
    };
    await db.messages.put(row);
    // bump parent chat updatedAt — v1 non-transactional; two tabs may race, acceptable until sync layer lands
    const chat = await this.getChat(input.chatId);
    if (chat) await db.chats.put({ ...chat, updatedAt: Date.now() });
    return row;
  },

  async updateMessage(id: string, patch: Partial<MessageRow>): Promise<void> {
    const existing = await db.messages.get(id);
    if (!existing || existing.ownerId !== ownerId()) return;
    await db.messages.put({ ...existing, ...patch });
  },

  async listMessages(chatId: string): Promise<MessageRow[]> {
    const all = await db.messages.where('[chatId+createdAt]').between([chatId, -Infinity], [chatId, Infinity]).toArray();
    return all.filter((m) => m.ownerId === ownerId() && !m.tombstoned);
  },

  async saveAttachment(input: Omit<AttachmentRow, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>): Promise<AttachmentRow> {
    const now = Date.now();
    const row: AttachmentRow = {
      ...input,
      id: ulid(),
      ownerId: ownerId(),
      createdAt: now,
      updatedAt: now
    };
    await db.attachments.put(row);
    return row;
  },

  async listAttachments(messageId: string): Promise<AttachmentRow[]> {
    const all = await db.attachments.where('messageId').equals(messageId).toArray();
    return all.filter((a) => a.ownerId === ownerId() && !a.tombstoned);
  }
};
