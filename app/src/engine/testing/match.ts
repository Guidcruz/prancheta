/**
 * Match inputs for engine tests (T-009): a new game with the synthetic clubs, and team and match
 * inputs built from it the way `prepareRound` will (T-013): the best XI of the club's first
 * preferred formation, balanced posture and medium pressure (the AI's tactic is T-011).
 *
 * Test-only code: never imported by `index.ts`.
 */
import type { Fixture } from '../fixtures.ts';
import { newGame, type GameState } from '../game.ts';
import { bestEleven } from '../generation.ts';
import type { Lineup, Tactic } from '../lineup.ts';
import type { MatchInput, TeamInput } from '../match/types.ts';
import type { Player } from '../players.ts';
import { seedFromString } from '../rng.ts';
import type { AiProfile, ClubId, Formation } from '../types.ts';
import { syntheticClubs } from './clubs.ts';
import { fixedIdentitySource } from './identity.ts';
import { testParams } from './params.ts';

export const TEST_GAME_SEED = 20261104;

const games = new Map<number, GameState>();

/** A new game with the 20 synthetic clubs (cached by seed: tests never change it). */
export function testGame(seed = TEST_GAME_SEED): GameState {
  const cached = games.get(seed);
  if (cached !== undefined) return cached;
  const result = newGame(
    { seed, year: 2026, realism: 'full' },
    syntheticClubs(20),
    testParams(),
    fixedIdentitySource(),
  );
  if (!result.ok) throw new Error('newGame failed');
  games.set(seed, result.value);
  return result.value;
}

/** A lineup with empty bench and taker lists (the match of T-009 reads only the starters). */
export function testLineup(formation: Formation, starters: readonly string[]): Lineup {
  return { formation, starters, bench: [], captains: [], penaltyTakers: [], freeKickTakers: [] };
}

export const BALANCED: Tactic = { posture: 'balanced', pressure: 'medium' };

/** Team input from a squad: the best XI of `formation` unless `starters` is given. */
export function teamInputFrom(
  clubId: ClubId,
  squad: readonly Player[],
  options: {
    formation: Formation;
    starters?: readonly string[];
    tactic?: Tactic;
    profile?: AiProfile;
    fans?: number;
  },
): TeamInput {
  const starters =
    options.starters ?? bestEleven(squad, options.formation).map(({ player }) => player.id);
  return {
    clubId,
    controller: 'ai',
    profile: options.profile ?? 'traditional',
    fans: options.fans ?? 60,
    players: squad,
    sheet: { lineup: testLineup(options.formation, starters), tactic: options.tactic ?? BALANCED },
  };
}

/** Team input of a club of the state, in its first preferred formation. */
export function clubTeamInput(state: GameState, clubId: ClubId): TeamInput {
  const club = state.clubs[clubId]!;
  return teamInputFrom(
    clubId,
    state.squads[clubId]!.map((id) => state.players[id]!),
    { formation: club.preferredFormations[0], profile: club.profile, fans: club.fans },
  );
}

/** The seed of a fixture, as docs/02-architecture.md (4.1, `MatchInput.seed`) defines it. */
export function fixtureSeed(state: GameState, fixture: Fixture): number {
  return seedFromString(
    `${state.seed}-s${state.season}-r${fixture.round}-${fixture.homeId}-${fixture.awayId}`,
  );
}

/** Match input of a fixture of the state, with the home stadium's capacity. */
export function fixtureInput(state: GameState, fixture: Fixture): MatchInput {
  const home = state.clubs[fixture.homeId]!;
  return {
    fixtureId: fixture.id,
    seed: fixtureSeed(state, fixture),
    home: clubTeamInput(state, fixture.homeId),
    away: clubTeamInput(state, fixture.awayId),
    derby: home.def.rivals.includes(fixture.awayId),
    neutral: false,
    rules: state.rules,
    capacity: home.def.stadium.capacity,
  };
}

/** The first fixture between two rivals (synthetic clubs 01-02, 03-04... are derbies). */
export function firstDerby(state: GameState): Fixture {
  const derby = state.fixtures.find((f) => state.clubs[f.homeId]!.def.rivals.includes(f.awayId));
  if (derby === undefined) throw new Error('no derby in the calendar');
  return derby;
}
