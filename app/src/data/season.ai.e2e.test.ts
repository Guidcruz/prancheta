import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getStandings, newGame, playRound, prepareRound, validateLineup } from '../engine/index.ts';
import type { ClubDef, GameState, PlayerId } from '../engine/index.ts';
import { fixedIdentitySource } from '../engine/testing/identity.ts';
import { testParams } from '../engine/testing/params.ts';

/*
 * T-011/T-012/T-013 acceptance, end to end: chained seasons with the 20 real clubs, the 38 rounds
 * through `playRound` (T-013), which applies condition, injuries, suspensions and yellow counts
 * between rounds (before T-013 this test did it by hand). Before each round, every sheet of
 * `prepareRound` goes through validateLineup and is checked for injured, suspended or foreign
 * players. Morale between rounds (except the "Cobrar"), form, benchStreak and the fans are T-014.
 */
const clubs = JSON.parse(
  readFileSync(new URL('./clubs.serie-a.json', import.meta.url), 'utf8'),
) as ClubDef[];
const params = testParams();
const ROTATION = params.ai.rotationCondition;

function run(seed: number) {
  const created = newGame(
    { seed, year: 2026, realism: 'full' },
    clubs,
    params,
    fixedIdentitySource(),
  );
  if (!created.ok) throw new Error('newGame failed');
  let state: GameState = created.value;
  const problems: string[] = [];
  let rotations = 0;
  let sheets = 0;
  let tiredStarters = 0;
  let outRounds = 0;
  let outSuspended = 0;
  let goals = 0;
  let highPressure = 0;
  /** Substitutions of the in-match AI (T-012), by reason. */
  const subs: Record<string, number> = { injury: 0, fatigue: 0, tactical: 0 };
  const lastXi = new Map<string, Set<PlayerId>>();

  for (let round = 1; round <= 38; round++) {
    const plan = prepareRound(state, params);
    if (!plan.ok) throw new Error(`prepareRound ${round}: ${plan.error}`);
    for (const match of plan.value.matches) {
      for (const team of [match.home, match.away]) {
        const { clubId: id, sheet } = team;
        const where = `seed ${seed} r${round} ${id}`;
        if (!validateLineup(state, id, sheet).ok) problems.push(`${where}: invalid sheet`);
        const xi = sheet.lineup.starters.map((p) => state.players[p]!);
        sheets++;
        if (sheet.tactic.pressure === 'high') highPressure++;
        if (xi.length !== 11) problems.push(`${where}: ${xi.length} starters`);
        for (const p of [...xi, ...sheet.lineup.bench.map((b) => state.players[b]!)]) {
          if (p.injuryRounds > 0) problems.push(`${where}: injured ${p.id}`);
          if (p.suspendedGames > 0) problems.push(`${where}: suspended ${p.id}`);
          if (p.clubId !== id) problems.push(`${where}: foreign ${p.id}`);
        }
        for (const p of xi) if (p.condition < ROTATION) tiredStarters++;
        const prev = lastXi.get(id);
        if (prev !== undefined) {
          for (const pid of prev) {
            const p = state.players[pid]!;
            if (
              p.condition < ROTATION &&
              p.injuryRounds === 0 &&
              p.suspendedGames === 0 &&
              !sheet.lineup.starters.includes(pid)
            )
              rotations++;
          }
        }
        lastXi.set(id, new Set(sheet.lineup.starters));
      }
    }
    for (const p of Object.values(state.players)) {
      if (p.injuryRounds > 0 || p.suspendedGames > 0) outRounds++;
      if (p.suspendedGames > 0) outSuspended++;
    }

    const played = playRound(state, params, { round, sheets: {}, commands: {}, fanDecisions: {} });
    if (!played.ok) throw new Error(`playRound ${round}: ${played.error}`);
    for (const result of played.value.report.results) {
      goals += result.score[0] + result.score[1];
      for (const e of result.events) if (e.type === 'substitution') subs[e.reason]! += 1;
    }
    // playRound plays exactly the plan it prepares.
    for (const match of plan.value.matches) {
      for (const team of [match.home, match.away]) {
        const used = played.value.state.lastSheets[team.clubId];
        if (JSON.stringify(used) !== JSON.stringify(team.sheet)) {
          problems.push(`seed ${seed} r${round}: sheet of ${team.clubId} changed`);
        }
      }
    }
    state = played.value.state;
  }
  for (const row of getStandings(state)) {
    if (row.played !== 38) problems.push(`seed ${seed}: ${row.clubId} played ${row.played}`);
  }
  if (state.round !== 39) problems.push(`seed ${seed}: round ${state.round} at the end`);
  const table = getStandings(state);
  return {
    problems,
    rotations,
    sheets,
    tiredStarters,
    outRounds,
    outSuspended,
    subs,
    goals,
    highPressure,
    champion: table[0]!.points,
    seventeenth: table[16]!.points,
  };
}

describe('T-011/T-013 acceptance: chained season with the 20 real clubs, through playRound', () => {
  it(
    'never fields an injured or suspended player, every sheet validates, and rotation happens',
    { timeout: 120_000 },
    () => {
      let rot = 0;
      let out = 0;
      let sus = 0;
      let sheets = 0;
      let tired = 0;
      let goals = 0;
      let high = 0;
      const tables: string[] = [];
      const subs: Record<string, number> = { injury: 0, fatigue: 0, tactical: 0 };
      for (const seed of [1, 2, 3]) {
        const r = run(seed);
        expect(r.problems).toEqual([]);
        rot += r.rotations;
        out += r.outRounds;
        sus += r.outSuspended;
        sheets += r.sheets;
        tired += r.tiredStarters;
        goals += r.goals;
        high += r.highPressure;
        tables.push(`seed ${seed}: champion ${r.champion}, 17th ${r.seventeenth}`);
        for (const [reason, n] of Object.entries(r.subs)) subs[reason]! += n;
      }
      const teams = 3 * 380 * 2;
      const perTeam = (n: number) => (n / teams).toFixed(2);
      const all = subs.injury! + subs.fatigue! + subs.tactical!;
      console.info(
        `[T-011 e2e] sheets ${sheets}; player-rounds out ${out} (suspended ${sus}); rotations of tired starters ${rot}; starters below ${ROTATION}: ${tired}; high pressure ${((100 * high) / sheets).toFixed(1)}%\n` +
          `[T-012 e2e] substitutions per team ${perTeam(all)} (ia-clubes.md: 3 to 4 per team): injury ${perTeam(subs.injury!)}, fatigue ${perTeam(subs.fatigue!)}, tactical ${perTeam(subs.tactical!)}\n` +
          `[T-013 e2e] goals per match ${(goals / (3 * 380)).toFixed(3)}; ${tables.join('; ')}`,
      );
      expect(sheets).toBe(3 * 380 * 2);
      expect(out).toBeGreaterThan(0);
      expect(sus).toBeGreaterThan(0);
      expect(rot).toBeGreaterThan(0);
    },
  );
});
