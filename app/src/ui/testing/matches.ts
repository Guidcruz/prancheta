import {
  prepareRound,
  simulateMatch,
  type GameState,
  type MatchInput,
  type MatchResult,
} from '@engine';
import { loadGameParams } from '@lib/params';
import { TEST_CLUB, testCareer } from './game';

/*
 * Real matches for the tests of the match screen (T-032): the 10 matches of some rounds of a test
 * career, simulated by the engine as the CareerService's `liveMatch` does. Built once and kept.
 */

const params = loadGameParams();

export interface TestMatch {
  readonly game: GameState;
  readonly match: MatchInput;
  readonly result: MatchResult;
}

let kept: TestMatch[] | undefined;

/** The matches of rounds 1 to 6 of the test career (60 matches), in order. */
export function testMatches(): readonly TestMatch[] {
  if (kept !== undefined) return kept;
  const found: TestMatch[] = [];
  for (let round = 1; round <= 6; round++) {
    const game = testCareer('full', round);
    const plan = prepareRound(game, params, { coaches: { [TEST_CLUB]: 'result' } });
    if (!plan.ok) throw new Error(plan.error);
    for (const match of plan.value.matches) {
      found.push({ game, match, result: simulateMatch(match, params) });
    }
  }
  kept = found;
  return found;
}
