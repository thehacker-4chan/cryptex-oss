import { db } from '$lib/chat/db';
import { session } from '$lib/auth/session.svelte';
import type { ToolStateRow } from '$lib/chat/types';

function ownerId(): string { return session.currentUser.id; }

export const toolRepo = {
  async saveToolState(toolId: string, state: unknown): Promise<void> {
    await db.toolStates.put({
      toolId, ownerId: ownerId(), state, updatedAt: Date.now()
    } satisfies ToolStateRow);
  },
  async loadToolState<T = unknown>(toolId: string): Promise<T | null> {
    const row = await db.toolStates.get([toolId, ownerId()]);
    return (row?.state as T) ?? null;
  },
  async deleteToolState(toolId: string): Promise<void> {
    await db.toolStates.delete([toolId, ownerId()]);
  }
};
