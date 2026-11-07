import { FORMATIONS, FORMATION_SLOTS } from './formations.ts';
import type { Formation, PlayerId, Posture, Pressure } from './types.ts';

/*
 * Lineup and tactic contracts (docs/02-architecture.md, 4.1). The strength calculation (T-008)
 * reads `formation` and `starters`; `validateLineup` and `suggestSheet` (the bench, captains and
 * takers) are in ai.ts (T-011).
 *
 * The coach's sheet being edited (`DraftSheet`, ADR-0021; T-075) is a separate shape: it may have
 * a free slot anywhere, which a `Lineup` cannot (its `starters[i]` fills slot `i`, and a shorter
 * list leaves the last slots empty). It lives in the save's envelope (`career.draft`), never in
 * the `GameState`, and no function of the simulation takes it: the engine only receives a
 * `TeamSheet`.
 */

/** Bench size (partida.md, "Substituições": `match.benchSize = 7`, a rule constant). */
export const BENCH_SIZE = 7;

/** Slots of a formation, read from `FORMATION_SLOTS` (11 in every one): a draft's starters. */
const STARTER_SLOTS = Math.max(...FORMATIONS.map((f) => FORMATION_SLOTS[f].length));

/** The team the coach (or the AI) puts on the pitch. */
export interface Lineup {
  readonly formation: Formation;
  /** 11, in the slot order of `FORMATION_SLOTS[formation]`. */
  readonly starters: readonly PlayerId[];
  /** Up to {@link BENCH_SIZE} (7). */
  readonly bench: readonly PlayerId[];
  /** Ordered lists: the first one on the pitch takes the armband or the kick. */
  readonly captains: readonly PlayerId[];
  readonly penaltyTakers: readonly PlayerId[];
  readonly freeKickTakers: readonly PlayerId[];
}

/** Tactic chosen before the match; `allOut` is only reachable through a match command. */
export interface Tactic {
  readonly posture: Exclude<Posture, 'allOut'>;
  readonly pressure: Pressure;
}

export interface TeamSheet {
  readonly lineup: Lineup;
  readonly tactic: Tactic;
}

/**
 * The lineup the coach is editing (ADR-0021): exactly what the screen shows, free slots included.
 * It may hold an injured or suspended player and role lists with players off the pitch; it never
 * holds an id twice in the 11 and the bench, an id twice in one list, nor an id out of the coach's
 * squad (the save's schema refuses those, and the career layer turns them into free slots before
 * writing).
 */
export interface DraftLineup {
  readonly formation: Formation;
  /** Always 11, in the slot order of `FORMATION_SLOTS[formation]`; `null` is a free slot. */
  readonly starters: readonly (PlayerId | null)[];
  /** Up to {@link BENCH_SIZE} (7); `null` is a free bench slot. */
  readonly bench: readonly (PlayerId | null)[];
  /** Ordered lists, as in {@link Lineup}. */
  readonly captains: readonly PlayerId[];
  readonly penaltyTakers: readonly PlayerId[];
  readonly freeKickTakers: readonly PlayerId[];
}

/** The coach's sheet being edited (ADR-0021): the lineup with free slots and the tactic. */
export interface DraftSheet {
  readonly lineup: DraftLineup;
  /** Only the 3 pre-match postures, as in {@link TeamSheet}. */
  readonly tactic: Tactic;
}

/** `list` cut to `size` items and filled with `null` up to it. */
function slots(list: readonly PlayerId[], size: number): (PlayerId | null)[] {
  return Array.from({ length: size }, (_, i) => list[i] ?? null);
}

/**
 * The draft of a valid sheet (ADR-0021): the starters filled with `null` up to 11, the bench up to
 * {@link BENCH_SIZE} (both cut there), the lists and the tactic as they are. Pure: no `Rng`, the
 * input is not changed, never throws. Only the career layer calls it (the sheet sent to a round
 * becomes the stored draft); no function of the simulation does.
 */
export function draftFromSheet(sheet: TeamSheet): DraftSheet {
  const { lineup, tactic } = sheet;
  return {
    lineup: {
      formation: lineup.formation,
      starters: slots(lineup.starters, STARTER_SLOTS),
      bench: slots(lineup.bench, BENCH_SIZE),
      captains: [...lineup.captains],
      penaltyTakers: [...lineup.penaltyTakers],
      freeKickTakers: [...lineup.freeKickTakers],
    },
    tactic: { posture: tactic.posture, pressure: tactic.pressure },
  };
}
