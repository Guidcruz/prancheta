import { execFileSync } from 'node:child_process';
import { test } from 'vitest';
import { endSeason, startNextSeason } from './season.ts';
import { fixedIdentitySource } from './testing/identity.ts';
import { testParams } from './testing/params.ts';
import { playedSeason } from './testing/season.ts';

/*
 * Bench of the season turn, `endSeason` + `startNextSeason` (T-017; docs/02-architecture.md, 5
 * "Desempenho": target under 50 ms in plain Node). Not blocking: `npm run bench -w app` prints the
 * time per turn and never fails on it. Each sample turns the state at round 39 of a whole season
 * of the synthetic clubs by the AI: the evolution of 500 players, 20 best XIs and one calendar.
 *
 * Two figures, as in round.bench.ts: plain Node in a child process, and inside Vitest (its module
 * transform only tracks the trend).
 */
const params = testParams();
const identities = fixedIdentitySource();

function plainNodeMs(turns: number): number {
  const url = (path: string) => JSON.stringify(new URL(path, import.meta.url).href);
  const script = [
    `const { endSeason, startNextSeason } = await import(${url('./season.ts')});`,
    `const { playedSeason } = await import(${url('./testing/season.ts')});`,
    `const { testParams } = await import(${url('./testing/params.ts')});`,
    `const { fixedIdentitySource } = await import(${url('./testing/identity.ts')});`,
    'const params = testParams(); const ids = fixedIdentitySource();',
    'const states = [1, 2].map((seed) => playedSeason(seed));',
    'const turn = (s) => startNextSeason(endSeason(s, params, [Object.keys(s.clubs)[0]]).value.state, params, ids);',
    'for (let i = 0; i < 5; i++) turn(states[i % 2]);',
    'const start = process.hrtime.bigint();',
    `for (let i = 0; i < ${turns}; i++) turn(states[i % 2]);`,
    `process.stdout.write(String(Number(process.hrtime.bigint() - start) / 1e6 / ${turns}));`,
  ].join('\n');
  return Number(
    execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  );
}

test('season turn: time per turn (not blocking)', { timeout: 120_000 }, async ({ bench }) => {
  const node = plainNodeMs(50);
  const states = [1, 2].map((seed) => playedSeason(seed));
  let next = 0;
  const result = await bench('endSeason + startNextSeason', () => {
    const s = states[next]!;
    const closed = endSeason(s, params, [Object.keys(s.clubs)[0]!]);
    if (!closed.ok) throw new Error(closed.error);
    const turned = startNextSeason(closed.value.state, params, identities);
    if (!turned.ok) throw new Error(turned.error);
    next = (next + 1) % states.length;
  }).run();
  console.info(
    [
      `[bench] season turn in plain Node: ${node.toFixed(2)} ms (500 players, 20 XIs, 1 calendar; target < 50 ms)`,
      `[bench] season turn inside Vitest (module transform): ${(result.latency?.mean ?? Number.NaN).toFixed(2)} ms`,
    ].join('\n'),
  );
});
