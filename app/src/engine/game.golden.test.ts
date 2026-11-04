import { describe, it } from 'vitest';
import { newGame } from './game.ts';
import { seedFromString } from './rng.ts';
import { syntheticClubs } from './testing/clubs.ts';
import { expectGolden } from './testing/golden.ts';
import { fixedIdentitySource } from './testing/identity.ts';
import { testParams } from './testing/params.ts';

/*
 * Golden of `newGame` (T-006) with the synthetic clubs and the fixed identity source of the
 * engine, so the name lists never move it (ADR-0012). Kept small: per club the profile, the
 * formations and the strength; the full squads of two clubs (one in 4-4-2 or 3-5-2, one in
 * 4-3-3 or 3-4-3); the calendar (the 38 dates, rounds 1 and 20); and a 32-bit digest (FNV-1a) of the
 * whole state as JSON, which catches any change in the other 475 players.
 */
describe('golden: newGame', () => {
  it('keeps the initial state stable', () => {
    const clubs = syntheticClubs(20);
    clubs[19]!.aiProfile = 'chaotic';
    delete clubs[18]!.aiProfile;
    clubs[2]!.aiProfile = 'academy'; // 4-3-3 or 3-4-3: a second detailed squad, other slots
    const result = newGame(
      { seed: 20261104, year: 2026, realism: 'full' },
      clubs,
      testParams(),
      fixedIdentitySource(),
    );
    if (!result.ok) throw new Error('newGame failed');
    const state = result.value;
    const { clubs: clubStates, players, squads, fixtures, ...header } = state;
    expectGolden('new-game', {
      header,
      warnings: result.warnings,
      clubs: Object.values(clubStates).map((c) => ({
        id: c.def.id,
        profile: c.profile,
        strength: c.strength,
        preferredFormations: c.preferredFormations,
        fans: c.fans,
      })),
      squad: squads['clube-teste-01']!.map((id) => players[id]),
      academySquad: {
        formation: clubStates['clube-teste-03']!.preferredFormations[0],
        players: squads['clube-teste-03']!.map((id) => players[id]),
      },
      fixtures: {
        count: fixtures.length,
        dates: [...new Set(fixtures.map((f) => f.date))],
        firstRound: fixtures.filter((f) => f.round === 1).map((f) => f.id),
        returnRound: fixtures.filter((f) => f.round === 20).map((f) => f.id),
      },
      digest: seedFromString(JSON.stringify(state)).toString(16),
    });
  });
});
