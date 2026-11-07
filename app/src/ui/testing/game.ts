import { newGame, playRound, type ClubId, type GameState, type Player } from '@engine';
import { gameIdentitySource } from '@lib/generators/identity';
import { loadGameParams } from '@lib/params';
import { latestClubSet } from '../../data/club-sets.ts';

/*
 * Real careers for the screen tests of T-028 (clube.md, elenco.md, jogador.md): a new game of the
 * latest club set with the game's params and names, played round by round by the engine, as the
 * CareerService does with the coach on "só resultado". Built once per setup and kept, so every
 * test of a file reads the same state; tests change copies, never these.
 */

export const TEST_CLUB: ClubId = latestClubSet()!.clubs[0]!.id;

const params = loadGameParams();
const cache = new Map<string, GameState>();

/** A career of `TEST_CLUB` whose next round is `round` (1 = pre-season, 39 = season over). */
export function testCareer(
  realism: 'full' | 'simplified' = 'full',
  round = 1,
  seed = 2026,
): GameState {
  const key = `${realism}-${round}-${seed}`;
  const kept = cache.get(key);
  if (kept !== undefined) return kept;
  const set = latestClubSet()!;
  const created = newGame(
    { seed, year: set.baseSeason, realism },
    set.clubs,
    params,
    gameIdentitySource(),
  );
  if (!created.ok) throw new Error(`newGame failed: ${created.error}`);
  let game = created.value;
  while (game.round < round) {
    const played = playRound(game, params, {
      round: game.round,
      sheets: {},
      commands: {},
      fanDecisions: {},
      coaches: { [TEST_CLUB]: 'result' },
    });
    if (!played.ok) throw new Error(`playRound failed: ${played.error}`);
    game = played.value.state;
  }
  cache.set(key, game);
  return game;
}

/** A copy of `game` with some fields of one player changed (the state itself is never touched). */
export function withPlayer(game: GameState, id: string, change: Partial<Player>): GameState {
  return { ...game, players: { ...game.players, [id]: { ...game.players[id]!, ...change } } };
}

/** A copy of `game` with the thermometer of `clubId` at `fans`. */
export function withFans(game: GameState, clubId: ClubId, fans: number): GameState {
  return {
    ...game,
    clubs: { ...game.clubs, [clubId]: { ...game.clubs[clubId]!, fans } },
  };
}
