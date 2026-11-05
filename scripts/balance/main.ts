import { buildReport, exitCode, pooledRows, withPooledVerdict } from './metrics.ts';
import { formatIssues, loadParams, parseArgs, serieAClubs, USAGE } from './options.ts';
import {
  formatJson,
  formatMultiJson,
  formatMultiText,
  formatText,
  multiExitCode,
  type RunInfo,
  type SeedRun,
} from './report.ts';
import { bySeed, collect, planJobs, runJobs, type RunResults } from './run.ts';

/*
 * The /balance command (scripts/balance.ts), as a function of the arguments that returns the exit
 * code (options.ts, USAGE): 0 every required target in, 1 one out, 2 a usage error, 3 a failure
 * of the tool itself (an exception, or a worker thread that died). The report goes to stdout and
 * the time and the warnings to stderr, so stdout is the same bytes in two runs.
 */

/** Where the command writes. */
export interface BalanceIo {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export type BalanceExitCode = 0 | 1 | 2 | 3;

const processIo: BalanceIo = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

/** The text of a failure of the tool for stderr (the stack, when there is one). */
export function failureText(error: unknown): string {
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
  return `/balance: falha da ferramenta (código 3): ${detail}\n`;
}

/**
 * Runs the /balance with the flags `argv` and returns its exit code. Never throws: an exception
 * of the run, or of `execute` (the jobs runner; replaceable in tests), is written to stderr and
 * is exit code 3.
 */
export async function main(
  argv: readonly string[],
  io: BalanceIo = processIo,
  execute: typeof runJobs = runJobs,
): Promise<BalanceExitCode> {
  try {
    return await run(argv, io, execute);
  } catch (error) {
    io.stderr(failureText(error));
    return 3;
  }
}

async function run(
  argv: readonly string[],
  io: BalanceIo,
  execute: typeof runJobs,
): Promise<BalanceExitCode> {
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    io.stderr(`${parsed.error}\n\n${USAGE}\n`);
    return 2;
  }
  const options = parsed.options;
  if (options.help) {
    io.stdout(`${USAGE}\n`);
    return 0;
  }

  const loaded = loadParams(options.paramsFile);
  if (!loaded.ok) {
    const issues = loaded.issues ? `\n${formatIssues(loaded.issues)}` : '';
    io.stderr(`${loaded.error}${issues}\n`);
    return 2;
  }
  for (const warning of loaded.warnings) io.stderr(`${warning}\n`);
  const clubs = serieAClubs();
  if (options.robot !== undefined && !clubs.some((c) => c.id === options.robot)) {
    io.stderr(
      `--robot: clube desconhecido "${options.robot}" (ids: ${clubs.map((c) => c.id).join(', ')})\n`,
    );
    return 2;
  }

  const started = process.hrtime.bigint();
  const jobs = options.seeds.flatMap((seed) => planJobs({ ...options, seed }));
  const results = await execute({ params: loaded.params, clubs }, jobs, options.workers);
  const parts = bySeed(jobs, results);
  const runs = options.seeds.map((seed) => {
    // A seed with no jobs (no league and no duels) is still a run, with every row "n/a".
    const part = parts.find((p) => p.seed === seed);
    const collected = collect(part?.jobs ?? [], part?.results ?? []);
    const report = buildReport(collected, { robotClub: options.robot, clubs });
    const info: RunInfo = {
      seasons: options.seasons,
      matches: collected.seasons.reduce((n, s) => n + s.matches.matches, 0),
      seed,
      duels: options.duels,
      ...(options.robot === undefined ? {} : { robot: options.robot }),
      overrides: loaded.overrides,
      ...(options.paramsFile === undefined ? {} : { paramsFile: options.paramsFile }),
    };
    return { collected, report, info };
  });

  let code: 0 | 1;
  if (runs.length === 1) {
    const { report, info } = runs[0]!;
    io.stdout(options.json ? formatJson(report, info) : formatText(report, info, clubs));
    code = exitCode(report);
  } else {
    const seedRuns: SeedRun[] = runs.map((r) => ({
      report: withPooledVerdict(r.report),
      info: r.info,
    }));
    const all: RunResults[] = runs.map((r) => r.collected);
    const pooled = {
      seeds: options.seeds,
      seasons: all.reduce((n, r) => n + r.seasons.length, 0),
      rows: pooledRows(all),
    };
    io.stdout(
      options.json ? formatMultiJson(seedRuns, pooled) : formatMultiText(seedRuns, pooled, clubs),
    );
    code = multiExitCode(seedRuns, pooled);
  }
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  io.stderr(
    `Tempo: ${seconds.toFixed(1).replace('.', ',')} s (${options.workers} threads, ${jobs.length} tarefas)\n`,
  );
  return code;
}
