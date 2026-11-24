import { Rng, seedFromString, type Side } from '@engine';
import type { MatchStep } from '../steps';
import { MATCH_TIMING } from '../timing';

/*
 * Who has the ball in each step of the pitch (docs/design/campo-lances.md, D4-C; partida-campo-v2.md,
 * 6): by a quota that follows the possession of the match report, so the shirt over the ball tells
 * the same story as the report. A pure function of the steps, the report's possession and the
 * seed. It reads only the side of each play, never its outcome, the score or the strength of the
 * clubs: a play is the same for a goal and for a chance.
 *
 * - A step of a play (the start, the outcome, a penalty, a weak chance): the side of the event.
 * - After a goal the ball goes back to the centre: no owner in that one step, and then the club
 *   that conceded has it. After an outcome that is not a goal, the club that defended has it.
 * - A half starts with the home side in the first and the visitors in the second (a convention of
 *   the screen: the engine does not say who kicks off).
 * - In the steps of the quota (a minute with nothing shown, a card, an injury, a substitution, a
 *   change of tactic, the stoppage and the red card): when the owner is "owed" more than the band
 *   (0.5 to 2 minutes) the ball goes to the other; then the debt moves by `p − (home ? 1 : 0)`,
 *   weighted by the Normal duration of the step over a minute with nothing shown (800 ms).
 * - The phases (kick-off, half time, the second half, the final whistle) have no owner.
 */

/** The owner of each step: none (the phases, the step after a goal), the home or the visitor. */
export const OWNER = { none: 0, home: 1, away: 2 } as const;
export type Owner = (typeof OWNER)[keyof typeof OWNER];

/** The band of the debt, in minutes of possession (campo-lances.md, D4-C item 5). */
export const POSSESSION_BAND: readonly [number, number] = [0.5, 2];

const ownerOf = (side: Side): Owner => (side === 'home' ? OWNER.home : OWNER.away);
const otherSide = (side: Side): Side => (side === 'home' ? 'away' : 'home');

/**
 * The owner of every step of `steps`; `possession` is `stats.home.possession` of the result (0 to
 * 100) and `seed` the match's.
 */
export function possessionOwners(
  steps: readonly MatchStep[],
  possession: number,
  seed: number | string,
): Uint8Array {
  return possessionTrace(steps, possession, seed).owners;
}

/**
 * The owners, and who has the ball after each step (`after`: where a play, a goal or the start of
 * a half leaves it, before the quota may pass it on), for the tests of the rules of D4-C.
 */
export function possessionTrace(
  steps: readonly MatchStep[],
  possession: number,
  seed: number | string,
): { owners: Uint8Array; after: Uint8Array } {
  const rngOf = (label: string) => new Rng(seedFromString(`${seed}-pitch-${label}`));
  const band = (label: string) => {
    const rng = rngOf(label);
    return POSSESSION_BAND[0] + (POSSESSION_BAND[1] - POSSESSION_BAND[0]) * rng.next();
  };
  const p = Math.min(1, Math.max(0, possession / 100));
  const out = new Uint8Array(steps.length);
  const after = new Uint8Array(steps.length);
  let holder: Side = 'home';
  let debt = 0;
  let width = band('band-start');
  let afterGoal = false;
  const visit = (step: MatchStep, index: number): void => {
    const source = step.line?.source;
    const type = source?.type;
    const justScored = afterGoal;
    afterGoal = step.timing === 'afterGoal';
    if (step.timing === undefined) return;
    if (type === 'kickoff' || type === 'halftime') {
      holder = 'home';
      return;
    }
    if (type === 'secondHalf') {
      holder = 'away';
      return;
    }
    if (type === 'fulltime') return;
    if (
      source !== undefined &&
      (type === 'chance' ||
        type === 'goal' ||
        type === 'penaltyAwarded' ||
        type === 'penaltyMissed')
    ) {
      const side = source.side;
      out[index] = ownerOf(side);
      // After the outcome the other club has the ball (the kick-off, or the defender's).
      if (step.line!.stage === 'final') holder = otherSide(side);
      return;
    }
    if (justScored) return;
    // The steps of the quota.
    if (holder === 'home' && debt < -width) {
      holder = 'away';
      width = band(`m${step.slot}-band`);
    } else if (holder === 'away' && debt > width) {
      holder = 'home';
      width = band(`m${step.slot}-band`);
    }
    debt += (p - (holder === 'home' ? 1 : 0)) * (MATCH_TIMING.normal[step.timing] / 800);
    out[index] = ownerOf(holder);
  };
  steps.forEach((step, index) => {
    visit(step, index);
    after[index] = ownerOf(holder);
  });
  return { owners: out, after };
}
