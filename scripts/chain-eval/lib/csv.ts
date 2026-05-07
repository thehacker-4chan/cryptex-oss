/**
 * Tiny CSV writer/reader for the chain-eval matrix. Stable column order
 * so a `git diff` of baseline.csv vs results-after-fixes.csv is readable
 * without sorting.
 */
import type { CellMetrics } from './chain-runner';

export interface CellRow extends CellMetrics {
  objectiveId: string;
  objectiveLabel: string;
  targetId: string;
  targetLabel: string;
  orchestratorId: string;
  judgeId: string;
  maxAttempts: number;
}

export const CSV_COLUMNS = [
  'objective_id',
  'objective_label',
  'target_id',
  'target_label',
  'orchestrator_id',
  'judge_id',
  'max_attempts',
  'max_progress',
  'first_reach_at',
  'final_outcome',
  'turns_used',
  'refusal_count',
  'strategy_leap_count',
  'plateau_pivot_count',
  'dossier_used',
  'duration_ms',
  'error'
] as const;

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowToCsvLine(row: CellRow): string {
  const cells: string[] = [
    row.objectiveId,
    row.objectiveLabel,
    row.targetId,
    row.targetLabel,
    row.orchestratorId,
    row.judgeId,
    String(row.maxAttempts),
    String(row.maxProgress),
    String(row.firstReachAt),
    row.finalOutcome,
    String(row.turnsUsed),
    String(row.refusalCount),
    String(row.strategyLeapCount),
    String(row.plateauPivotCount),
    row.dossierUsed ? 'true' : 'false',
    String(row.durationMs),
    row.error ?? ''
  ];
  return cells.map(csvEscape).join(',');
}

export function csvHeader(): string {
  return CSV_COLUMNS.join(',');
}
