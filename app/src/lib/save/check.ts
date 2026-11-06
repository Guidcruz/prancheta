import type { CareerSave } from './schema.ts';

/*
 * The coherence check of a migrated save before it is used (docs/02-architecture.md, 4.2:
 * "Vale o primeiro que passa por hash, parse, migração e validação"). This is the minimum the
 * store needs to tell a usable snapshot from a broken one: the envelope fields, the career that
 * the key says, and a game whose coach club exists. T-019 replaces it with the strict valibot
 * schema of the frozen format, which also checks every field of `GameState`.
 */

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === 'string';

const isWhole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

/**
 * `true` when `save` has the shape of a {@link CareerSave} of `careerId`, as far as this layer
 * reads it. Never throws, whatever the input.
 */
export function isCareerSave(save: unknown, careerId: string): save is CareerSave {
  if (!isObject(save) || save.careerId !== careerId) return false;
  if (!isWhole(save.schemaVersion) || !isWhole(save.engineVersion)) return false;
  if (![save.createdAt, save.updatedAt, save.appVersion, save.paramsHash].every(isText)) {
    return false;
  }
  const { career, game } = save;
  if (!isObject(career) || !isObject(game)) return false;
  if (!isText(career.clubId) || !isObject(career.matchSheets)) return false;
  if (!isWhole(game.season) || !isWhole(game.round)) return false;
  if (!isObject(game.clubs) || !isObject(game.players) || !Array.isArray(game.fixtures)) {
    return false;
  }
  // Own property only: a club id such as "__proto__" must not find Object.prototype.
  return Object.hasOwn(game.clubs, career.clubId) && isObject(game.clubs[career.clubId]);
}
