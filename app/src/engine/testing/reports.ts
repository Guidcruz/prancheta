/**
 * The round reports of the states the tests played (T-049): the report is not in the state any
 * more, so a test that plays a chain of rounds keeps each report next to the state it produced,
 * in a WeakMap (never a field of the state). `trackRound` wraps a `playRound` result;
 * `reportOf(state)` is the report of the round that produced `state`.
 *
 * Test-only code: never imported by `index.ts`.
 */
import type { GameState } from '../game.ts';
import type { RoundReport } from '../round.ts';

const reports = new WeakMap<GameState, RoundReport>();

/** Registers the report of a successful `playRound` result; returns the result unchanged. */
export function trackRound<T extends { ok: boolean; value?: unknown }>(result: T): T {
  if (result.ok) {
    const { state, report } = result.value as { state: GameState; report: RoundReport };
    reports.set(state, report);
  }
  return result;
}

/** The report of the round that produced `state` (a state some test played with `trackRound`). */
export function reportOf(state: GameState): RoundReport {
  const report = reports.get(state);
  if (report === undefined)
    throw new Error('reportOf: this state was not played by a tracked round');
  return report;
}
