import { describe, it } from 'vitest';
import { seedFromString } from '../rng.ts';
import { GOALKEEPER_SLOT } from '../strength.ts';
import { expectGolden } from '../testing/golden.ts';
import {
  clubTeamInput,
  firstDerby,
  fixtureInput,
  teamInputFrom,
  testGame,
} from '../testing/match.ts';
import { testParams } from '../testing/params.ts';
import { simulateMatch } from './simulate.ts';

/*
 * Goldens of the match (US-008, "determinismo (golden test)"; docs/03-test-plan.md): with the
 * synthetic clubs of a new game (seed 20261104) and the fixed identity source, so the name lists
 * never move them.
 * - `match-derby`: the whole result of the first derby of the calendar (events, statistics,
 *   ratings, minutes, energy, markers, attendance);
 * - `match-short-handed`: the same fixture with the home side missing its goalkeeper and a
 *   forward (an outfield player in goal, an empty slot), which pins the edge-case path;
 * - `match-round`: score, statistics and an FNV-1a digest of the events of the 20 matches of
 *   rounds 1 and 2, which catches any change in the draw order.
 * Any change in the match rules or in the order of draws changes them: bump ENGINE_VERSION.
 */
const params = testParams();
const state = testGame();
const derby = firstDerby(state);

describe('golden: simulateMatch', () => {
  it('keeps the whole result of a derby stable', () => {
    expectGolden('match-derby', simulateMatch(fixtureInput(state, derby), params));
  });

  it('keeps a short-handed match without its goalkeeper stable', () => {
    const base = fixtureInput(state, derby);
    const home = clubTeamInput(state, derby.homeId);
    const starters = home.sheet.lineup.starters.map((id, i) =>
      i === GOALKEEPER_SLOT || i === 10 ? `${home.clubId}#missing` : id,
    );
    const shortHanded = teamInputFrom(home.clubId, home.players, {
      formation: home.sheet.lineup.formation,
      starters,
      profile: home.profile,
      fans: home.fans,
    });
    expectGolden('match-short-handed', simulateMatch({ ...base, home: shortHanded }, params));
  });

  it('keeps the matches of two rounds stable', () => {
    const matches = state.fixtures
      .filter((f) => f.round <= 2)
      .map((fixture) => {
        const result = simulateMatch(fixtureInput(state, fixture), params);
        return {
          id: fixture.id,
          score: result.score,
          stats: result.stats,
          motm: result.motm ?? null,
          markers: result.markers.filter((m) => m.kind !== 'estreia').map((m) => m.kind),
          events: seedFromString(JSON.stringify(result.events)).toString(16),
        };
      });
    expectGolden('match-round', matches);
  });
});
