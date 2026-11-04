import { idNumber } from './generation.ts';
import { clamp } from './math.ts';
import { fit, type Player } from './players.ts';
import { conditionMultiplier } from './strength.ts';
import type { Position } from './types.ts';

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
