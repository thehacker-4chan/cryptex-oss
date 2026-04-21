import { assertEquals } from '@std/assert';
import { makeMemory } from '../memory.ts';

// Requires a local pg at $TEST_DATABASE_URL. Skip if env var not set.
const url = Deno.env.get('TEST_DATABASE_URL');
const skip = !url;

Deno.test({
  name: 'recordBoth writes exactly one row to each table',
  ignore: skip,
  async fn() {
    const mem = await makeMemory(url!);
    try {
      const userId = crypto.randomUUID();
      await mem.recordBoth({
        userId, modelFamily: 'claude',
        dnaTuple: ['mut_rephrase', '', '', '', '', 'med', 'builtin'],
        taskText: 'hello',
        tier: 'substantive', scoreNumeric: 0.75, failureReason: null,
      });
      const priv = await mem.queryUser(userId, 'claude');
      const glob = await mem.queryGlobal('claude');
      assertEquals(priv.length, 1);
      assertEquals(priv[0].task_text, 'hello');
      // Global table rows must NEVER contain task text or user id
      for (const g of glob) {
        assertEquals(Object.hasOwn(g, 'task_text'), false);
        assertEquals(Object.hasOwn(g, 'user_id'), false);
      }
    } finally {
      await mem.close();
    }
  },
});

Deno.test({
  name: 'queryUser excludes infra-failed rows',
  ignore: skip,
  async fn() {
    const mem = await makeMemory(url!);
    try {
      const userId = crypto.randomUUID();
      await mem.recordBoth({
        userId, modelFamily: 'claude',
        dnaTuple: ['x', '', '', '', '', 'med', 'builtin'],
        taskText: 't', tier: 'refusal', scoreNumeric: 0.1, failureReason: 'timeout',
      });
      const rows = await mem.queryUser(userId, 'claude');
      assertEquals(rows.length, 0);
    } finally {
      await mem.close();
    }
  },
});
