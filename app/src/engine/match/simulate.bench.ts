import { execFileSync } from 'node:child_process';
import { test } from 'vitest';
import { fixtureInput, testGame } from '../testing/match.ts';
import { testParams } from '../testing/params.ts';
import { simulateMatch } from './simulate.ts';

/*
 * Bench of `simulateMatch` (docs/02-architecture.md, 5 "Desempenho": below 0.3 ms per match in
 * the CI's Node; docs/03-test-plan.md, "Bancada do motor"). Not blocking: `npm run bench -w app`
 * prints the time per match and never fails on it. Each match is the next of the 380 fixtures of
 * a new game, so every formation and profile is in the mix.
 *
 * Two figures:
 * - plain Node (the one the target is about): the engine runs without a build step (ADR-0007),
 *   as in the /balance and on the server, timed with `process.hrtime` in a child process;
 * - inside Vitest, in batches of 50: Vite's module transform turns every call across modules
 *   into a property read, so this one is several times higher and only tracks the trend.
 */
const TARGET_MS = 0.3;
const BATCH = 50;
const params = testParams();
const state = testGame();
const inputs = state.fixtures.map((fixture) => fixtureInput(state, fixture));
let next = 0;

function plainNodeMs(matches: number): number {
  const url = (path: string) => JSON.stringify(new URL(path, import.meta.url).href);
  const script = [
    `const { simulateMatch } = await import(${url('./simulate.ts')});`,
    `const { fixtureInput, testGame } = await import(${url('../testing/match.ts')});`,
    `const { testParams } = await import(${url('../testing/params.ts')});`,
    'const params = testParams();',
    'const state = testGame();',
    'const inputs = state.fixtures.map((f) => fixtureInput(state, f));',
    'for (let i = 0; i < 2000; i++) simulateMatch(inputs[i % inputs.length], params);',
    'const start = process.hrtime.bigint();',
    `for (let i = 0; i < ${matches}; i++) simulateMatch(inputs[i % inputs.length], params);`,
    `const ms = Number(process.hrtime.bigint() - start) / 1e6 / ${matches};`,
    'process.stdout.write(String(ms));',
  ].join('\n');
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return Number(out);
}

const verdict = (ms: number) => (ms < TARGET_MS ? 'within' : 'ABOVE');

test('simulateMatch: time per match (target below 0.3 ms in Node, not blocking)', async ({
  bench,
}) => {
  const node = plainNodeMs(20_000);
  const result = await bench(`simulateMatch × ${BATCH}`, () => {
    for (let i = 0; i < BATCH; i++) {
      simulateMatch(inputs[next]!, params);
      next = (next + 1) % inputs.length;
    }
  }).run();
  const vitest = (result.latency?.mean ?? Number.NaN) / BATCH;
  console.info(
    [
      `[bench] simulateMatch in plain Node: ${node.toFixed(4)} ms per match, ${verdict(node)} the ${TARGET_MS} ms target`,
      `[bench] simulateMatch inside Vitest (module transform): ${vitest.toFixed(4)} ms per match`,
    ].join('\n'),
  );
});
