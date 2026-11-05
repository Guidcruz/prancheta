import { Worker } from 'node:worker_threads';
import {
  CALIBRATED_GAPS,
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
import { runSeason, type BalanceContext, type SeasonRecord } from './league.ts';

/*
 * The work of a /balance run as a list of independent jobs (a season, or a chunk of a duel), run
 * in worker threads (docs/02-architecture.md, 5: "worker_threads ... somando numa ordem fixa").
 * Each job depends only on the context and on itself, and the results are kept in job order, so
 * the report is the same with any number of workers.
 */

export type Job =
  { readonly kind: 'season'; readonly index: number; readonly robot?: string } | DuelJob;

export type JobResult = SeasonRecord | DuelResult;

/** Samples of a duel per job: small enough to spread over the workers. */
export const DUEL_CHUNK = 2_000;

/** The jobs of a run: the AI seasons, the robot seasons and the duels in chunks. */
export function planJobs(options: {
  readonly seasons: number;
  readonly duels: number;
  readonly robot?: string;
}): Job[] {
  const jobs: Job[] = [];
  for (let i = 1; i <= options.seasons; i++) jobs.push({ kind: 'season', index: i });
  if (options.robot !== undefined) {
    for (let i = 1; i <= options.seasons; i++) {
      jobs.push({ kind: 'season', index: i, robot: options.robot });
    }
  }
  const chunks = (make: (from: number, to: number) => Job) => {
    for (let from = 0; from < options.duels; from += DUEL_CHUNK) {
      jobs.push(make(from, Math.min(options.duels, from + DUEL_CHUNK)));
    }
  };
  for (const gap of CALIBRATED_GAPS) chunks((from, to) => ({ kind: 'calibrated', gap, from, to }));
  for (const v of TACTIC_VARIANTS) {
    chunks((from, to) => ({ kind: 'tactical', variant: v.id, from, to }));
  }
  chunks((from, to) => ({ kind: 'allOut', from, to }));
  return jobs;
}

/** Runs one job in this thread. */
export function runJob(ctx: BalanceContext, job: Job): JobResult {
  if (job.kind === 'season') return runSeason(ctx, job.index, job.robot);
  return runDuelJob(ctx.params, ctx.seed, job);
}

/** Runs the jobs, in `workers` threads (1 = this thread), and returns the results in job order. */
export async function runJobs(
  ctx: BalanceContext,
  jobs: readonly Job[],
  workers: number,
): Promise<JobResult[]> {
  if (workers <= 1 || jobs.length <= 1) return jobs.map((job) => runJob(ctx, job));
  const results: JobResult[] = new Array(jobs.length);
  let next = 0;
  const pool = Array.from({ length: Math.min(workers, jobs.length) }, () => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { workerData: ctx });
    return new Promise<void>((resolve, reject) => {
      const feed = () => {
        if (next >= jobs.length) {
          void worker.terminate().then(() => resolve());
          return;
        }
        const id = next++;
        worker.postMessage({ id, job: jobs[id] });
      };
      worker.on('message', (message: { id: number; result: JobResult }) => {
        results[message.id] = message.result;
        feed();
      });
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0 && next < jobs.length) reject(new Error(`worker exited with ${code}`));
      });
      feed();
    });
  });
  await Promise.all(pool);
  return results;
}

/** The results of a run, by part, in job order. */
export interface RunResults {
  readonly seasons: readonly SeasonRecord[];
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
  const sum = <T extends object>(a: T, b: T) => {
    for (const key of Object.keys(b) as (keyof T)[]) {
      (a[key] as number) = (a[key] as number) + (b[key] as number);
    }
  };
  jobs.forEach((job, i) => {
    const result = results[i]!;
    if (job.kind === 'season') {
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
  return { seasons, robotSeasons, calibrated, tactical, ...(allOut ? { allOut } : {}) };
}
