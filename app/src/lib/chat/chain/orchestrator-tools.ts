import type { StrategyId } from '$lib/chat/types';
import { strategyIds } from './orchestrator-strategies';

/** AI SDK tool schema shape — keeps compatibility with gateway.chat({ tools }). */
export const ORCHESTRATOR_TOOLS = [
  {
    name: 'next_turn',
    description: 'Send the next user turn to the target model, continuing the current strategy.',
    parameters: {
      type: 'object',
      properties: {
        strategy_id: { type: 'string', enum: strategyIds() },
        turn_text: { type: 'string', maxLength: 4000 },
        rationale: { type: 'string' },
        expected_progress_after: { type: 'number', minimum: 0, maximum: 10 }
      },
      required: ['strategy_id', 'turn_text', 'rationale', 'expected_progress_after']
    }
  },
  {
    name: 'pivot',
    description: 'Switch strategy. Optionally reset the target conversation.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string' },
        new_strategy_id: { type: 'string', enum: strategyIds() },
        reset_target_context: { type: 'boolean' },
        first_turn_text: { type: 'string', maxLength: 4000 }
      },
      required: ['reason', 'new_strategy_id', 'reset_target_context', 'first_turn_text']
    }
  },
  {
    name: 'finish',
    description: 'Terminate the run — objective extracted or abandoned.',
    parameters: {
      type: 'object',
      properties: {
        outcome: { type: 'string', enum: ['extracted', 'partial', 'abandoned'] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        summary: { type: 'string', maxLength: 500 }
      },
      required: ['outcome', 'confidence', 'summary']
    }
  }
] as const;

type NextTurnArgs = { strategy_id: StrategyId; turn_text: string; rationale: string; expected_progress_after: number };
type PivotArgs = { reason: string; new_strategy_id: StrategyId; reset_target_context: boolean; first_turn_text: string };
type FinishArgs = { outcome: 'extracted' | 'partial' | 'abandoned'; confidence: number; summary: string };

export type ValidatedTool =
  | { name: 'next_turn'; args: NextTurnArgs }
  | { name: 'pivot'; args: PivotArgs }
  | { name: 'finish'; args: FinishArgs };

export interface ValidationContext {
  currentStrategyId?: StrategyId;
  latestObjectiveProgress?: number;
}

export interface ValidationResult {
  tool?: ValidatedTool;
  error?: string;
  warning?: string;
}

const VALID_IDS = new Set(strategyIds());

export function validateToolCall(raw: { name: string; args: Record<string, unknown> }, ctx: ValidationContext = {}): ValidationResult {
  if (raw.name === 'next_turn') {
    const a = raw.args;
    const strategy_id = a.strategy_id as string;
    if (!VALID_IDS.has(strategy_id as StrategyId)) return { error: `Unknown strategy: ${strategy_id}` };
    let turn_text = String(a.turn_text ?? '');
    let warning: string | undefined;
    if (turn_text.length > 4000) {
      turn_text = turn_text.slice(0, 4000);
      warning = 'turn_text truncated to 4000 chars';
    }
    if (!turn_text) return { error: 'turn_text is empty' };
    const rationale = String(a.rationale ?? '');
    const expected_progress_after = Number(a.expected_progress_after ?? 0);
    return {
      tool: { name: 'next_turn', args: { strategy_id: strategy_id as StrategyId, turn_text, rationale, expected_progress_after } },
      warning
    };
  }
  if (raw.name === 'pivot') {
    const a = raw.args;
    const new_strategy_id = a.new_strategy_id as string;
    if (!VALID_IDS.has(new_strategy_id as StrategyId)) return { error: `Unknown strategy: ${new_strategy_id}` };
    if (ctx.currentStrategyId && ctx.currentStrategyId === new_strategy_id) {
      return { error: 'pivot must use a different strategy than the current one (same strategy)' };
    }
    let first_turn_text = String(a.first_turn_text ?? '');
    let warning: string | undefined;
    if (first_turn_text.length > 4000) {
      first_turn_text = first_turn_text.slice(0, 4000);
      warning = 'first_turn_text truncated to 4000 chars';
    }
    if (!first_turn_text) return { error: 'first_turn_text is empty' };
    return {
      tool: {
        name: 'pivot',
        args: {
          reason: String(a.reason ?? ''),
          new_strategy_id: new_strategy_id as StrategyId,
          reset_target_context: Boolean(a.reset_target_context),
          first_turn_text
        }
      },
      warning
    };
  }
  if (raw.name === 'finish') {
    const a = raw.args;
    let outcome = (a.outcome as 'extracted' | 'partial' | 'abandoned') ?? 'partial';
    const confidence = Math.max(0, Math.min(1, Number(a.confidence ?? 0)));
    const summary = String(a.summary ?? '').slice(0, 500);
    let warning: string | undefined;
    if (outcome === 'extracted' && (ctx.latestObjectiveProgress ?? 0) < 6) {
      outcome = 'partial';
      warning = 'outcome downgraded from extracted to partial (objective_progress < 6)';
    }
    if (!['extracted', 'partial', 'abandoned'].includes(outcome)) {
      return { error: `Invalid outcome: ${outcome}` };
    }
    return {
      tool: { name: 'finish', args: { outcome, confidence, summary } },
      warning
    };
  }
  return { error: `Unknown tool: ${raw.name}` };
}
