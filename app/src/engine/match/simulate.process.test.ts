import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { fixtureInput, firstDerby, testGame } from '../testing/match.ts';
import { testParams } from '../testing/params.ts';
import { simulateMatch } from './simulate.ts';

/*
 * US-008, "determinismo": the same seed in two separate Node processes gives the same events,
 * byte for byte (and the same as the test process).
 */
const url = (p: string) => JSON.stringify(new URL(p, import.meta.url).href);

function runInFreshProcess(seed: number): string {
  const script = [
    `const { fixtureInput, firstDerby, testGame } = await import(${url('../testing/match.ts')});`,
    `const { testParams } = await import(${url('../testing/params.ts')});`,
    `const { simulateMatch } = await import(${url('./simulate.ts')});`,
    `const state = testGame();`,
    `const input = { ...fixtureInput(state, firstDerby(state)), seed: ${seed} };`,
    `process.stdout.write(JSON.stringify(simulateMatch(input, testParams())));`,
  ].join('\n');
  try {
    return execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? '';
    throw new Error(`plain Node could not run the match:\n${stderr}`, { cause: error });
  }
}

describe('simulateMatch across processes (US-008)', () => {
  it('gives the same result, byte for byte, in two separate Node processes', () => {
    const a = runInFreshProcess(777);
    const b = runInFreshProcess(777);
    expect(a.length).toBeGreaterThan(1000);
    expect(b).toBe(a);

    const state = testGame();
    const local = simulateMatch(
      { ...fixtureInput(state, firstDerby(state)), seed: 777 },
      testParams(),
    );
    expect(a).toBe(JSON.stringify(local));
  }, 60_000);

  it('gives a different result for a different seed in another process', () => {
    expect(runInFreshProcess(778)).not.toBe(runInFreshProcess(777));
  }, 60_000);
});
