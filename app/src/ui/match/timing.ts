/*
 * The rhythm of the assisted match (docs/design/telas/partida.md, "Relógio da partida", CEO
 * decision 5; proposal 36 of docs/design/telas/componentes.md, "Ritmo da partida" in
 * docs/design/design-system.md). Game rhythm, not animation: `prefers-reduced-motion` keeps it
 * (the dramatic pause becomes only the delay of the text). The values stay here until the motion
 * group of tokens exists (proposal 2 of componentes.md). No imports, so the E2E reads the same
 * values (tests/e2e/match.spec.ts).
 */

/** The speeds of the clock (`MatchSpeed` of lib/career, the device's preference). */
type Speed = 'normal' | 'fast';

/** What a step of the clock waits for, after it is shown. */
export type TimingKey =
  /** A minute with nothing shown, in "Animada completa". */
  | 'minuteFull'
  /** A minute with nothing shown, in "Só lances principais". */
  | 'minuteHighlights'
  /** A common play: card, substitution, weak chance, tactic change, stoppage, the phases. */
  | 'event'
  /** The dramatic pause: between the start of a play and its outcome. */
  | 'drama'
  /** After a goal is revealed. */
  | 'afterGoal'
  /** After an outcome that is not a goal (save, post, wide, missed penalty). */
  | 'afterMiss'
  /** Half time: between "Intervalo" and "Começa o 2º tempo". */
  | 'interval';

/**
 * The durations in milliseconds, in Normal and in Rápido (the table of partida.md). The empty
 * minute of "Só lances principais" was lengthened from 80/40 to 180/70 ms by the CEO on
 * 2026-11-15, after the review of T-032, for about 30 s and 12 s per match; the empty minute of
 * "Animada completa" from 500/200 to 800/300 ms (CEO decision 1C of T-085, the same day), for
 * about 1min20s and 30 s, the duration of decision 5.
 */
export const MATCH_TIMING = {
  normal: {
    minuteFull: 800,
    minuteHighlights: 180,
    event: 400,
    drama: 1200,
    afterGoal: 2000,
    afterMiss: 600,
    interval: 2000,
  },
  fast: {
    minuteFull: 300,
    minuteHighlights: 70,
    event: 150,
    drama: 500,
    afterGoal: 800,
    afterMiss: 250,
    interval: 800,
  },
} as const satisfies Readonly<Record<Speed, Readonly<Record<TimingKey, number>>>>;

/** How long a step waits at `speed`; the last step (full time) waits for nothing. */
export function timingOf(key: TimingKey | undefined, speed: Speed): number {
  return key === undefined ? 0 : MATCH_TIMING[speed][key];
}
