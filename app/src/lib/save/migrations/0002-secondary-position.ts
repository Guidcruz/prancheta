import { POSITIONS, secondaryPositionFor, type Position } from '../../../engine/index.ts';
import type { Migration } from './index.ts';

/*
 * v2 → v3: the secondary position of every player, `Player.secondaryPosition` (ADR-0022, item 4;
 * docs/design/posicao-secundaria.md, "Carreiras já salvas"; T-078).
 *
 * Each player of `game.players` gets `secondaryPositionFor(game.seed, player.id, player.position,
 * MIGRATION_SECONDARY_CHANCE)`: the engine's own rule, from the player's own stream, so the result
 * depends only on the career's seed, the id, the natural position and the constant. It does not
 * depend on the order of the players, it is idempotent, and the same career gets the same
 * secondaries on any device, on any day, and the same as a new game of the same seed gives to
 * the same players (the new game's `#1` to `#25` and the academy's ids are stable).
 *
 * The chance is this step's own constant, never `players.secondaryChance`: a /balance tuning must
 * not change what a v2 save migrated after it gets. While this step calls the engine, the output
 * of `secondaryPositionFor` (and of the neighbours, from the FIT table) must not change for any
 * input; to change it, first freeze the current rule here (ADR-0022, "Conformidade").
 *
 * Nothing else changes: not the rest of the player (overall, attributes, potential), not the
 * squads (no new squad shift, so the stored strengths stay), not the table, `career.draft`,
 * `career.lastRound` nor `career.matchSheets` (the migrated save, written without `base`,
 * rewrites their rows with the same content). A `secondaryPosition` already in a v2 save is an
 * edited file (no v2 build writes it): the draw replaces it.
 *
 * It never fixes and never throws: the save is untrusted until the strict schema after the chain.
 * A `game` that is not an object, a `seed` that is not an unsigned 32-bit integer, or a player
 * that is not an object with an `id` text and a `position` of POSITIONS is copied as it came,
 * without the new key, and the `full` schema refuses it (`missing`, or the problem of the data
 * itself). Built with spread and `Object.fromEntries` only (migrations/index.ts).
 */

/** `players.secondaryChance` when v3 came out (ADR-0022, item 4); frozen with this step. */
export const MIGRATION_SECONDARY_CHANCE = 0.33;

const UINT32_MAX = 0xffffffff;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSeed = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= UINT32_MAX;

const isPosition = (value: unknown): value is Position => POSITIONS.includes(value as Position);

/** A player with the drawn secondary position, or the value as it came when it is not one. */
function withSecondary(seed: number, player: unknown): unknown {
  if (!isObject(player) || typeof player.id !== 'string' || !isPosition(player.position)) {
    return player;
  }
  const secondaryPosition = secondaryPositionFor(
    seed,
    player.id,
    player.position,
    MIGRATION_SECONDARY_CHANCE,
  );
  return { ...player, secondaryPosition };
}

export const secondaryPosition: Migration = {
  from: 2,
  migrate(save) {
    const game = save.game;
    if (!isObject(game) || !isSeed(game.seed) || !isObject(game.players)) return { ...save };
    const seed = game.seed;
    const players = Object.fromEntries(
      Object.entries(game.players).map(([id, player]) => [id, withSecondary(seed, player)]),
    );
    return { ...save, game: { ...game, players } };
  },
};
