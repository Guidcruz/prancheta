import { seedFromString } from '../../../app/src/engine/rng.ts';
import { GOALKEEPER_SLOT } from '../../../app/src/engine/strength.ts';
import { simulateMatch } from '../../../app/src/engine/match/simulate.ts';
import type { MatchCommand } from '../../../app/src/engine/match/types.ts';
import {
  aiFixtureInput,
  aiTeamInput,
  clubTeamInput,
  firstDerby,
  fixtureInput,
  teamInputFrom,
  testGame,
} from '../../../app/src/engine/testing/match.ts';
import { testParams } from '../../../app/src/engine/testing/params.ts';

/*
 * Página do golden da partida no navegador (T-024; docs/03-test-plan.md, 4 e risco do `Math.exp`).
 * Refaz, dentro do Chromium e do WebKit, as entradas de app/src/engine/match/simulate.golden.test.ts
 * e devolve as saídas para o spec comparar com os arquivos versionados em __golden__/. Se um
 * golden daquele teste mudar de entrada, mude aqui também. Empacotada pelo Vite no spec.
 */
const params = testParams();
const state = testGame();
const derby = firstDerby(state);

const roundOne = (build: typeof fixtureInput) =>
  state.fixtures
    .filter((f) => f.round <= 2)
    .map((fixture) => {
      const result = simulateMatch(build(state, fixture), params);
      return { fixture, result };
    });

const goldens: Record<string, () => unknown> = {
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
    roundOne(fixtureInput).map(({ fixture, result }) => ({
      id: fixture.id,
      score: result.score,
      stats: result.stats,
      motm: result.motm ?? null,
      markers: result.markers.filter((m) => m.kind !== 'estreia').map((m) => m.kind),
      events: seedFromString(JSON.stringify(result.events)).toString(16),
    })),
  'match-ai-sheets': () => ({
    derby: simulateMatch(aiFixtureInput(state, derby), params),
    rounds: roundOne(aiFixtureInput).map(({ fixture, result }) => ({
      id: fixture.id,
      score: result.score,
      subs: result.events.filter((e) => e.type === 'substitution').length,
      events: seedFromString(JSON.stringify(result.events)).toString(16),
    })),
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

/** O JSON de cada golden, como o utilitário de golden o serializa. */
(globalThis as { runGoldens?: () => Record<string, string> }).runGoldens = () =>
  Object.fromEntries(Object.entries(goldens).map(([name, run]) => [name, JSON.stringify(run())]));
