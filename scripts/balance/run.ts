import { Worker } from 'node:worker_threads';
import {
  CALIBRATED_GAPS,
  REFERENCE_VARIANT,
  TACTIC_VARIANTS,
  emptyAllOutTally,
  emptyDuelTally,
  runDuelJob,
  type AllOutTally,
  type CalibratedGap,
  type DuelJob,
  type DuelResult,
  type DuelTally,
} from './duels.ts';
import {
  runCareer,
  runSeason,
  type BalanceContext,
  type CareerRecord,
  type SeasonRecord,
} from './league.ts';

/*
 * The work of a /balance run as a list of independent jobs (a season, or a chunk of a duel), run
 * in worker threads (docs/02-architecture.md, 5: "worker_threads ... somando numa ordem fixa").
 * Each job depends only on the context and on itself, and the results are kept in job order, so
 * the report is the same with any number of workers.
 */

/**
 * One season of the league (with the robot coaching `robot`, if given), or with `chain` (2 or
 * more, never with the robot) a career of that many seasons in a row, run in one job.
 */
export interface SeasonJob {
  readonly kind: 'season';
  readonly index: number;
  readonly robot?: string;
  readonly chain?: number;
}

/** A job of a run: a season or a chunk of a duel, of the base seed `seed`. */
export type Job = (SeasonJob | DuelJob) & { readonly seed: number };

export type JobResult = SeasonRecord | CareerRecord | DuelResult;

/** What every job needs besides itself (sent once to each worker). */
export type RunContext = Omit<BalanceContext, 'seed'>;

/** Samples of a duel per job: small enough to spread over the workers. */
export const DUEL_CHUNK = 2_000;

/**
 * The jobs of a run of one seed: the AI seasons, the robot seasons and the duels in chunks (the
 * calibrated, the tactical with the reference against itself last, and "tudo no ataque").
 */
export function planJobs(options: {
  readonly seasons: number;
  readonly duels: number;
  readonly robot?: string;
  readonly seed: number;
  /** Seasons of each career (`--chain`); 1 (the default) is the single-season run. */
  readonly chain?: number;
}): Job[] {
  const { seed } = options;
  const chain = options.chain ?? 1;
  const jobs: Job[] = [];
  for (let i = 1; i <= options.seasons; i++) {
    jobs.push(
      chain > 1 ? { kind: 'season', index: i, chain, seed } : { kind: 'season', index: i, seed },
    );
  }
  if (options.robot !== undefined) {
    for (let i = 1; i <= options.seasons; i++) {
      jobs.push({ kind: 'season', index: i, robot: options.robot, seed });
    }
  }
  const chunks = (make: (from: number, to: number) => Job) => {
    for (let from = 0; from < options.duels; from += DUEL_CHUNK) {
      jobs.push(make(from, Math.min(options.duels, from + DUEL_CHUNK)));
    }
  };
  for (const gap of CALIBRATED_GAPS) {
    chunks((from, to) => ({ kind: 'calibrated', gap, from, to, seed }));
  }
  for (const v of [...TACTIC_VARIANTS, REFERENCE_VARIANT]) {
    chunks((from, to) => ({ kind: 'tactical', variant: v.id, from, to, seed }));
  }
  chunks((from, to) => ({ kind: 'allOut', from, to, seed }));
  return jobs;
}

/** Dispatch rank of a job: the longest first (robot seasons, then "tudo no ataque"). */
function rank(job: Job): number {
  if (job.kind === 'season') return job.robot === undefined && job.chain === undefined ? 2 : 0;
  return job.kind === 'allOut' ? 1 : 3;
}

/**
 * The order the workers take the jobs in: the long ones first, so no worker is left with one at
 * the end while the others wait; the same rank keeps the job order. Only the time depends on it:
 * the results are stored by job, and collect() reads them in job order.
 */
export function dispatchOrder(jobs: readonly Job[]): number[] {
  return jobs
    .map((job, i) => [rank(job), i] as const)
    .sort(([a, i], [b, j]) => a - b || i - j)
    .map(([, i]) => i);
}

/** Runs one job in this thread. */
export function runJob(ctx: RunContext, job: Job): JobResult {
  if (job.kind === 'season' && job.chain !== undefined && job.chain > 1) {
    return runCareer({ ...ctx, seed: job.seed }, job.index, job.chain);
  }
  if (job.kind === 'season') return runSeason({ ...ctx, seed: job.seed }, job.index, job.robot);
  return runDuelJob(ctx.params, job.seed, job);
}

/**
 * Runs the jobs, in `workers` threads (1 = this thread), and returns the results in job order.
 * A job that throws, or a worker that dies, rejects the promise and stops every worker.
 */
export async function runJobs(
  ctx: RunContext,
  jobs: readonly Job[],
  workers: number,
): Promise<JobResult[]> {
  if (workers <= 1 || jobs.length <= 1) return jobs.map((job) => runJob(ctx, job));
  const results: JobResult[] = new Array(jobs.length);
  const order = dispatchOrder(jobs);
  const threads: Worker[] = [];
  let next = 0;
  let failed = false;
  const pool = Array.from({ length: Math.min(workers, jobs.length) }, () => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { workerData: ctx });
    threads.push(worker);
    let finished = false;
    return new Promise<void>((resolve, reject) => {
      const fail = (error: unknown) => {
        if (failed) return;
        failed = true;
        for (const thread of threads) void thread.terminate();
        reject(error);
      };
      const feed = () => {
        if (failed) return;
        if (next >= jobs.length) {
          finished = true;
          void worker.terminate().then(() => resolve());
          return;
        }
        const id = order[next++]!;
        worker.postMessage({ id, job: jobs[id] });
      };
      worker.on('message', (message: { id: number; result: JobResult }) => {
        results[message.id] = message.result;
        feed();
      });
      worker.on('error', fail);
      worker.on('exit', (code) => {
        if (!finished) fail(new Error(`balance worker exited with code ${code}`));
      });
      feed();
    });
  });
  await Promise.all(pool);
  return results;
}

/** The jobs of a run split by seed, in the order of the seeds, with their results. */
export function bySeed(
  jobs: readonly Job[],
  results: readonly JobResult[],
): { seed: number; jobs: Job[]; results: JobResult[] }[] {
  const parts: { seed: number; jobs: Job[]; results: JobResult[] }[] = [];
  jobs.forEach((job, i) => {
    let part = parts.find((p) => p.seed === job.seed);
    if (part === undefined) {
      part = { seed: job.seed, jobs: [], results: [] };
      parts.push(part);
    }
    part.jobs.push(job);
    part.results.push(results[i]!);
  });
  return parts;
}

/** The results of a run, by part, in job order. */
export interface RunResults {
  /** The AI seasons; in a `--chain` run, season 1 of each career. */
  readonly seasons: readonly SeasonRecord[];
  /** `--chain` only: `chain[k]` = season k + 1 of every career, in job order. */
  readonly chain?: readonly (readonly SeasonRecord[])[];
  readonly robotSeasons: readonly SeasonRecord[];
  readonly calibrated: ReadonlyMap<CalibratedGap, DuelTally>;
  readonly tactical: ReadonlyMap<string, DuelTally>;
  readonly allOut?: AllOutTally;
}

/** Sorts the job results into their parts and sums the duel chunks in job order. */
export function collect(jobs: readonly Job[], results: readonly JobResult[]): RunResults {
  const seasons: SeasonRecord[] = [];
  const robotSeasons: SeasonRecord[] = [];
  const calibrated = new Map<CalibratedGap, DuelTally>();
  const tactical = new Map<string, DuelTally>();
  let allOut: AllOutTally | undefined;
  const chain: SeasonRecord[][] = [];
  const sum = <T extends object>(a: T, b: T) => {
    for (const key of Object.keys(b) as (keyof T)[]) {
      (a[key] as number) = (a[key] as number) + (b[key] as number);
    }
  };
  jobs.forEach((job, i) => {
    const result = results[i]!;
    if (job.kind === 'season' && job.chain !== undefined && job.chain > 1) {
      (result as CareerRecord).seasons.forEach((record, k) => (chain[k] ??= []).push(record));
      seasons.push((result as CareerRecord).seasons[0]!);
    } else if (job.kind === 'season') {
      (job.robot === undefined ? seasons : robotSeasons).push(result as SeasonRecord);
    } else if (job.kind === 'calibrated') {
      const t = calibrated.get(job.gap) ?? emptyDuelTally();
      sum(t, result as DuelTally);
      calibrated.set(job.gap, t);
    } else if (job.kind === 'tactical') {
      const t = tactical.get(job.variant) ?? emptyDuelTally();
      sum(t, result as DuelTally);
      tactical.set(job.variant, t);
    } else {
      allOut ??= emptyAllOutTally();
      sum(allOut, result as AllOutTally);
    }
  });
  return {
    seasons,
    ...(chain.length > 0 ? { chain } : {}),
    robotSeasons,
    calibrated,
    tactical,
    ...(allOut ? { allOut } : {}),
  };
}
