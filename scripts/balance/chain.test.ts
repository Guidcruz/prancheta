import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { endSeason, startNextSeason } from '../../app/src/engine/index.ts';
import { balanceIdentitySource } from './identity.ts';
import {
  G4_TO,
  Z4_FROM,
  ladderCut,
  playSeason,
  runCareer,
  runSeason,
  seasonStart,
  strengthRecord,
  type CareerRecord,
  type SeasonRecord,
} from './league.ts';
import {
  CHAIN_INFO_NOTE,
  CHAIN_INFO_TARGETS,
  CHAIN_REQUIRED_SEASONS,
  buildReport,
  chainRows,
  exitCode,
  pooledRows,
  withPooledVerdict,
} from './metrics.ts';
import { loadParams, serieAClubs } from './options.ts';
import { collect, planJobs, type Job } from './run.ts';

/*
 * `/balance --chain N` (T-017; balance-targets.md, "Cadeia de temporadas"; docs/02-architecture.md,
 * 4.1): careers of N seasons turned by the engine, season 1 equal to the single-season run, the
 * league targets by season of the chain (required up to the 3rd, but for the targets of decision
 * 15), the "Virada de temporada" rows with the drift lock, the weakest and strongest clubs of season
 * 1 for the whole career, and the same output with any number of workers.
 */

const loaded = loadParams();
if (!loaded.ok) throw new Error(loaded.error);
const ctx = { params: loaded.params, clubs: serieAClubs(), seed: 1 };

describe('planJobs with --chain', () => {
  it('makes one job per career and keeps the robot and the duels single-season', () => {
    const jobs = planJobs({ seasons: 2, duels: 0, robot: 'coritibom', seed: 1, chain: 3 });
    expect(jobs).toEqual([
      { kind: 'season', index: 1, chain: 3, seed: 1 },
      { kind: 'season', index: 2, chain: 3, seed: 1 },
      { kind: 'season', index: 1, robot: 'coritibom', seed: 1 },
      { kind: 'season', index: 2, robot: 'coritibom', seed: 1 },
    ]);
    expect(planJobs({ seasons: 2, duels: 0, seed: 1, chain: 1 })).toEqual(
      planJobs({ seasons: 2, duels: 0, seed: 1 }),
    );
  });
});

describe('runCareer', { timeout: 120_000 }, () => {
  let career: CareerRecord;
  beforeAll(() => {
    career = runCareer(ctx, 1, 3);
  }, 120_000);

  it('plays season 1 exactly as the single-season run, then two turned seasons', () => {
    expect(career.index).toBe(1);
    expect(career.seasons.map((s) => s.season)).toEqual([1, 2, 3]);
    const first: Partial<SeasonRecord> = { ...career.seasons[0]! };
    delete first.season;
    delete first.strength;
    expect(first).toEqual(runSeason(ctx, 1));
    expect(career.seasons[0]!.strength).toEqual(strengthRecord(seasonStart(ctx, 1)));
    // The turn recalculates the strength from the evolved squads: it moves.
    expect(career.seasons[1]!.strength!.mean).not.toBe(career.seasons[0]!.strength!.mean);
    for (const s of career.seasons) {
      expect(s.matches.matches).toBe(380);
      expect(s.strength!.sd).toBeGreaterThan(0);
    }
  });

  it('cuts every season by the weakest and strongest clubs of season 1 (decision 15)', () => {
    const start = seasonStart(ctx, 1);
    const cut = ladderCut(start);
    // Season 2 of this career, turned by the engine, has another ladder than season 1.
    const closed = endSeason(playSeason(ctx, start, 1).state, ctx.params, []);
    if (!closed.ok) throw new Error(closed.error);
    const next = startNextSeason(closed.value.state, ctx.params, balanceIdentitySource());
    if (!next.ok) throw new Error(next.error);
    expect(ladderCut(next.value).strongest).not.toEqual(cut.strongest);
    expect(career.seasons[1]!.strength).toEqual(strengthRecord(next.value, cut));
    expect(career.seasons[1]!.strength).not.toEqual(strengthRecord(next.value));
    for (const s of career.seasons) {
      const position = (id: string) => s.positions[id]!;
      expect(s.table.weakInG4, `season ${s.season}`).toBe(
        cut.weakest.some((id) => position(id) <= G4_TO),
      );
      expect(s.table.strongChampion, `season ${s.season}`).toBe(
        cut.strongest.includes(s.table.champion),
      );
      expect(s.table.strongRelegated, `season ${s.season}`).toBe(
        cut.strongest.some((id) => position(id) >= Z4_FROM),
      );
    }
  });

  it('collects the seasons of the careers by season of the chain, in job order', () => {
    const jobs: Job[] = [{ kind: 'season', index: 1, chain: 3, seed: 1 }];
    const results = collect(jobs, [career]);
    expect(results.seasons).toEqual([career.seasons[0]]);
    expect(results.chain).toEqual(career.seasons.map((s) => [s]));
    const rows = buildReport(results).rows;
    expect(rows.filter((r) => r.id.startsWith('turn-')).map((r) => r.id)).toEqual(
      [1, 2, 3].flatMap((k) =>
        ['strengthMean', 'strengthSd', 'strengthRange', 'sizeGap', 'ladderGap'].map(
          (m) => `turn-s${k}-${m}`,
        ),
      ),
    );
    for (const id of ['goals', 'draws', 'champion', 'seventeenth', 'fansMean']) {
      expect(rows.find((r) => r.id === `chain-s2-${id}`)?.required, id).toBe(true);
      expect(rows.find((r) => r.id === `chain-s3-${id}`)?.status, id).toMatch(/dentro|fora/);
    }
    // No duel, robot or future row in the chain seasons.
    expect(rows.some((r) => /^chain-s\d+-(strong20|tactic-|robot|future-)/.test(r.id))).toBe(false);
  });
});

/** A record of season `season` whose clubs start with the given strength numbers. */
function withStrength(
  record: SeasonRecord,
  season: number,
  mean: number,
  sd: number,
  range = 17,
  gaps = { sizeGap: 2, ladderGap: 12 },
) {
  return { ...record, season, strength: { mean, sd, range, ...gaps } };
}

describe('chainRows', () => {
  let base: SeasonRecord;
  beforeAll(() => {
    base = runSeason(ctx, 1);
  }, 60_000);

  it('judges the mean strength against season 1, and the deviation and the gap every season', () => {
    const chain = [
      [withStrength(base, 1, 70, 4.8)],
      [withStrength(base, 2, 70.9, 5.6)],
      [withStrength(base, 3, 71.2, 4.9, 21)],
      [withStrength(base, 4, 75, 2)],
    ];
    const rows = chainRows({ chain });
    const get = (id: string) => rows.find((r) => r.id === id)!;
    expect(get('turn-s1-strengthMean')).toMatchObject({ status: 'dentro', required: false });
    expect(get('turn-s2-strengthMean')).toMatchObject({ status: 'dentro', required: true });
    expect(get('turn-s2-strengthSd')).toMatchObject({ status: 'fora', required: true });
    expect(get('turn-s3-strengthMean')).toMatchObject({ status: 'fora', required: true });
    expect(get('turn-s3-strengthRange')).toMatchObject({ status: 'fora', required: true });
    // From the 4th season on: informative, never the exit code.
    expect(CHAIN_REQUIRED_SEASONS).toBe(3);
    for (const r of rows.filter((x) => /-s4-/.test(x.id))) expect(r.required, r.id).toBe(false);
    expect(get('turn-s4-strengthMean').status).toBe('fora');
    expect(exitCode({ rows: rows.filter((r) => /-s4-/.test(r.id)) })).toBe(0);
    expect(exitCode({ rows })).toBe(1);
    expect(chainRows({ chain: [chain[0]!] })).toEqual([]);
    expect(chainRows({})).toEqual([]);
  });

  it('fails the drift lock when a gap moves more than 0.5 from season 1 (decision 15)', () => {
    const at = (season: number, sizeGap: number, ladderGap: number) => [
      withStrength(base, season, 70, 4.8, 17, { sizeGap, ladderGap }),
    ];
    const chain = [at(1, 2, 12), at(2, 2.4, 11.55), at(3, 2.51, 11.4), at(4, 4, 15)];
    const rows = chainRows({ chain });
    const get = (id: string) => rows.find((r) => r.id === id)!;
    expect(get('turn-s1-sizeGap')).toMatchObject({ value: 2, status: 'dentro', required: false });
    expect(get('turn-s1-ladderGap')).toMatchObject({ value: 12, required: false });
    expect(get('turn-s2-sizeGap')).toMatchObject({ status: 'dentro', required: true });
    expect(get('turn-s2-sizeGap').value).toBeCloseTo(0.4, 10);
    expect(get('turn-s2-ladderGap')).toMatchObject({ status: 'dentro', required: true });
    expect(get('turn-s2-ladderGap').value).toBeCloseTo(-0.45, 10);
    // An artificial drift above 0.5: out, and the run fails.
    expect(get('turn-s3-sizeGap')).toMatchObject({ status: 'fora', required: true });
    expect(get('turn-s3-sizeGap').value).toBeCloseTo(0.51, 10);
    expect(get('turn-s3-ladderGap')).toMatchObject({ status: 'fora', required: true });
    expect(get('turn-s3-ladderGap').shown).toBe('-0,60 (11,40)');
    expect(exitCode({ rows: rows.filter((r) => /^turn-s3-(size|ladder)Gap$/.test(r.id)) })).toBe(1);
    expect(exitCode({ rows: rows.filter((r) => /^turn-s2-/.test(r.id)) })).toBe(0);
    // From the 4th season on the lock is informative too.
    expect(get('turn-s4-sizeGap')).toMatchObject({ status: 'fora', required: false });
  });

  it('makes the big and small champions and the weak club in the G4 informative in seasons 2 and 3', () => {
    const chain = [1, 2, 3, 4].map((k) => [withStrength(base, k, 70, 4.8)]);
    const rows = chainRows({ chain });
    const get = (id: string) => rows.find((r) => r.id === id)!;
    expect(CHAIN_INFO_TARGETS).toEqual(['bigChampion', 'smallChampion', 'weakInG4']);
    for (const k of [2, 3]) {
      for (const id of CHAIN_INFO_TARGETS) {
        expect(get(`chain-s${k}-${id}`), `${k} ${id}`).toMatchObject({
          required: false,
          note: CHAIN_INFO_NOTE,
        });
      }
      // The other targets of the same season still count.
      for (const id of ['champion', 'z4Escape']) {
        expect(get(`chain-s${k}-${id}`).required, `${k} ${id}`).toBe(true);
      }
    }
    expect(CHAIN_INFO_NOTE).toContain('decisões 15 e 17 do CEO');
    expect(CHAIN_INFO_NOTE).toContain('2026-11-06');
    // From the 4th season on everything is informative, without the note.
    expect(get('chain-s4-bigChampion').required).toBe(false);
    expect(get('chain-s4-bigChampion').note).toBeUndefined();
    // Season 1 (the main block) keeps all three required.
    const main = buildReport({
      seasons: [base],
      chain,
      robotSeasons: [],
      calibrated: new Map(),
      tactical: new Map(),
    }).rows;
    for (const id of CHAIN_INFO_TARGETS) {
      expect(
        main.find((r) => r.id === id),
        id,
      ).toMatchObject({ required: true });
      expect(main.find((r) => r.id === id)!.note).toBeUndefined();
    }
    // In the total of the seeds the weak club in the G4 of seasons 2 and 3 does not count either (nor the small champion).
    const run = {
      seasons: [base],
      chain,
      robotSeasons: [],
      calibrated: new Map(),
      tactical: new Map(),
    };
    const pooled = pooledRows([run, run]);
    expect(pooled.find((r) => r.id === 'weakInG4')!.required).toBe(true);
    expect(pooled.find((r) => r.id === 'smallChampion')!.required).toBe(true);
    for (const k of [2, 3]) {
      expect(pooled.find((r) => r.id === `chain-s${k}-weakInG4`)!.required).toBe(false);
      expect(pooled.find((r) => r.id === `chain-s${k}-smallChampion`)!.required).toBe(false);
    }
    // In each seed they read as informative, not "veredito no total"; the other rare ones still do.
    const seed = withPooledVerdict({ ...buildReport(run), rows: [...main] });
    for (const k of [2, 3]) {
      const weak = seed.rows.find((r) => r.id === `chain-s${k}-weakInG4`)!;
      expect(weak.required).toBe(false);
      expect(weak.verdict).toBeUndefined();
      expect(seed.rows.find((r) => r.id === `chain-s${k}-smallChampion`)!.verdict).toBeUndefined();
    }
    expect(seed.rows.find((r) => r.id === 'weakInG4')!.verdict).toBe('pooled');
    for (const k of [2, 3]) {
      expect(seed.rows.find((r) => r.id === `chain-s${k}-z4EscapeGap`)).toMatchObject({
        required: false,
        verdict: 'pooled',
      });
    }
  });

  it('pools the rare targets of every season of the chain over the seeds', () => {
    const run = (season: number) => ({
      seasons: [base],
      chain: [[withStrength(base, 1, 70, 4.8)], [withStrength(base, season, 70.5, 4.8)]],
      robotSeasons: [],
      calibrated: new Map(),
      tactical: new Map(),
    });
    const ids = pooledRows([run(2), run(2)]).map((r) => r.id);
    expect(ids).toEqual([
      'smallChampion',
      'weakInG4',
      'z4EscapeGap',
      'chain-s2-smallChampion',
      'chain-s2-weakInG4',
      'chain-s2-z4EscapeGap',
    ]);
  });
});

describe('npm run balance -- --chain', { timeout: 120_000 }, () => {
  const script = fileURLToPath(new URL('../balance.ts', import.meta.url));
  const run = (args: readonly string[]) => {
    const out = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    return { status: out.status, stdout: out.stdout, stderr: out.stderr };
  };
  const small = ['--seasons', '2', '--duels', '0', '--robot', 'none', '--chain', '2'];

  it('prints a block per season of the chain, the same with any number of workers', () => {
    const one = run([...small, '--json', '--workers', '1']);
    expect(run([...small, '--json', '--workers', '2']).stdout).toBe(one.stdout);
    const parsed = JSON.parse(one.stdout) as {
      run: { chain: number };
      exitCode: number;
      chain: { turn: { id: string }[]; seasons: { season: number; required: boolean }[] };
    };
    expect(parsed.run.chain).toBe(2);
    expect(parsed.chain.seasons.map((s) => [s.season, s.required])).toEqual([[2, true]]);
    expect(parsed.chain.turn.map((r) => r.id)).toContain('turn-s2-strengthMean');
    expect(one.status).toBe(parsed.exitCode);
    const text = run([...small, '--workers', '2']).stdout;
    expect(text).toContain('Temporada 2 da cadeia');
    expect(text).toContain('Virada de temporada');
  });

  it('gives with --chain 1 byte for byte the output without --chain', () => {
    const plain = ['--seasons', '1', '--duels', '0', '--robot', 'none', '--workers', '1'];
    for (const format of [[], ['--json']]) {
      const without = run([...plain, ...format]);
      expect(without.status, format.join()).not.toBe(3);
      expect(run([...plain, ...format, '--chain', '1']).stdout).toBe(without.stdout);
    }
  });

  it('refuses a chain outside 1 to 30 with the usage exit code', () => {
    expect(run(['--chain', '0']).status).toBe(2);
    expect(run(['--chain', '31']).status).toBe(2);
  });
});
