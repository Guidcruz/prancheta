import { describe, expect, it } from 'vitest';
import type { GameState } from './game.ts';
import { seedFromString } from './rng.ts';
import { playRound } from './round.ts';
import { getStandings } from './standings.ts';
import { expectGolden } from './testing/golden.ts';
import { testGame } from './testing/match.ts';
import { testParams } from './testing/params.ts';

/*
 * Goldens of the rounds (T-013; ADR-0007, rule 7) with the synthetic clubs and the fixed identity
 * source. `round-first`: the report of round 1 (scores, scorers, facts) and a 32-bit digest
 * (FNV-1a, `seedFromString`) of the state after it. `season-full`: the 38 rounds in a row, all by
 * the AI, with the final table, the facts of the last two rounds, the facts counted by kind and
 * the digest of the final state, which catches any change in any match or between rounds: since
 * T-014 that includes the morale, the form, the bench streaks and the fans thermometer. The
 * T-015 golden records the whole season of T-014 in detail.
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
      table: getStandings(state).map((r) => [
        r.clubId,
        r.points,
        r.wins,
        r.draws,
        r.losses,
        r.goalsFor,
        r.goalsAgainst,
        r.yellows,
        r.reds,
      ]),
      kinds: Object.fromEntries(Object.entries(kinds).sort(([a], [b]) => (a < b ? -1 : 1))),
      lastFacts,
      digest: digest(state),
    });
  });
});
