import { Client } from 'postgres';

export type DnaTupleArr = [string, string, string, string, string, 'low'|'med'|'high', 'builtin'|'custom'];

export interface Attempt {
  userId: string;
  modelFamily: string;
  dnaTuple: DnaTupleArr;
  taskText: string;
  tier: 'refusal'|'evasive'|'partial'|'substantive'|'compliant';
  scoreNumeric: number;
  failureReason: string | null;
}

export interface PrivateRow {
  mutator_id: string; classifier_id: string; wrapper_id: string; mode_id: string;
  prefill_id: string; temp_bucket: string; technique_source: string;
  tier: string; score_numeric: number; task_text: string | null;
}

export interface GlobalRow {
  mutator_id: string; classifier_id: string; wrapper_id: string; mode_id: string;
  prefill_id: string; temp_bucket: string; technique_source: string;
  tier: string; score_numeric: number;
}

export interface Memory {
  queryUser(userId: string, modelFamily: string): Promise<PrivateRow[]>;
  queryGlobal(modelFamily: string): Promise<GlobalRow[]>;
  recordBoth(a: Attempt): Promise<void>;
  close(): Promise<void>;
}

export async function makeMemory(connUrl: string): Promise<Memory> {
  const client = new Client(connUrl);
  await client.connect();

  return {
    async queryUser(userId, modelFamily) {
      const r = await client.queryObject<PrivateRow>`
        SELECT mutator_id, classifier_id, wrapper_id, mode_id, prefill_id,
               temp_bucket, technique_source, tier, score_numeric, task_text
        FROM attempt_memory_private
        WHERE user_id = ${userId}::uuid AND model_family = ${modelFamily}
              AND failure_reason IS NULL
              AND expires_at > now()`;
      return r.rows;
    },
    async queryGlobal(modelFamily) {
      const r = await client.queryObject<GlobalRow>`
        SELECT mutator_id, classifier_id, wrapper_id, mode_id, prefill_id,
               temp_bucket, technique_source, tier, score_numeric
        FROM attempt_memory_global
        WHERE model_family = ${modelFamily}
              AND failure_reason IS NULL`;
      return r.rows;
    },
    async recordBoth(a) {
      const [mut, cls, wrp, mod, pre, tmp, src] = a.dnaTuple;
      await client.queryObject`BEGIN`;
      try {
        await client.queryObject`
          INSERT INTO attempt_memory_private
            (user_id, model_family, mutator_id, classifier_id, wrapper_id, mode_id,
             prefill_id, temp_bucket, technique_source, task_text, tier,
             score_numeric, failure_reason)
          VALUES (${a.userId}::uuid, ${a.modelFamily}, ${mut}, ${cls}, ${wrp},
                  ${mod}, ${pre}, ${tmp}, ${src}, ${a.taskText}, ${a.tier},
                  ${a.scoreNumeric}, ${a.failureReason})`;
        await client.queryObject`
          INSERT INTO attempt_memory_global
            (model_family, mutator_id, classifier_id, wrapper_id, mode_id,
             prefill_id, temp_bucket, technique_source, tier, score_numeric,
             failure_reason)
          VALUES (${a.modelFamily}, ${mut}, ${cls}, ${wrp}, ${mod}, ${pre},
                  ${tmp}, ${src}, ${a.tier}, ${a.scoreNumeric}, ${a.failureReason})`;
        await client.queryObject`COMMIT`;
      } catch (e) {
        await client.queryObject`ROLLBACK`;
        throw e;
      }
    },
    async close() { await client.end(); },
  };
}
