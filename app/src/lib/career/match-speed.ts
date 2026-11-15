/*
 * The speed of the match clock (docs/design/telas/partida.md, "Relógio da partida";
 * docs/02-architecture.md, 4.1, "Partida assistida pela camada de carreira", item 4): a
 * preference of the device, for every career, kept in the `kv` store of the save like the last
 * new-game setup. Not personal data, and not part of the `CareerSave`.
 */

export type MatchSpeed = 'normal' | 'fast';

export const MATCH_SPEEDS: readonly MatchSpeed[] = ['normal', 'fast'];

/** The key in the `kv` store; the value stored is the speed's own string. */
export const MATCH_SPEED_KEY = 'match.speed';

/** The stored value as a speed, or `undefined` when it is absent or not one (a newer build). */
export function parseMatchSpeed(value: unknown): MatchSpeed | undefined {
  return MATCH_SPEEDS.find((speed) => speed === value);
}
