import { test } from 'vitest';
import { fixtureInput, testGame } from '../testing/match.ts';
import { testParams } from '../testing/params.ts';
import { simulateMatch } from './simulate.ts';

/*
 * Bench of `simulateMatch` (docs/02-architecture.md, 5 "Desempenho": below 0.3 ms per match in
 * the CI's Node; docs/03-test-plan.md, "Bancada do motor"). Not blocking: `npm run bench -w app`
 * prints the mean time per match and never fails on it. Each iteration plays the next of the 380
 * fixtures of a new game, so every formation and profile is in the mix.
 *
 * Under Vitest the engine runs through Vite's module transform, which makes every call across
 * modules slower: in plain Node (the production path) the same match takes 2 to 3 times less.
 */
const TARGET_MS = 0.3;
const params = testParams();
const state = testGame();
const inputs = state.fixtures.map((fixture) => fixtureInput(state, fixture));
let next = 0;

test('simulateMatch: time per match (target below 0.3 ms, not blocking)', async ({ bench }) => {
  const result = await bench('simulateMatch', () => {
    simulateMatch(inputs[next]!, params);
    next = (next + 1) % inputs.length;
  }).run();
  const mean = result.latency?.mean ?? Number.NaN;
  const verdict = mean < TARGET_MS ? 'within' : 'ABOVE';
  console.info(
    `[bench] simulateMatch: ${mean.toFixed(4)} ms per match (p99 ${(result.latency?.p99 ?? Number.NaN).toFixed(4)} ms), ${verdict} the ${TARGET_MS} ms target`,
  );
});
