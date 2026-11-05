import { execFileSync } from 'node:child_process';
import { test } from 'vitest';
import { testGame } from './testing/match.ts';
import { testParams } from './testing/params.ts';
import { playRound } from './round.ts';
import type { GameState } from './game.ts';

/*
 * Bench of `playRound` (T-013; docs/02-architecture.md, 5 "Desempenho" and 9, the CPU of the
 * online round). Not blocking: `npm run bench -w app` prints the time per round and never fails
 * on it. Each sample is a whole season of 38 rounds by the AI, from a new game of the synthetic
 * clubs, so the cost covers the 10 matches, the 20 AI sheets, the application and the facts.
 *
 * Two figures, as in simulate.bench.ts: plain Node (the engine without a build step, as in the
 * /balance and on the server) in a child process, and inside Vitest, whose module transform makes
 * every call across modules slower and only tracks the trend.
 */
const params = testParams();
const input = (round: number) => ({ round, sheets: {}, commands: {}, fanDecisions: {} });

function season(start: GameState): void {
  let state = start;
  for (let round = 1; round <= 38; round++) {
    const played = playRound(state, params, input(round));
    if (!played.ok) throw new Error(played.error);
    state = played.value.state;
  }
}

function plainNodeMs(seasons: number): number {
  const url = (path: string) => JSON.stringify(new URL(path, import.meta.url).href);
  const script = [
    `const { playRound } = await import(${url('./round.ts')});`,
    `const { testGame } = await import(${url('./testing/match.ts')});`,
    `const { testParams } = await import(${url('./testing/params.ts')});`,
    'const params = testParams();',
    'const run = (start) => { let s = start; for (let r = 1; r <= 38; r++) {',
    '  const p = playRound(s, params, { round: r, sheets: {}, commands: {}, fanDecisions: {} });',
    '  s = p.value.state; } };',
    'const starts = [1, 2, 3, 4, 5].map((seed) => testGame(seed));',
    'for (let i = 0; i < 3; i++) run(starts[i % starts.length]);',
    'const start = process.hrtime.bigint();',
    `for (let i = 0; i < ${seasons}; i++) run(starts[i % starts.length]);`,
    `const ms = Number(process.hrtime.bigint() - start) / 1e6 / (${seasons} * 38);`,
    'process.stdout.write(String(ms));',
  ].join('\n');
  return Number(
    execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  );
}

test('playRound: time per round (not blocking)', async ({ bench }) => {
  const node = plainNodeMs(10);
  const starts = [1, 2, 3].map((seed) => testGame(seed));
  let next = 0;
  const result = await bench('playRound × 38 (a season)', () => {
    season(starts[next]!);
    next = (next + 1) % starts.length;
  }).run();
  const vitest = (result.latency?.mean ?? Number.NaN) / 38;
  console.info(
    [
      `[bench] playRound in plain Node: ${node.toFixed(3)} ms per round (10 matches, 20 sheets, application, facts)`,
      `[bench] playRound inside Vitest (module transform): ${vitest.toFixed(3)} ms per round`,
    ].join('\n'),
  );
});
