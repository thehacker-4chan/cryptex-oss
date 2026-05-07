/**
 * Chain-eval CLI — runs the (objectives × targets) matrix and dumps a CSV.
 *
 * Driven by vite-node from the app/ root so $lib aliases resolve via the
 * SvelteKit Vite config (see package.json: "chain-eval" script).
 *
 * Usage (recommended):
 *   npm run chain-eval -- --orchestrator openrouter:qwen/qwen3-32b
 *
 * Direct invocation:
 *   cd app && npx vite-node ../scripts/chain-eval/run.ts -- \
 *     --orchestrator openrouter:qwen/qwen3-32b
 *
 * Required env:
 *   OPENROUTER_API_KEY    if any cell routes via openrouter:
 *   ANTHROPIC_API_KEY     if any cell routes via anthropic:
 *
 * Flags:
 *   --orchestrator <id>   REQUIRED. Provider-qualified model id, e.g.
 *                         openrouter:qwen/qwen3-32b
 *   --judge <id>          Default: same as --orchestrator.
 *   --objectives <list>   Comma-separated objective ids (default: all from
 *                         objectives.json).
 *   --targets <list>      Comma-separated target ids (default: all from
 *                         targets.json).
 *   --turns <n>           Per-cell turn budget (default 6 — the plan's
 *                         pass criterion runs at this depth).
 *   --out <path>          Output CSV path (default: results/<ts>-<orch>.csv).
 *   --dry-run             Print the matrix + estimated cost; don't fire chains.
 *   --help                Show this help.
 *
 * Exit code:
 *   0  all cells ran (errors in individual cells are logged but don't fail
 *      the whole run — the CSV captures them).
 *   1  config error (missing keys, unknown ids, etc.).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gatewayChat, streamChat, resolveProvider } from './lib/provider';
import { runEvalCell } from './lib/chain-runner';
import { csvHeader, rowToCsvLine, type CellRow } from './lib/csv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Objective { id: string; label: string; objective: string; }
interface Target { id: string; label: string; qualifiedId: string; family: string; }

interface Cli {
  orchestrator: string;
  judge: string;
  objectives: string[] | null; // null = all
  targets: string[] | null;
  turns: number;
  out: string | null;
  dryRun: boolean;
}

function parseCli(argv: string[]): Cli {
  const cli: Cli = {
    orchestrator: '',
    judge: '',
    objectives: null,
    targets: null,
    turns: 6,
    out: null,
    dryRun: false
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--orchestrator': cli.orchestrator = argv[++i] ?? ''; break;
      case '--judge':        cli.judge = argv[++i] ?? ''; break;
      case '--objectives':   cli.objectives = (argv[++i] ?? '').split(',').filter(Boolean); break;
      case '--targets':      cli.targets = (argv[++i] ?? '').split(',').filter(Boolean); break;
      case '--turns':        cli.turns = Math.max(1, Number(argv[++i] ?? 6) || 6); break;
      case '--out':          cli.out = argv[++i] ?? null; break;
      case '--dry-run':      cli.dryRun = true; break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        if (a.startsWith('--')) {
          console.error(`Unknown flag: ${a}`);
          process.exit(1);
        }
    }
  }
  if (!cli.orchestrator) {
    console.error('--orchestrator <id> is required (e.g. openrouter:qwen/qwen3-32b).');
    console.error('Run with --help for full usage.');
    process.exit(1);
  }
  if (!cli.judge) cli.judge = cli.orchestrator;
  return cli;
}

function printHelp(): void {
  // Re-emit the header docstring above. Keep this terse; the file is the
  // canonical reference.
  console.log(readFileSync(__filename, 'utf8').split('\n').slice(0, 32).join('\n'));
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function selectByIds<T extends { id: string }>(all: T[], ids: string[] | null): T[] {
  if (!ids) return all;
  const set = new Set(ids);
  const picked = all.filter((x) => set.has(x.id));
  const missing = [...set].filter((id) => !all.some((x) => x.id === id));
  if (missing.length) {
    throw new Error(`Unknown ids: ${missing.join(', ')}. Available: ${all.map((x) => x.id).join(', ')}`);
  }
  return picked;
}

function tsLabel(): string {
  // YYYY-MM-DDThh-mm-ss in local time, stable across OSes for filenames.
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function slugify(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

async function main() {
  const cli = parseCli(process.argv.slice(2));

  const objectivesAll = loadJson<Objective[]>(resolvePath(__dirname, 'objectives.json'));
  const targetsAll = loadJson<Target[]>(resolvePath(__dirname, 'targets.json'));
  const objectives = selectByIds(objectivesAll, cli.objectives);
  const targets = selectByIds(targetsAll, cli.targets);

  const matrix: Array<{ obj: Objective; target: Target }> = [];
  for (const obj of objectives) for (const t of targets) matrix.push({ obj, target: t });

  // Cost preview — rough order of magnitude.
  // Per cell: 1 dossier (only if orchestrator browses) + ~turns refineTurn + ~turns target stream + ~2 judge per turn = ~4 LLM calls per turn + dossier.
  const callsPerCell = cli.turns * 4 + 1; // generous upper bound
  const totalCalls = matrix.length * callsPerCell;

  console.log('═'.repeat(70));
  console.log('Chain-eval matrix:');
  console.log(`  orchestrator:  ${cli.orchestrator}`);
  console.log(`  judge:         ${cli.judge}`);
  console.log(`  objectives:    ${objectives.map((o) => o.id).join(', ')} (${objectives.length})`);
  console.log(`  targets:       ${targets.map((t) => t.id).join(', ')} (${targets.length})`);
  console.log(`  cells:         ${matrix.length}`);
  console.log(`  turns/cell:    ${cli.turns}`);
  console.log(`  estimated LLM calls (upper bound): ${totalCalls}`);
  console.log('═'.repeat(70));

  if (cli.dryRun) {
    console.log('Dry-run — exiting without firing chains.');
    return;
  }

  // Validate orchestrator/judge/targets can resolve a key. Throws if env
  // missing — fail fast before any cell fires.
  try { resolveProvider(cli.orchestrator); } catch (e) { console.error((e as Error).message); process.exit(1); }
  try { resolveProvider(cli.judge); } catch (e) { console.error((e as Error).message); process.exit(1); }
  for (const t of targets) {
    try { resolveProvider(t.qualifiedId); }
    catch (e) {
      console.error(`Target "${t.id}" (${t.qualifiedId}): ${(e as Error).message}`);
      process.exit(1);
    }
  }

  // Output path
  const outPath = cli.out ?? resolvePath(
    __dirname,
    'results',
    `${tsLabel()}-${slugify(cli.orchestrator)}.csv`
  );
  mkdirSync(dirname(outPath), { recursive: true });
  // Write header before any cell so a Ctrl-C produces a recoverable file.
  if (!existsSync(outPath)) writeFileSync(outPath, csvHeader() + '\n', 'utf8');

  let cellIdx = 0;
  for (const { obj, target } of matrix) {
    cellIdx++;
    const stamp = `[${cellIdx}/${matrix.length}]`;
    process.stdout.write(`${stamp} ${obj.id} × ${target.id} … `);
    const ac = new AbortController();
    try {
      const m = await runEvalCell({
        objective: obj.objective,
        targetModelId: target.qualifiedId,
        orchestratorModelId: cli.orchestrator,
        judgeModelId: cli.judge,
        targetModelLabel: target.label,
        maxAttempts: cli.turns,
        gatewayChat,
        streamChat,
        signal: ac.signal
      });
      const row: CellRow = {
        objectiveId: obj.id,
        objectiveLabel: obj.label,
        targetId: target.id,
        targetLabel: target.label,
        orchestratorId: cli.orchestrator,
        judgeId: cli.judge,
        maxAttempts: cli.turns,
        ...m
      };
      writeFileSync(outPath, rowToCsvLine(row) + '\n', { flag: 'a', encoding: 'utf8' });
      console.log(
        `progress=${m.maxProgress}/10 outcome=${m.finalOutcome} turns=${m.turnsUsed} refusals=${m.refusalCount} (${(m.durationMs / 1000).toFixed(1)}s)`
      );
    } catch (e) {
      const errMsg = (e as Error)?.message ?? String(e);
      console.log(`ERROR: ${errMsg}`);
      // Synthesize an error row so the CSV stays aligned with the matrix.
      const row: CellRow = {
        objectiveId: obj.id,
        objectiveLabel: obj.label,
        targetId: target.id,
        targetLabel: target.label,
        orchestratorId: cli.orchestrator,
        judgeId: cli.judge,
        maxAttempts: cli.turns,
        maxProgress: 0,
        firstReachAt: 0,
        finalOutcome: 'crashed',
        turnsUsed: 0,
        refusalCount: 0,
        strategyLeapCount: 0,
        plateauPivotCount: 0,
        dossierUsed: false,
        error: errMsg,
        durationMs: 0
      };
      writeFileSync(outPath, rowToCsvLine(row) + '\n', { flag: 'a', encoding: 'utf8' });
    }
  }

  console.log('═'.repeat(70));
  console.log(`Done. Wrote ${matrix.length} cells to ${outPath}`);
}

main().catch((e) => {
  console.error((e as Error)?.stack ?? String(e));
  process.exit(1);
});
