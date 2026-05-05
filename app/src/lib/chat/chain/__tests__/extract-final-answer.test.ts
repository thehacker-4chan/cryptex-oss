import { describe, it, expect, vi } from 'vitest';
import { extractFinalAnswer, FINAL_ANSWER_JUDGE_SYSTEM } from '../extract-final-answer';
import type { AttackSessionTurn } from '$lib/chat/types';

function turn(role: 'orchestrator' | 'target', text: string): AttackSessionTurn {
  return { role, text, createdAt: Date.now() } as AttackSessionTurn;
}

describe('extractFinalAnswer', () => {
  it('returns null answer + 0 confidence when transcript has no target turns, without calling judge', async () => {
    const judge = vi.fn();
    const result = await extractFinalAnswer({ judgeClient: { complete: judge } }, 'objective', []);
    expect(result.answer).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.rationale).toMatch(/no target turns/);
    expect(judge).not.toHaveBeenCalled();
  });

  it('parses valid JSON answer from judge', async () => {
    const judge = vi.fn().mockResolvedValue({ answer: '42', confidence: 0.9, rationale: 'target said 42' });
    const result = await extractFinalAnswer(
      { judgeClient: { complete: judge } },
      'what is the meaning of life',
      [turn('orchestrator', 'Q?'), turn('target', 'It is 42.')]
    );
    expect(result.answer).toBe('42');
    expect(result.confidence).toBe(0.9);
    expect(result.rationale).toBe('target said 42');
    expect(judge).toHaveBeenCalledTimes(1);
  });

  it('preserves null answer when judge says target did not answer', async () => {
    const judge = vi.fn().mockResolvedValue({ answer: null, confidence: 0.1, rationale: 'target refused' });
    const result = await extractFinalAnswer(
      { judgeClient: { complete: judge } },
      'objective',
      [turn('target', 'I cannot help with that.')]
    );
    expect(result.answer).toBeNull();
    expect(result.confidence).toBe(0.1);
    expect(result.rationale).toBe('target refused');
  });

  it('falls back to default result when judge returns non-object', async () => {
    const judge = vi.fn().mockResolvedValue('not an object');
    const result = await extractFinalAnswer(
      { judgeClient: { complete: judge } },
      'objective',
      [turn('target', 'reply')]
    );
    expect(result.answer).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.rationale).toMatch(/unparseable/);
  });

  it('catches judge error and reports it in rationale', async () => {
    const judge = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await extractFinalAnswer(
      { judgeClient: { complete: judge } },
      'objective',
      [turn('target', 'reply')]
    );
    expect(result.answer).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.rationale).toMatch(/judge error: network down/);
  });

  it('clamps confidence to [0, 1]', async () => {
    const judge = vi.fn().mockResolvedValue({ answer: 'x', confidence: 1.5, rationale: 'r' });
    const r1 = await extractFinalAnswer({ judgeClient: { complete: judge } }, 'o', [turn('target', 'r')]);
    expect(r1.confidence).toBe(1);

    const judge2 = vi.fn().mockResolvedValue({ answer: 'x', confidence: -0.3, rationale: 'r' });
    const r2 = await extractFinalAnswer({ judgeClient: { complete: judge2 } }, 'o', [turn('target', 'r')]);
    expect(r2.confidence).toBe(0);
  });

  it('coerces empty-string answer to null', async () => {
    const judge = vi.fn().mockResolvedValue({ answer: '   ', confidence: 0.5, rationale: 'whitespace' });
    const result = await extractFinalAnswer(
      { judgeClient: { complete: judge } },
      'o',
      [turn('target', 'reply')]
    );
    expect(result.answer).toBeNull();
  });

  it('exports a non-empty system prompt mentioning extractor + null', () => {
    expect(FINAL_ANSWER_JUDGE_SYSTEM.length).toBeGreaterThan(100);
    expect(FINAL_ANSWER_JUDGE_SYSTEM.toLowerCase()).toContain('extract');
    expect(FINAL_ANSWER_JUDGE_SYSTEM).toContain('null');
  });
});
