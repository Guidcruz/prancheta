import { seedFromString } from '../rng.ts';
import { GOALKEEPER_SLOT } from '../strength.ts';
import { simulateMatch } from '../match/simulate.ts';
import type { MatchCommand } from '../match/types.ts';
import {
  aiFixtureInput,
  aiTeamInput,
  clubTeamInput,
  firstDerby,
  fixtureInput,
  teamInputFrom,
  testGame,
} from './match.ts';
import { testParams } from './params.ts';

/*
 * The inputs of the match goldens (docs/03-test-plan.md): one place for the Vitest golden
 * (match/simulate.golden.test.ts) and for the browser page (tests/e2e/golden/page.ts, Chromium and
 * WebKit), so the two never drift apart. No node:fs or vitest here: it is bundled for the browser.
 * With the synthetic clubs of a new game (seed 20261104) and the fixed identity source.
 * - `match-derby`: the whole result of the first derby of the calendar;
 * - `match-short-handed`: the same fixture with the home side missing its goalkeeper and a forward;
 * - `match-round`: score, statistics and an FNV-1a digest of the events of rounds 1 and 2;
 * - `match-ai-sheets`: the derby with the AI's sheets on both sides, plus the digests of rounds 1-2;
 * - `match-commands`: the derby with the coach on the home side and a list of commands.
 */
export function matchGoldenCases(): Record<string, () => unknown> {
  const params = testParams();
  const state = testGame();
  const derby = firstDerby(state);
  const twoRounds = state.fixtures.filter((f) => f.round <= 2);

  return {
    'match-derby': () => simulateMatch(fixtureInput(state, derby), params),
    'match-short-handed': () => {
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
      return simulateMatch({ ...base, home: shortHanded }, params);
    },
    'match-round': () =>
      twoRounds.map((fixture) => {
        const result = simulateMatch(fixtureInput(state, fixture), params);
        return {
          id: fixture.id,
          score: result.score,
          stats: result.stats,
          motm: result.motm ?? null,
          markers: result.markers.filter((m) => m.kind !== 'estreia').map((m) => m.kind),
          events: seedFromString(JSON.stringify(result.events)).toString(16),
        };
      }),
    'match-ai-sheets': () => ({
      derby: simulateMatch(aiFixtureInput(state, derby), params),
      rounds: twoRounds.map((fixture) => {
        const result = simulateMatch(aiFixtureInput(state, fixture), params);
        return {
          id: fixture.id,
          score: result.score,
          subs: result.events.filter((e) => e.type === 'substitution').length,
          events: seedFromString(JSON.stringify(result.events)).toString(16),
        };
      }),
    }),
    'match-commands': () => {
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
      return simulateMatch({ ...base, home }, params, commands);
    },
  };
}
