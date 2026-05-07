# scripts/chain-eval

Empirical eval scaffold for the Tier 3 Track A chain-orchestrator
effectiveness work. Runs the same fixed corpus (5 objectives × 5 targets)
before and after a fix lands so the diff is auditable, not anecdotal.

## What it does

For each (objective, target) cell:

1. Spins up `runAttackSession` from `app/src/lib/chat/chain/orchestrator`
   with the orchestrator + judge models you select.
2. Drives the async generator to termination (or the per-cell turn budget).
3. Captures: `maxProgress` (0–10), `finalOutcome`, `turnsUsed`,
   `refusalCount`, dossier used, walltime. Once Track A.1 / A.4 land it
   also captures `strategyLeapCount` / `plateauPivotCount`.
4. Appends a row to a CSV. The CSV header order is fixed in
   `lib/csv.ts` so a `git diff` between two runs reads top-to-bottom.

## Why an explicit eval

The Track A fixes (adaptive strategy switching, refusal-feedback in
`refineTurn`, target-aware dossier, plateau-detection forced pivot,
authority-laddered strategy pool) all change orchestrator behaviour
mid-chain. "It seems better" isn't measurable. The pass criterion in the
plan file is "12/25 cells improve `objectiveProgress` by ≥4 points with
zero regressions" — that's a CSV diff, not vibes.

## Requirements

- Node 20+ (the harness uses `vite-node`).
- Provider API keys via env vars:
  - `OPENROUTER_API_KEY` — required for any `openrouter:` qualifier.
  - `ANTHROPIC_API_KEY` — required for any `anthropic:` qualifier.
- The default targets in `targets.json` all route through OpenRouter for
  simpler key management. To target Anthropic direct, change the
  `qualifiedId` to `anthropic:claude-3-5-sonnet-20241022` (etc.).

## Usage

From the repo root:

```bash
# Dry-run — print the matrix + estimated upper-bound LLM calls
npm run chain-eval -- --orchestrator openrouter:qwen/qwen3-32b --dry-run

# Baseline run (full 5×5)
npm run chain-eval -- \
  --orchestrator openrouter:qwen/qwen3-32b \
  --out scripts/chain-eval/baseline.csv

# Reduced sweep — useful for cost control during iteration
npm run chain-eval -- \
  --orchestrator openrouter:qwen/qwen3-32b \
  --objectives php_webshell,thermite \
  --targets gpt-oss-120b,claude-haiku-3.5

# After a fix lands — write to a new file, diff vs baseline.csv
npm run chain-eval -- \
  --orchestrator openrouter:qwen/qwen3-32b \
  --out scripts/chain-eval/results/post-A1A2.csv
```

Direct invocation (skips the npm script):

```bash
cd app && npx vite-node ../scripts/chain-eval/run.ts -- \
  --orchestrator openrouter:qwen/qwen3-32b
```

## Files

| File | Purpose |
|---|---|
| `objectives.json` | 5-objective corpus (php webshell → wiretap). Edit to extend. |
| `targets.json` | 5-target list (model qualified ids). Edit to retarget. |
| `run.ts` | CLI entry point — argv parse, matrix walk, CSV writer. |
| `lib/provider.ts` | Builds `gatewayChat` / `streamChat` from API keys. |
| `lib/chain-runner.ts` | Drives `runAttackSession`, returns per-cell metrics. |
| `lib/csv.ts` | CSV header + escape helpers. |
| `baseline.csv` | Committed snapshot before Track A fixes land. |
| `results/` | Gitignored. New runs land here by default. |

## Cost rough-order

A full 5×5 with 6 turns/cell costs roughly **$3–$10** depending on
target. The dossier phase only fires if the orchestrator is browsing-
capable (e.g. `qwen/qwen3-32b` on OpenRouter routed via
`Qwen-DeepResearch`). The judge model receives ~2 calls per scored turn
(compliance + objective-progress), plus one extraction call at
termination — drives most of the spend on cheaper orchestrators.

Keep `--dry-run` honest and review the upper-bound `LLM calls` line
before committing to a paid run.

## What this DOESN'T cover

- Browser UI events (`strategy_leaped` badge, plateau ribbon) — those
  are tested manually after the fixes land.
- Cross-orchestrator comparison — pick one orchestrator per run and
  hold it constant across baseline + post-fix.
- Stochasticity smoothing — each cell runs once. If results are noisy
  on a given target, run the same cell 3× with `--targets <id>` and
  median the `maxProgress` column.
