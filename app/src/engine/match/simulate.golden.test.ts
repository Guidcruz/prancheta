import { describe, it } from 'vitest';
import { expectGolden } from '../testing/golden.ts';
import { matchGoldenCases } from '../testing/match-goldens.ts';

/*
 * Goldens of the match (US-008, "determinismo (golden test)"; docs/03-test-plan.md). The inputs
 * live in testing/match-goldens.ts, shared with the browser golden (tests/e2e/golden.spec.ts).
 * Any change in the match rules or in the order of draws changes them: bump ENGINE_VERSION.
 */
const cases = matchGoldenCases();

describe('golden: simulateMatch', () => {
  it('keeps the whole result of a derby stable', () => {
    expectGolden('match-derby', cases['match-derby']!());
  });

  it('keeps a short-handed match without its goalkeeper stable', () => {
    expectGolden('match-short-handed', cases['match-short-handed']!());
  });

  it('keeps the matches of two rounds stable', () => {
    expectGolden('match-round', cases['match-round']!());
  });

  it('keeps the matches with the AI sheets and the in-match AI stable', () => {
    expectGolden('match-ai-sheets', cases['match-ai-sheets']!());
  });

  it("keeps a match with the coach's commands stable", () => {
    expectGolden('match-commands', cases['match-commands']!());
  });
});
