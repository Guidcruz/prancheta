import { describe, it } from 'vitest';
import { newGame } from './game.ts';
import { bestEleven } from './generation.ts';
import { homeAdvantage, sectorStrengths, teamStrength } from './strength.ts';
import { syntheticClubs } from './testing/clubs.ts';
import { expectGolden } from './testing/golden.ts';
import { fixedIdentitySource } from './testing/identity.ts';
import { testParams } from './testing/params.ts';

/*
 * Golden of the sector strengths (T-008) of a new game with a fixed seed: for each of the 20
 * synthetic clubs, the best XI of its preferred formation, its displayed strength, and its
 * strengths away (T = 1) and at home with its starting thermometer, in balanced posture and
 * medium pressure; and the home advantage of every derby of the season (with the derby bonus).
 * If the formulas or tables of strength.ts change, this golden changes (and ENGINE_VERSION must
 * go up).
 */
describe('golden: sector strengths of a new game', () => {
  it('keeps the strengths stable', () => {
    const params = testParams();
    const result = newGame(
      { seed: 20261104, year: 2026, realism: 'full' },
      syntheticClubs(20),
      params,
      fixedIdentitySource(),
    );
    if (!result.ok) throw new Error('newGame failed');
    const state = result.value;
    const tactic = { posture: 'balanced', pressure: 'medium' } as const;

    const clubs = Object.values(state.clubs).map((club) => {
      const squad = state.squads[club.def.id]!.map((id) => state.players[id]!);
      const formation = club.preferredFormations[0];
      const starters = bestEleven(squad, formation).map(({ player }) => player.id);
      const sheet = { lineup: { formation, starters }, tactic };
      const away = sectorStrengths(squad, sheet, { home: 0 }, params);
      const home = sectorStrengths(
        squad,
        sheet,
        { home: homeAdvantage({ fans: club.fans, derby: false }, params) },
        params,
      );
      if (!away.ok || !home.ok) throw new Error(`sectorStrengths failed for ${club.def.id}`);
      return {
        id: club.def.id,
        formation,
        starters,
        displayed: teamStrength(state, club.def.id),
        away: away.value,
        home: home.value,
      };
    });

    const derbies = state.fixtures
      .filter((f) => state.clubs[f.homeId]!.def.rivals.includes(f.awayId))
      .map((f) => ({
        id: f.id,
        home: homeAdvantage({ fans: state.clubs[f.homeId]!.fans, derby: true }, params),
      }));

    expectGolden('strengths', { clubs, derbies });
  });
});
