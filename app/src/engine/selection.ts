import { idNumber } from './generation.ts';
import { BENCH_SIZE } from './lineup.ts';
import { clamp } from './math.ts';
import { fit, type Player } from './players.ts';
import { conditionMultiplier } from './strength.ts';
import type { PlayerId, Position } from './types.ts';

/*
 * The selection value of docs/design/ia-clubes.md ("Escalação", step 2) and its tie-break (step
 * 3), in one place: the AI's lineup (ai.ts, T-011) and the match's replacement of an unavailable
 * starter (match/team.ts, T-010; partida.md, "Casos de borda") pick players by the same rule.
 */

/**
 * A player's condition as the selection reads it: NaN goes to 0, like every clamp of the engine,
 * and a value out of 0..100 goes to the nearest end (a damaged value never wins nor loses a place
 * by itself).
 */
export function correctedCondition(player: Pick<Player, 'condition'>): number {
  return clamp(player.condition, 0, 100);
}

/**
 * Selection value of a player for a slot (ia-clubes.md, "Escalação"):
 * `overall × fit × (0.80 + 0.20 × condition / 100)`, with the corrected condition.
 */
export function selectionValue(
  player: Pick<Player, 'position' | 'overall' | 'condition'>,
  slot: Position,
): number {
  return (
    player.overall * fit(player.position, slot) * conditionMultiplier(correctedCondition(player))
  );
}

/**
 * The tie-break of ia-clubes.md ("Escalação", step 3) once the values are equal: higher overall,
 * then younger, then lower ID. "Lower ID" compares the number N of `${clubId}#N` numerically, as
 * `bestEleven` does (a text comparison would put `#10` before `#2`); `aIndex` and `bIndex` are the
 * fallback for an id without a number.
 */
export function winsTie(
  a: Pick<Player, 'overall' | 'age' | 'id'>,
  aIndex: number,
  b: Pick<Player, 'overall' | 'age' | 'id'>,
  bIndex: number,
): boolean {
  if (a.overall !== b.overall) return a.overall > b.overall;
  if (a.age !== b.age) return a.age < b.age;
  return idNumber(a, aIndex) < idNumber(b, bIndex);
}

/**
 * The candidate with the highest selection value for `slot`, ties by {@link winsTie}; candidates
 * for which `skip` is true are ignored. Undefined when nobody is left.
 */
export function bestForSlot<T extends Player>(
  candidates: readonly T[],
  slot: Position,
  skip: (player: T) => boolean = () => false,
): T | undefined {
  let best = -1;
  let bestValue = -1;
  for (let i = 0; i < candidates.length; i++) {
    const player = candidates[i]!;
    if (skip(player)) continue;
    const value = selectionValue(player, slot);
    if (
      best < 0 ||
      value > bestValue ||
      (value === bestValue && winsTie(player, i, candidates[best]!, best))
    ) {
      best = i;
      bestValue = value;
    }
  }
  return best < 0 ? undefined : candidates[best];
}

/** Injured or suspended at kick-off (the match's rule, partida.md "Casos de borda"). */
export function isUnavailable(player: Pick<Player, 'injuryRounds' | 'suspendedGames'>): boolean {
  return player.injuryRounds > 0 || player.suspendedGames > 0;
}

/**
 * The bench the kick-off can use (partida.md, "Substituições" and "Casos de borda"): the first
 * BENCH_SIZE ids of the sheet, each a player of `byId` (the squad), not a starter (`used`), not
 * unavailable and not repeated, in sheet order.
 */
export function kickoffBench<T extends Player>(
  ids: readonly PlayerId[],
  byId: ReadonlyMap<PlayerId, T>,
  used: ReadonlySet<PlayerId>,
): T[] {
  const bench: T[] = [];
  for (const id of ids.slice(0, BENCH_SIZE)) {
    const player = byId.get(id);
    if (player === undefined || used.has(id) || isUnavailable(player)) continue;
    if (bench.some((p) => p.id === id)) continue;
    bench.push(player);
  }
  return bench;
}

/**
 * The kick-off's replacement of injured or suspended starters (partida.md, "Casos de borda";
 * T-010): slot by slot in formation order, the best reserve of `bench` for the slot
 * ({@link bestForSlot}) takes it and leaves the bench; without one the slot is empty. Changes
 * `occupants` and `bench` in place; `onReplace` sees each starter and his reserve. Shared by the
 * match (match/team.ts) and the displayed strength of the last sheet (strength.ts, `shownEleven`),
 * so both build the same slots.
 */
export function replaceUnavailable<T extends Player>(
  occupants: (T | undefined)[],
  positions: readonly Position[],
  bench: T[],
  onReplace?: (player: T, reserve: T | undefined) => void,
): void {
  for (let i = 0; i < occupants.length; i++) {
    const player = occupants[i];
    if (player === undefined || !isUnavailable(player)) continue;
    const reserve = bestForSlot(bench, positions[i]!);
    onReplace?.(player, reserve);
    occupants[i] = reserve;
    if (reserve !== undefined) bench.splice(bench.indexOf(reserve), 1);
  }
}
