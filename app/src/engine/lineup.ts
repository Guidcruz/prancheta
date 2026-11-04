import type { Formation, PlayerId, Posture, Pressure } from './types.ts';

/*
 * Lineup and tactic contracts (docs/02-architecture.md, 4.1). The strength calculation (T-008)
 * reads `formation` and `starters`; `validateLineup` and `suggestSheet` (the bench, captains and
 * takers) are in ai.ts (T-011).
 */

/** The team the coach (or the AI) puts on the pitch. */
export interface Lineup {
  readonly formation: Formation;
  /** 11, in the slot order of `FORMATION_SLOTS[formation]`. */
  readonly starters: readonly PlayerId[];
  /** Up to `match.benchSize` (7). */
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
