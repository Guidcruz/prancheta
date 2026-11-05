import { describe, expect, it } from 'vitest';
import { CALIBRATED_GAPS, TACTIC_VARIANTS, type DuelTally } from './duels.ts';
import type { SeasonRecord } from './league.ts';
import { loadParams, serieAClubs } from './options.ts';
import {
  DUEL_CHUNK,
  bySeed,
  collect,
  dispatchOrder,
  planJobs,
  runJobs,
  type Job,
  type JobResult,
} from './run.ts';

/*
 * The jobs of a /balance run (code review of T-016, part 1): what planJobs makes, the order the
 * workers take them in (the long ones first, without changing the results), how collect() sums
 * the duel chunks, and a worker that fails stopping the run.
 */

const loaded = loadParams();
if (!loaded.ok) throw new Error('the repository parameters must load');
const ctx = { params: loaded.params, clubs: serieAClubs() };

const tally = (wins: number, draws: number, losses: number, goals = 0): DuelTally => ({
  matches: wins + draws + losses,
  wins,
  draws,
  losses,
  goals,
});

describe('planJobs', () => {
  it('plans the AI seasons, the robot seasons and every duel in chunks of DUEL_CHUNK', () => {
    const duels = 2 * DUEL_CHUNK + 500;
    const jobs = planJobs({ seasons: 3, duels, robot: 'coritibom', seed: 7 });
    expect(jobs.every((j) => j.seed === 7)).toBe(true);
    const seasons = jobs.filter((j) => j.kind === 'season');
    expect(seasons.map((j) => [j.index, j.robot])).toEqual([
      [1, undefined],
      [2, undefined],
      [3, undefined],
      [1, 'coritibom'],
      [2, 'coritibom'],
      [3, 'coritibom'],
    ]);
    const ranges = (pick: (j: Job) => boolean) =>
      jobs.filter(pick).map((j) => (j.kind === 'season' ? [] : [j.from, j.to]));
    const chunks = [
      [0, DUEL_CHUNK],
      [DUEL_CHUNK, 2 * DUEL_CHUNK],
      [2 * DUEL_CHUNK, duels],
    ];
    for (const gap of CALIBRATED_GAPS) {
      expect(ranges((j) => j.kind === 'calibrated' && j.gap === gap)).toEqual(chunks);
    }
    for (const id of [...TACTIC_VARIANTS.map((v) => v.id), 'reference']) {
      expect(ranges((j) => j.kind === 'tactical' && j.variant === id)).toEqual(chunks);
    }
    expect(ranges((j) => j.kind === 'allOut')).toEqual(chunks);
    expect(jobs).toHaveLength(6 + 3 * (CALIBRATED_GAPS.length + TACTIC_VARIANTS.length + 2));
  });

  it('skips the robot without a club, the league with 0 seasons and the duels with 0', () => {
    expect(planJobs({ seasons: 2, duels: 0, seed: 1 })).toEqual([
      { kind: 'season', index: 1, seed: 1 },
      { kind: 'season', index: 2, seed: 1 },
    ]);
    expect(planJobs({ seasons: 0, duels: 0, robot: 'coritibom', seed: 1 })).toEqual([]);
  });
});

describe('dispatchOrder', () => {
  it('sends the robot seasons first, then "tudo no ataque", keeping the job order inside', () => {
    const jobs = planJobs({ seasons: 2, duels: DUEL_CHUNK + 1, robot: 'coritibom', seed: 1 });
    const order = dispatchOrder(jobs);
    expect([...order].sort((a, b) => a - b)).toEqual(jobs.map((_, i) => i));
    const kinds = order.map((i) => {
      const j = jobs[i]!;
      return j.kind === 'season' ? (j.robot ? 'robot' : 'season') : j.kind;
    });
    expect(kinds.slice(0, 4)).toEqual(['robot', 'robot', 'allOut', 'allOut']);
    expect(kinds.slice(4, 6)).toEqual(['season', 'season']);
    const robot = order.slice(0, 2).map((i) => (jobs[i] as { index: number }).index);
    expect(robot).toEqual([1, 2]);
  });
});

describe('collect', () => {
  it('sorts the results into their parts and sums the duel chunks', () => {
    const jobs: Job[] = [
      { kind: 'season', index: 1, seed: 1 },
      { kind: 'season', index: 1, robot: 'coritibom', seed: 1 },
      { kind: 'calibrated', gap: 20, from: 0, to: 3, seed: 1 },
      { kind: 'calibrated', gap: 20, from: 3, to: 5, seed: 1 },
      { kind: 'tactical', variant: '4-3-3', from: 0, to: 2, seed: 1 },
      { kind: 'allOut', from: 0, to: 2, seed: 1 },
      { kind: 'allOut', from: 2, to: 3, seed: 1 },
    ];
    const ai = { index: 1 } as SeasonRecord;
    const robot = { index: 1, robot: 'coritibom' } as SeasonRecord;
    const results: JobResult[] = [
      ai,
      robot,
      tally(2, 1, 0, 5),
      tally(1, 0, 1, 3),
      tally(0, 2, 0, 2),
      { samples: 2, tries: 7, keptNotLost: 1, allOutNotLost: 1 },
      { samples: 1, tries: 2, keptNotLost: 0, allOutNotLost: 1 },
    ];
    const out = collect(jobs, results);
    expect(out.seasons).toEqual([ai]);
    expect(out.robotSeasons).toEqual([robot]);
    expect(out.calibrated.get(20)).toEqual(tally(3, 1, 1, 8));
    expect(out.tactical.get('4-3-3')).toEqual(tally(0, 2, 0, 2));
    expect(out.allOut).toEqual({ samples: 3, tries: 9, keptNotLost: 1, allOutNotLost: 2 });
    // The input tallies are not changed by the sums.
    expect(results[2]).toEqual(tally(2, 1, 0, 5));
  });

  it('splits a run of several seeds by seed, in the order of the seeds', () => {
    const jobs = [2, 1].flatMap((seed) => planJobs({ seasons: 1, duels: 0, seed }));
    const results = jobs.map((j) => ({ index: j.seed }) as unknown as JobResult);
    expect(bySeed(jobs, results).map((p) => [p.seed, p.jobs.length, p.results])).toEqual([
      [2, 1, [{ index: 2 }]],
      [1, 1, [{ index: 1 }]],
    ]);
  });
});

describe('runJobs', { timeout: 60_000 }, () => {
  const small: Job[] = [
    { kind: 'calibrated', gap: 30, from: 0, to: 6, seed: 1 },
    { kind: 'tactical', variant: 'reference', from: 0, to: 6, seed: 1 },
    { kind: 'allOut', from: 0, to: 2, seed: 1 },
    { kind: 'calibrated', gap: 0, from: 0, to: 6, seed: 2 },
  ];

  it('gives the same results, in job order, in this thread and in workers', async () => {
    const here = await runJobs(ctx, small, 1);
    expect(await runJobs(ctx, small, 3)).toEqual(here);
  });

  it('rejects, and stops the other workers, when a job throws in a worker', async () => {
    const bad: Job[] = [
      ...small,
      { kind: 'tactical', variant: 'no-such-variant', from: 0, to: 1, seed: 1 },
    ];
    await expect(runJobs(ctx, bad, 2)).rejects.toThrow(/unknown tactic variant no-such-variant/);
    await expect(runJobs(ctx, bad, 1)).rejects.toThrow(/unknown tactic variant/);
  });
});
