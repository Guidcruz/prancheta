import { describe, it } from 'vitest';
import { seedFromString } from '../rng.ts';
import { GOALKEEPER_SLOT } from '../strength.ts';
import { expectGolden } from '../testing/golden.ts';
import {
  aiFixtureInput,
  aiTeamInput,
  clubTeamInput,
  firstDerby,
  fixtureInput,
  teamInputFrom,
  testGame,
} from '../testing/match.ts';
import { testParams } from '../testing/params.ts';
import { simulateMatch } from './simulate.ts';
import type { MatchCommand } from './types.ts';

/*
 * Goldens of the match (US-008, "determinismo (golden test)"; docs/03-test-plan.md): with the
 * synthetic clubs of a new game (seed 20261104) and the fixed identity source, so the name lists
 * never move them.
 * - `match-derby`: the whole result of the first derby of the calendar (events, statistics,
 *   ratings, minutes, energy, markers, attendance);
 * - `match-short-handed`: the same fixture with the home side missing its goalkeeper and a
 *   forward (an outfield player in goal, an empty slot), which pins the edge-case path;
 * - `match-round`: score, statistics and an FNV-1a digest of the events of the 20 matches of
 *   rounds 1 and 2, which catches any change in the draw order;
 * - `match-ai-sheets` (T-012): the derby with the AI's sheets on both sides (bench of 7), so the
 *   in-match AI substitutes and changes tactics, plus the digests of rounds 1 and 2 that way;
 * - `match-commands` (T-012): the derby with the coach on the home side and a list of commands
 *   (substitution, formation, shortcut, half-time talk, one invalid).
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

  it('keeps the matches with the AI sheets and the in-match AI stable', () => {
    const rounds = state.fixtures
      .filter((f) => f.round <= 2)
      .map((fixture) => {
        const result = simulateMatch(aiFixtureInput(state, fixture), params);
        return {
          id: fixture.id,
          score: result.score,
          subs: result.events.filter((e) => e.type === 'substitution').length,
          events: seedFromString(JSON.stringify(result.events)).toString(16),
        };
      });
    expectGolden('match-ai-sheets', {
      derby: simulateMatch(aiFixtureInput(state, derby), params),
      rounds,
    });
  });

  it("keeps a match with the coach's commands stable", () => {
    const base = aiFixtureInput(state, derby);
    const home = aiTeamInput(state, derby, derby.homeId, 'human');
    const { starters, bench } = home.sheet.lineup;
    const commands: MatchCommand[] = [
      { minute: 25, side: 'home', kind: 'tactic', pressure: 'high' },
      { minute: 45, side: 'home', kind: 'halftimeTalk', talk: 'motivate' },
      { minute: 58, side: 'home', kind: 'substitution', out: starters[7]!, in: bench[4]! },
      { minute: 64, side: 'home', kind: 'tactic', formation: '3-5-2', posture: 'attacking' },
      { minute: 77, side: 'home', kind: 'preset', preset: 'holdResult' },
      { minute: 80, side: 'home', kind: 'substitution', out: starters[10]!, in: bench[4]! },
    ];
    expectGolden('match-commands', simulateMatch({ ...base, home }, params, commands));
  });
});
