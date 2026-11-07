/*
 * The bands of the squad's states (elenco.md, "Cores por faixa"; approved by the CEO on
 * 2026-11-07): good, fair and poor, painted `level-good`, `level-fair` and `level-poor` on the
 * number itself. The colour only reinforces the number, which is always shown; screen readers
 * get the band as a word. The one place of the limits: PlayerRow and AttributeBar take the
 * `level` the screen asks of `levelOf`, never a limit of their own.
 */

export type Level = 'good' | 'fair' | 'poor';
export type LevelMeasure = 'condition' | 'morale' | 'form';

/**
 * The lowest value of "good" and of "fair" of each measure, on the value as shown (condition
 * and morale rounded to the integer, form with one decimal); below `fair` is "poor".
 * - condition 0..100: 85 is the AI's rotation line (`ai.rotationCondition`), below 75 the
 *   `/balance` counts a starter as worn out (ia-clubes.md);
 * - morale 0..100: the fans' scale it drifts to (torcida.md): 60+ animada, below 40 irritada;
 * - form 3..10: 6,0 is the rating of a player who did nothing in a draw (partida.md); 7,0 is a
 *   good game, below 5,5 is a run of bad ones (a loss alone gives 5,6).
 */
export const LEVEL_BANDS: Readonly<
  Record<LevelMeasure, { readonly good: number; readonly fair: number }>
> = {
  condition: { good: 85, fair: 75 },
  morale: { good: 60, fair: 40 },
  form: { good: 7, fair: 5.5 },
};

/** The band of a shown value; `undefined` with no value (form "—") or a value that is not a number. */
export function levelOf(measure: LevelMeasure, shown: number | undefined): Level | undefined {
  if (shown === undefined || !Number.isFinite(shown)) return undefined;
  const band = LEVEL_BANDS[measure];
  if (shown >= band.good) return 'good';
  if (shown >= band.fair) return 'fair';
  return 'poor';
}
