import {
  BENCH_SIZE,
  type ClubId,
  type DraftSheet,
  type GameState,
  type PlayerId,
} from '../../engine/index.ts';
import { STARTER_SLOTS } from '../save/index.ts';

/*
 * The coach's sheet being edited, reconciled with the squad (ADR-0021, item 2; docs/02-
 * architecture.md, 4.2, "Ficha do técnico"; T-075). The `CareerService` runs it at one point only,
 * before every write (`persist` and `setDraft`), and keeps the result in memory: the sheet is
 * always stored coherent with the squad of the save it goes with, which the save's schema demands
 * (validate.ts, `writeIncoherence` and `parseDraft`, the one implementation of that check).
 */

/**
 * Most names in a role list (captains, penalty and free-kick takers): decision 1 of the CEO on
 * T-029. The screen's limit and the reconciliation's; the format takes up to 11.
 */
export const ROLE_LIST_MAX = 3;

/**
 * `draft` reconciled with the squad of `clubId` in `game` (ADR-0021). Pure and idempotent; never
 * throws.
 *
 * - An id out of the squad (retired at the season turn, sold or loaned later) becomes a free slot
 *   (`null`), and so does the second time an id appears in the 11 and the bench.
 * - The 11 are kept at {@link STARTER_SLOTS} slots and the bench is filled with `null` up to
 *   {@link BENCH_SIZE} (both cut there).
 * - The role lists keep only the starters left (not `null`), without repeats, in their order, at
 *   most {@link ROLE_LIST_MAX}.
 * - An injured or suspended player stays where he is (the screen warns and blocks "Jogar
 *   rodada"); the formation and the tactic do not change. A youngster promoted from the academy
 *   never enters by himself.
 */
export function reconcileDraft(
  game: Pick<GameState, 'squads'>,
  clubId: ClubId,
  draft: DraftSheet,
): DraftSheet {
  const squad = new Set(Object.hasOwn(game.squads, clubId) ? game.squads[clubId] : []);
  const used = new Set<PlayerId>();
  const keep = (id: PlayerId | null | undefined): PlayerId | null => {
    if (id === null || id === undefined || !squad.has(id) || used.has(id)) return null;
    used.add(id);
    return id;
  };
  const { lineup, tactic } = draft;
  const starters = Array.from({ length: STARTER_SLOTS }, (_, i) => keep(lineup.starters[i]));
  const bench = Array.from({ length: BENCH_SIZE }, (_, i) => keep(lineup.bench[i]));
  const onPitch = new Set(starters.filter((id): id is PlayerId => id !== null));
  const roles = (list: readonly PlayerId[]): PlayerId[] => {
    const kept: PlayerId[] = [];
    for (const id of list) {
      if (kept.length === ROLE_LIST_MAX) break;
      if (onPitch.has(id) && !kept.includes(id)) kept.push(id);
    }
    return kept;
  };
  return {
    lineup: {
      formation: lineup.formation,
      starters,
      bench,
      captains: roles(lineup.captains),
      penaltyTakers: roles(lineup.penaltyTakers),
      freeKickTakers: roles(lineup.freeKickTakers),
    },
    tactic: { posture: tactic.posture, pressure: tactic.pressure },
  };
}
