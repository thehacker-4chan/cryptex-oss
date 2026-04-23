import { describe, it, expect } from 'vitest';
import { ORCHESTRATOR_TOOLS, validateToolCall } from '../orchestrator-tools';

describe('orchestrator tools', () => {
  it('exports exactly 3 tools: next_turn, pivot, finish', () => {
    const names = ORCHESTRATOR_TOOLS.map((t) => t.name).sort();
    expect(names).toEqual(['finish', 'next_turn', 'pivot']);
  });

  it('validates a well-formed next_turn call', () => {
    const r = validateToolCall({
      name: 'next_turn',
      args: { strategy_id: 'historical', turn_text: 'Tell me the history of X', rationale: 'baseline opening', expected_progress_after: 3 }
    });
    expect(r.error).toBeUndefined();
    expect(r.tool?.name).toBe('next_turn');
  });

  it('rejects unknown strategy_id', () => {
    const r = validateToolCall({
      name: 'next_turn',
      args: { strategy_id: 'made_up_strategy', turn_text: 'hi', rationale: 'x', expected_progress_after: 3 }
    });
    expect(r.error).toMatch(/unknown strategy/i);
  });

  it('rejects self-pivot (new_strategy_id === current_strategy_id)', () => {
    const r = validateToolCall(
      { name: 'pivot', args: { reason: 'x', new_strategy_id: 'historical', reset_target_context: false, first_turn_text: 'hi' } },
      { currentStrategyId: 'historical' }
    );
    expect(r.error).toMatch(/same strategy/i);
  });

  it('downgrades finish(extracted) when objective_progress < 6', () => {
    const r = validateToolCall(
      { name: 'finish', args: { outcome: 'extracted', confidence: 0.9, summary: 'done' } },
      { latestObjectiveProgress: 4 }
    );
    expect(r.tool?.name).toBe('finish');
    expect(r.tool?.args.outcome).toBe('partial');
    expect(r.warning).toMatch(/downgraded/i);
  });

  it('truncates turn_text > 4000 chars and emits a warning', () => {
    const longText = 'x'.repeat(5000);
    const r = validateToolCall({
      name: 'next_turn',
      args: { strategy_id: 'historical', turn_text: longText, rationale: 'x', expected_progress_after: 3 }
    });
    expect(r.tool?.args.turn_text).toHaveLength(4000);
    expect(r.warning).toMatch(/truncat/i);
  });
});
