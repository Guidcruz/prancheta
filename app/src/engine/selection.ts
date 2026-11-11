import { FORMATION_SLOTS } from './formations.ts';
import { BENCH_SIZE } from './lineup.ts';
import { clamp } from './math.ts';
import { fit, type Player } from './players.ts';
import { conditionMultiplier } from './strength.ts';
import type { Formation, PlayerId, Position } from './types.ts';

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

/** N of `${clubId}#N`, for the "lower id" tie-break; the list position when there is no id. */
export function idNumber(player: { readonly id?: PlayerId }, index: number): number {
  const hash = player.id?.lastIndexOf('#') ?? -1;
  if (player.id === undefined || hash < 0) return index;
  const n = Number(player.id.slice(hash + 1));
  return Number.isInteger(n) ? n : index;
}

/** What {@link winsTie} reads; the id is optional because `bestEleven` also measures draft players. */
export type TieFields = Pick<Player, 'overall' | 'age'> & { readonly id?: PlayerId };

/**
 * The tie-break of ia-clubes.md ("Escalação", step 3) once the values are equal: higher overall,
 * then younger, then lower ID. "Lower ID" compares the number N of `${clubId}#N` numerically, as
 * `bestEleven` does (a text comparison would put `#10` before `#2`); `aIndex` and `bIndex` are the
 * fallback for an id without a number.
 */
export function winsTie(a: TieFields, aIndex: number, b: TieFields, bIndex: number): boolean {
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

/** What {@link naturalFirstEleven} reads from a player besides the value it is given. */
export type ElevenCandidate = TieFields & Pick<Player, 'position'>;

/**
 * The automatic XI, "natural primeiro" (docs/design/posicao-secundaria.md, "O algoritmo";
 * ia-clubes.md, "Escalação", step 3; ADR-0022, item 5): the one place of the rule, used by the
 * AI and the "Sugerir escalação" (`pickEleven`, ai.ts, with `selectionValue`), the best XI of the
 * generation and the turn (`bestEleven`, generation.ts, with `overall × fit`) and the /balance
 * robot (`scripts/balance/robot.ts`, with `effectiveRating` at the corrected condition).
 *
 * `value(player, slot)` is what each caller compares. With 11 or more in `available`:
 * 1. **position pass:** slot by slot in formation order (`FORMATION_SLOTS`: GK, CB, FB, DM, AM,
 *    ST), the slot gets, among the players not chosen yet **whose natural position is the
 *    slot's**, the one of highest value; with nobody of the position it stays empty;
 * 2. **swap pass:** slot by slot in the same order, **only the 10 outfield slots**: the player not
 *    chosen (any position, a reserve goalkeeper included) of highest value for the slot takes it
 *    when his value is **strictly higher** than the occupant's, or when the slot is empty. The
 *    occupant who leaves goes back to those not chosen and may take a later slot in this pass.
 *    Each slot is visited once, so the pass always ends;
 * 3. **goal:** a goalkeeper of pass 1 is never swapped. Without an available goalkeeper the goal,
 *    empty after pass 1, is filled last, after pass 2, with the highest value for the goal among
 *    those left.
 * With fewer than 11, the greedy fill of before T-082 (the design's step 4): slot by slot, the
 * highest value of any position, the last slots empty; without an available goalkeeper the
 * outfield slots go first (one player kept for the goal while there is more than one) and the
 * goal last, so the goal is never the empty slot.
 *
 * Every choice among candidates takes the highest value; equal values by {@link winsTie} (higher
 * overall, then younger, then lower id, with the index in `available` for an id without a
 * number), so the result depends only on the inputs and `available`'s order only matters on a
 * full tie. Pure: returns one entry per slot of `FORMATION_SLOTS[formation]`, `undefined` only
 * with fewer than 11 (always the last slots), and never repeats a player.
 */
export function naturalFirstEleven<T extends ElevenCandidate>(
  available: readonly T[],
  formation: Formation,
  value: (player: T, slot: Position) => number,
): (T | undefined)[] {
  const slots = FORMATION_SLOTS[formation];
  const taken = available.map(() => false);
  const placed: number[] = slots.map(() => -1);
  /** Index of the best player not taken for `slot` (`natural`: only that position); -1 if none. */
  const best = (slot: Position, natural: boolean): { index: number; value: number } => {
    let index = -1;
    let bestValue = -1;
    for (let i = 0; i < available.length; i++) {
      if (taken[i]) continue;
      const player = available[i]!;
      if (natural && player.position !== slot) continue;
      const v = value(player, slot);
      if (
        index < 0 ||
        v > bestValue ||
        (v === bestValue && winsTie(player, i, available[index]!, index))
      ) {
        index = i;
        bestValue = v;
      }
    }
    return { index, value: bestValue };
  };
  const place = (slot: number, index: number) => {
    if (placed[slot]! >= 0) taken[placed[slot]!] = false;
    placed[slot] = index;
    taken[index] = true;
  };
  const goal = slots.indexOf('GK');

  if (available.length < slots.length) {
    const order = slots.map((_, i) => i);
    if (goal >= 0 && !available.some((p) => p.position === 'GK')) {
      // Goal last; with 10 or fewer available, one is kept for the goal.
      const outfield = order.filter((i) => i !== goal).slice(0, Math.max(0, available.length - 1));
      order.splice(0, order.length, ...outfield, goal);
    }
    for (const slot of order) {
      const { index } = best(slots[slot]!, false);
      if (index < 0) break;
      place(slot, index);
    }
  } else {
    for (let slot = 0; slot < slots.length; slot++) {
      const { index } = best(slots[slot]!, true);
      if (index >= 0) place(slot, index);
    }
    for (let slot = 0; slot < slots.length; slot++) {
      if (slot === goal) continue;
      const position = slots[slot]!;
      const candidate = best(position, false);
      if (candidate.index < 0) continue;
      const occupant = placed[slot]!;
      if (occupant < 0 || candidate.value > value(available[occupant]!, position)) {
        place(slot, candidate.index);
      }
    }
    if (goal >= 0 && placed[goal]! < 0) {
      const { index } = best('GK', false);
      if (index >= 0) place(goal, index);
    }
  }
  return placed.map((index) => (index < 0 ? undefined : available[index]));
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

/**
 * Steps 1 to 3 of the formation change (partida.md, "Troca de formação durante o jogo"), shared by
 * the match (`changeFormation`, match/team.ts; T-012) and the change before the match
 * (`reshapeLineup`, draft.ts; T-076), so both move players by the same rule:
 * 1. in the slot order of the current formation (`from[i]` is the position of the slot of
 *    `occupants[i]`), each occupant takes the first free slot of `to` with the **same position**
 *    as the slot he is in (so whoever is in goal stays there, even an outfield player);
 * 2. in the slot order of `to`, each slot still free gets, among those left over, the one with the
 *    highest `eff` there; ties by {@link winsTie} (higher overall, then younger, then lower ID),
 *    with the index in the list of those left over as the fallback;
 * 3. with N occupants, exactly `to.length − N` slots stay empty: the last free ones of step 2.
 *
 * Pure: returns the occupants of the `to` slots (`undefined` = empty) and changes nothing. `tie`
 * reads the tie-break fields of an occupant.
 */
export function reshapeSlots<T>(
  occupants: readonly (T | undefined)[],
  from: readonly Position[],
  to: readonly Position[],
  eff: (occupant: T, slot: Position) => number,
  tie: (occupant: T) => Pick<Player, 'overall' | 'age' | 'id'>,
): (T | undefined)[] {
  const placed = new Array<T | undefined>(to.length).fill(undefined);
  const leftover: T[] = [];
  for (let i = 0; i < occupants.length; i++) {
    const occupant = occupants[i];
    if (occupant === undefined) continue;
    let target = -1;
    for (let j = 0; j < to.length; j++) {
      if (placed[j] === undefined && to[j] === from[i]) {
        target = j;
        break;
      }
    }
    if (target >= 0) placed[target] = occupant;
    else leftover.push(occupant);
  }
  for (let j = 0; j < to.length && leftover.length > 0; j++) {
    if (placed[j] !== undefined) continue;
    let best = 0;
    let bestValue = eff(leftover[0]!, to[j]!);
    for (let k = 1; k < leftover.length; k++) {
      const value = eff(leftover[k]!, to[j]!);
      if (
        value > bestValue ||
        (value === bestValue && winsTie(tie(leftover[k]!), k, tie(leftover[best]!), best))
      ) {
        best = k;
        bestValue = value;
      }
    }
    placed[j] = leftover[best];
    leftover.splice(best, 1);
  }
  return placed;
}
