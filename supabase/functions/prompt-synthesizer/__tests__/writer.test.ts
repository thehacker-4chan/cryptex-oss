import { assertEquals, assertRejects } from '@std/assert';
import { makeWriter, type Writer } from '../writer.ts';

const url = Deno.env.get('TEST_DATABASE_URL');
const skip = !url;

Deno.test({
  name: 'insertComposite writes a row with analysis populated',
  ignore: skip,
  async fn() {
    const w = await makeWriter(url!);
    try {
      const userId = crypto.randomUUID();
      const [id] = await w.insertComposite({
        userId,
        name: 'test-composite-' + userId.slice(0, 8),
        systemPrompt: 'You are X.',
        userMessage: '{task}',
        analysis: { v: 1, mode: 'composite', why_it_works: 'test', detected_axes: {}, strategy_tags: [], confidence: 'high' },
      });
      assertEquals(typeof id, 'string');
    } finally {
      await w.close();
    }
  },
});

Deno.test({
  name: 'insertMany is transactional — failure on any row rolls back all',
  ignore: skip,
  async fn() {
    const w = await makeWriter(url!);
    try {
      const userId = crypto.randomUUID();
      const baseName = 'tx-test-' + userId.slice(0, 8);

      // Pre-seed a row whose name exactly matches the 2nd split's generated suffix.
      // insertMany uses `${baseName}-${category}-${idx}` for each split, so baseName-composite-1
      // collides when we attempt to insert the 2nd split (idx=1, category=composite).
      await w.insertComposite({
        userId,
        name: baseName + '-composite-1',
        systemPrompt: 'pre-seeded',
        userMessage: '{task}',
        analysis: { v: 1, mode: 'composite', why_it_works: 't', detected_axes: {}, strategy_tags: [], confidence: 'high' },
      });

      // insertMany: splits[0] (classifier, idx=0) should succeed; splits[1] (composite, idx=1)
      // should collide with the pre-seeded row. BEGIN/ROLLBACK contract requires splits[0] NOT to persist.
      await assertRejects(
        async () => {
          await w.insertMany({
            userId,
            baseName,
            splits: [
              { category: 'classifier', content: 'X' },  // -> baseName-classifier-0
              { category: 'composite', content: 'Y' },   // -> baseName-composite-1 (COLLIDES)
            ],
            analysis: { v: 1, mode: 'decomposed', why_it_works: 't', detected_axes: {}, strategy_tags: [], confidence: 'high' },
          });
        },
        Error,
        'duplicate_name',
      );

      // Verify rollback: no row named baseName-classifier-0 persisted.
      // (Direct query against the db to assert the contract.)
      // @ts-expect-error — accessing the private client is only for this test's verification.
      const client = (w as unknown as { __client?: unknown }).__client;
      // If the writer doesn't expose its pg client, rely on makeWriter's exposure
      // mechanism or skip this verification with a comment. For now, use a
      // separate connection to check.
      const { Client } = await import('postgres');
      const verify = new Client(url!);
      await verify.connect();
      try {
        const r = await verify.queryObject<{ count: string }>`
          SELECT COUNT(*)::text AS count FROM custom_techniques
          WHERE owner_user_id = ${userId}::uuid AND name = ${baseName + '-classifier-0'}`;
        assertEquals(r.rows[0].count, '0', 'classifier-0 row should NOT persist after rollback');
      } finally {
        await verify.end();
      }
    } finally {
      await w.close();
    }
  },
});

Deno.test({
  name: 'duplicate name raises duplicate_name',
  ignore: skip,
  async fn() {
    const w = await makeWriter(url!);
    try {
      const userId = crypto.randomUUID();
      const name = 'dup-' + userId.slice(0, 8);
      await w.insertComposite({
        userId,
        name,
        systemPrompt: 'A',
        userMessage: '{task}',
        analysis: { v: 1, mode: 'composite', why_it_works: 't', detected_axes: {}, strategy_tags: [], confidence: 'high' },
      });
      const err = await assertRejects(
        async () => {
          await w.insertComposite({
            userId,
            name,
            systemPrompt: 'B',
            userMessage: '{task}',
            analysis: { v: 1, mode: 'composite', why_it_works: 't', detected_axes: {}, strategy_tags: [], confidence: 'high' },
          });
        },
      );
      assertEquals((err as Error).message, 'duplicate_name');
    } finally {
      await w.close();
    }
  },
});
