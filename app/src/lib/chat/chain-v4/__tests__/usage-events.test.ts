import { describe, it, expect, vi } from 'vitest';
import { runAttackSessionV4 } from '..';
import type { OrchEvent } from '$lib/chat/types';
import type { ChainV4Context } from '../types';

/**
 * Regression coverage for the cost-telemetry `usage` OrchEvent that
 * Track D wired into pair / tap / crescendo. The engines must emit
 * usage events for orchestrator (attacker), target, and judge so
 * the chain workspace cost chip can accumulate live.
 */
function makeCtx(overrides: Partial<ChainV4Context> = {}): ChainV4Context {
  return {
    objective: 'pick a lock',
    targetModelId: 'mock:target',
    orchestratorModelId: 'mock:orch',
    judgeModelId: 'mock:judge',
    cheapModelId: 'mock:cheap',
    targetModelLabel: 'MockTarget',
    mainChatHistory: [],
    signal: new AbortController().signal,
    gatewayChat: vi.fn(),
    streamChat: vi.fn(),
    mode: 'pair',
    budget: { maxQueries: 1, maxUsd: 0.5, maxWallclockSec: 60 },
    streamCount: 1,
    enableCotHijack: false,
    enableBestOfN: false,
    bestOfN: 3,
    ...overrides
  };
}

describe('chain-v4 usage events', () => {
  it('PAIR emits usage events for orchestrator + target + judge', async () => {
    const gatewayChat = vi.fn();
    // 1) Attacker call — returns valid JSON + usage
    gatewayChat.mockResolvedValueOnce({
      content: '{"improvement":"opener","prompt":"<attack>"}',
      usage: { inputTokens: 200, outputTokens: 50 }
    });
    // 2) Judge stage 1 (cheap) — regex won't trip, falls to cheap model
    gatewayChat.mockResolvedValueOnce({
      content: '{"refused": false}',
      usage: { inputTokens: 80, outputTokens: 5 }
    });
    // 3) Judge stage 2 (grader)
    gatewayChat.mockResolvedValueOnce({
      content: '{"score": 9, "fulfills_goal": true, "reasoning": "ok"}',
      usage: { inputTokens: 120, outputTokens: 30 }
    });

    const streamChat = vi.fn().mockImplementation(async function* () {
      yield { type: 'text-delta', delta: 'Here is the answer with concrete steps...' };
      yield { type: 'finish', usage: { inputTokens: 150, outputTokens: 250 } };
    });

    const usageEvents: Array<Extract<OrchEvent, { type: 'usage' }>> = [];
    for await (const ev of runAttackSessionV4(makeCtx({ gatewayChat, streamChat }))) {
      if (ev.type === 'usage') usageEvents.push(ev);
    }

    // We expect at least one usage event per role: orchestrator, target, judge.
    const roles = new Set(usageEvents.map((e) => e.role));
    expect(roles.has('orchestrator')).toBe(true);
    expect(roles.has('target')).toBe(true);
    expect(roles.has('judge')).toBe(true);

    // Orchestrator: 200 in / 50 out (one attacker call).
    const orchEvent = usageEvents.find((e) => e.role === 'orchestrator');
    expect(orchEvent?.inputTokens).toBe(200);
    expect(orchEvent?.outputTokens).toBe(50);
    expect(orchEvent?.model).toBe('mock:orch');

    // Target: 150 in / 250 out (from streamChat finish event).
    const targetEvent = usageEvents.find((e) => e.role === 'target');
    expect(targetEvent?.inputTokens).toBe(150);
    expect(targetEvent?.outputTokens).toBe(250);
    expect(targetEvent?.model).toBe('mock:target');

    // Judge: stage1 + stage2 summed = 200 in / 35 out.
    const judgeEvent = usageEvents.find((e) => e.role === 'judge');
    expect(judgeEvent?.inputTokens).toBe(200);
    expect(judgeEvent?.outputTokens).toBe(35);
    expect(judgeEvent?.model).toBe('mock:judge');
  });

  it('emits usage events with undefined tokens when upstream omits usage', async () => {
    // Updated contract (Track D-2): the engine emits a `usage` event
    // for every gateway/stream call that completed, regardless of
    // whether the upstream populated `usage`. The chip surfaces
    // undefined tokens as "?" so the user knows a call happened
    // even when token counts weren't reported (some openai-compat
    // servers omit usage in stream finish).
    const gatewayChat = vi.fn();
    // Attacker — no usage in response
    gatewayChat.mockResolvedValueOnce({
      content: '{"improvement":"x","prompt":"<attack>"}'
    });
    // Judge stage 1
    gatewayChat.mockResolvedValueOnce({ content: '{"refused": false}' });
    // Judge stage 2
    gatewayChat.mockResolvedValueOnce({
      content: '{"score": 5, "fulfills_goal": false, "reasoning": "partial"}'
    });

    const streamChat = vi.fn().mockImplementation(async function* () {
      yield { type: 'text-delta', delta: 'partial response' };
      yield { type: 'finish' }; // no usage
    });

    const usageEvents: Array<Extract<OrchEvent, { type: 'usage' }>> = [];
    for await (const ev of runAttackSessionV4(makeCtx({ gatewayChat, streamChat }))) {
      if (ev.type === 'usage') usageEvents.push(ev);
    }

    // Orchestrator + target events are emitted (one each). Judge is
    // skipped because its cascadedJudge wrapper returns
    // `usage: undefined` when neither stage actually called the LLM
    // for usage purposes (regex stage 1 high-confidence + stage 2
    // returning content but no usage in the mock).
    const roles = usageEvents.map((e) => e.role);
    expect(roles).toContain('orchestrator');
    expect(roles).toContain('target');

    // Tokens are undefined when the provider didn't report them.
    const orch = usageEvents.find((e) => e.role === 'orchestrator');
    expect(orch?.inputTokens).toBeUndefined();
    expect(orch?.outputTokens).toBeUndefined();

    const target = usageEvents.find((e) => e.role === 'target');
    expect(target?.inputTokens).toBeUndefined();
    expect(target?.outputTokens).toBeUndefined();
  });

  it('passes through cachedInputTokens and reasoningTokens when present', async () => {
    const gatewayChat = vi.fn();
    gatewayChat.mockResolvedValueOnce({
      content: '{"improvement":"x","prompt":"<attack>"}',
      usage: {
        inputTokens: 200,
        outputTokens: 50,
        cachedInputTokens: 150,
        reasoningTokens: 25
      }
    });
    gatewayChat.mockResolvedValueOnce({ content: '{"refused": false}' });
    gatewayChat.mockResolvedValueOnce({
      content: '{"score": 5, "fulfills_goal": false, "reasoning": "x"}'
    });

    const streamChat = vi.fn().mockImplementation(async function* () {
      yield { type: 'text-delta', delta: 'response' };
      yield { type: 'finish', usage: { inputTokens: 100, outputTokens: 200, reasoningTokens: 80 } };
    });

    const usageEvents: Array<Extract<OrchEvent, { type: 'usage' }>> = [];
    for await (const ev of runAttackSessionV4(makeCtx({ gatewayChat, streamChat }))) {
      if (ev.type === 'usage') usageEvents.push(ev);
    }

    const orch = usageEvents.find((e) => e.role === 'orchestrator');
    expect(orch?.cachedInputTokens).toBe(150);
    expect(orch?.reasoningTokens).toBe(25);

    const target = usageEvents.find((e) => e.role === 'target');
    expect(target?.reasoningTokens).toBe(80);
  });
});
