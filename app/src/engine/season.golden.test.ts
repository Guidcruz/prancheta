import { describe, expect, it } from 'vitest';
import { seedFromString } from './rng.ts';
import { endSeason, startNextSeason } from './season.ts';
import { expectGolden } from './testing/golden.ts';
import { fixedIdentitySource } from './testing/identity.ts';
import { testParams } from './testing/params.ts';
import { playedSeason } from './testing/season.ts';

/*
 * Golden of the season turn (T-017; ADR-0007, rule 7): from the final state of the `season-full`
 * golden (the synthetic clubs, seed 20261104, 38 rounds by the AI), `endSeason` with one human
 * club and `startNextSeason`. It keeps the summary of season 1 (awards, campaign), the mean Δ of
 * the evolution by age band, the renewal of the squads (T-048: who retired, the youth of the
 * academy and the idol), the recalculated strength of the 20 clubs and a 32-bit digest
 * (FNV-1a) of the state at the start of season 2, which catches any change in any player.
 */
const params = testParams();
const SEED = 20261104;
const HUMAN = 'clube-teste-01';

/** Rounded to 4 decimals, for a readable golden (the digest keeps the full numbers). */
const round4 = (x: number) => Math.round(x * 10_000) / 10_000;

describe('golden: season turn', () => {
  it('keeps the end of season 1 and the start of season 2 stable', { timeout: 60_000 }, () => {
    const finished = playedSeason(SEED);
    const closed = endSeason(finished, params, [HUMAN], fixedIdentitySource());
    if (!closed.ok) throw new Error(`endSeason: ${closed.error}`);
    expect(closed.warnings).toEqual([]);
    const next = startNextSeason(closed.value.state, params, fixedIdentitySource());
    if (!next.ok) throw new Error(`startNextSeason: ${next.error}`);
    const state = next.value;

    const bands: Record<string, number[]> = {};
    for (const [id, before] of Object.entries(finished.players)) {
      const band =
        before.age <= 21
          ? 'a-21'
          : before.age <= 26
            ? 'b-22-26'
            : before.age <= 30
              ? 'c-27-30'
              : 'd-31';
      // The evolution is in endSeason: the retired players are still in its state, not after
      // the turn.
      (bands[band] ??= []).push(closed.value.state.players[id]!.overall - before.overall);
    }
    const evolution = Object.fromEntries(
      Object.entries(bands)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([band, d]) => [
          band,
          { n: d.length, mean: round4(d.reduce((s, x) => s + x, 0) / d.length) },
        ]),
    );

    // The minimal renewal (T-048): who retired and the youth of the academy, club by club.
    const ended = closed.value.state;
    const renewal = Object.fromEntries(
      Object.keys(finished.clubs)
        .sort()
        .flatMap((id) => {
          const left = finished.squads[id]!.filter((pid) => !ended.squads[id]!.includes(pid));
          if (left.length === 0) return [];
          const came = ended.squads[id]!.filter((pid) => !finished.squads[id]!.includes(pid));
          const idol = ended.squads[id]!.find((pid) => ended.players[pid]!.trait === 'idol');
          return [
            [
              id,
              {
                farewells: left.map((pid) => [pid, finished.players[pid]!.position]),
                academy: came.map((pid) => {
                  const p = ended.players[pid]!;
                  return [pid, p.position, p.overall, p.potential, p.shirt, p.name.display];
                }),
                idol,
              },
            ],
          ];
        }),
    );

    expectGolden('season-turn', {
      summary: closed.value.summary,
      evolution,
      renewal,
      strength: Object.fromEntries(
        Object.keys(state.clubs)
          .sort()
          .map((id) => [
            id,
            [round4(finished.clubs[id]!.strength), round4(state.clubs[id]!.strength)],
          ]),
      ),
      header: {
        season: state.season,
        year: state.year,
        round: state.round,
        phase: state.phase,
        firstDate: state.fixtures[0]!.date,
        firstRound: state.fixtures.filter((f) => f.round === 1).map((f) => f.id),
      },
      digest: seedFromString(JSON.stringify(state)).toString(16),
    });
  });
});
