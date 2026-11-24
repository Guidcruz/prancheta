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

const keptBySetup = new Map<string, TestMatch[]>();

/**
 * The matches of rounds 1 to `rounds` of the test career of `seed` (10 per round), in order. A
 * larger corpus for the tests that need hundreds of matches (the anchor of the pitch tags).
 */
export function testMatchesOf(seed: number, rounds: number): readonly TestMatch[] {
  const key = `${seed}-${rounds}`;
  const hit = keptBySetup.get(key);
  if (hit !== undefined) return hit;
  const found: TestMatch[] = [];
  for (let round = 1; round <= rounds; round++) {
    const game = testCareer('full', round, seed);
    const plan = prepareRound(game, params, { coaches: { [TEST_CLUB]: 'result' } });
    if (!plan.ok) throw new Error(plan.error);
    for (const match of plan.value.matches) {
      found.push({ game, match, result: simulateMatch(match, params) });
    }
  }
  keptBySetup.set(key, found);
  return found;
}
