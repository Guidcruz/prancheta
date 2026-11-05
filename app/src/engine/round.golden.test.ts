import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './game.ts';
import { seedFromString } from './rng.ts';
import { playRound } from './round.ts';
import { getStandings, type StandingRow } from './standings.ts';
import { syntheticClubs } from './testing/clubs.ts';
import { expectGolden } from './testing/golden.ts';
import { fixedIdentitySource } from './testing/identity.ts';
import { testGame } from './testing/match.ts';
import { testParams } from './testing/params.ts';

/*
 * Goldens of the rounds (T-013; ADR-0007, rule 7) with the synthetic clubs and the fixed identity
 * source. `round-first`: the report of round 1 (scores, scorers, facts) and a 32-bit digest
 * (FNV-1a, `seedFromString`) of the state after it. `season-full`: the 38 rounds in a row, all by
 * the AI, with the final table, the facts of the last two rounds, the facts counted by kind and
 * the digest of the final state, which catches any change in any match or between rounds: since
 * T-014 that includes the morale, the form, the bench streaks and the fans thermometer.
 * `season-human-simplified` (T-015): the other path of a whole season, the simplified realism
 * with one human coach in the `result` mode and valid fan decisions every round, with a readable
 * summary of the final state (the table, the thermometer and the mean morale of each club) next
 * to the digest, so a change between rounds shows where it is.
 */
const params = testParams();
const SEED = 20261104;

function next(state: GameState) {
  const result = playRound(state, params, {
    round: state.round,
    sheets: {},
    commands: {},
    fanDecisions: {},
  });
  if (!result.ok) throw new Error(`playRound: ${result.error}`);
  return result.value;
}

const digest = (value: unknown) => seedFromString(JSON.stringify(value)).toString(16);

/** The table as compact rows: id, points, W, D, L, goals for and against, yellows, reds. */
const tableRows = (table: readonly StandingRow[]) =>
  table.map((r) => [
    r.clubId,
    r.points,
    r.wins,
    r.draws,
    r.losses,
    r.goalsFor,
    r.goalsAgainst,
    r.yellows,
    r.reds,
  ]);

/** Rounded to 4 decimals, for a readable golden (the digest keeps the full numbers). */
const round4 = (x: number) => Math.round(x * 10_000) / 10_000;

describe('golden: rounds', () => {
  it('keeps the first round stable', () => {
    const { state, report } = next(testGame(SEED));
    expectGolden('round-first', {
      results: report.results.map((r) => ({
        fixtureId: r.fixtureId,
        score: r.score,
        goals: r.events.flatMap((e) => (e.type === 'goal' ? [`${e.scorer}@${e.minute}`] : [])),
        motm: r.motm ?? null,
        attendance: r.attendance,
      })),
      facts: report.facts,
      digest: digest(state),
    });
  });

  it('keeps a whole season stable', { timeout: 60_000 }, () => {
    let state = testGame(SEED);
    const kinds: Record<string, number> = {};
    const lastFacts: unknown[] = [];
    for (let round = 1; round <= 38; round++) {
      const played = next(state);
      state = played.state;
      for (const f of played.report.facts) kinds[f.kind] = (kinds[f.kind] ?? 0) + 1;
      if (round >= 37) lastFacts.push(played.report.facts);
    }
    expect(state.round).toBe(39);
    expectGolden('season-full', {
      table: tableRows(getStandings(state)),
      kinds: Object.fromEntries(Object.entries(kinds).sort(([a], [b]) => (a < b ? -1 : 1))),
      lastFacts,
      digest: digest(state),
    });
  });

  it(
    'keeps a whole simplified season with a human coach in the result mode stable',
    {
      timeout: 60_000,
    },
    () => {
      const created = newGame(
        { seed: SEED, year: 2026, realism: 'simplified' },
        syntheticClubs(20),
        params,
        fixedIdentitySource(),
      );
      if (!created.ok) throw new Error(`newGame: ${created.error}`);
      let state = created.value;
      const human = Object.keys(state.clubs)[0]!;
      const kinds: Record<string, number> = {};
      for (let round = 1; round <= 38; round++) {
        const played = playRound(state, params, {
          round,
          sheets: {},
          commands: {},
          coaches: { [human]: 'result' },
          // Valid decisions, within and beyond the cap: from −5 to +5.
          fanDecisions: { [human]: (round % 11) - 5 },
        });
        if (!played.ok) throw new Error(`playRound ${round}: ${played.error}`);
        expect(played.warnings).toEqual([]);
        state = played.value.state;
        for (const f of played.value.report.facts) kinds[f.kind] = (kinds[f.kind] ?? 0) + 1;
      }
      expect(state.round).toBe(39);
      const clubs = Object.keys(state.clubs).sort();
      const meanMorale = (clubId: string) => {
        const squad = state.squads[clubId]!;
        return round4(squad.reduce((s, id) => s + state.players[id]!.morale, 0) / squad.length);
      };
      expectGolden('season-human-simplified', {
        human,
        table: tableRows(getStandings(state)),
        fans: Object.fromEntries(clubs.map((id) => [id, round4(state.clubs[id]!.fans)])),
        idolBenchStreak: state.clubs[human]!.idolBenchStreak,
        morale: Object.fromEntries(clubs.map((id) => [id, meanMorale(id)])),
        kinds: Object.fromEntries(Object.entries(kinds).sort(([a], [b]) => (a < b ? -1 : 1))),
        digest: digest(state),
      });
    },
  );
});
