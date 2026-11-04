import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION, Rng, seedFromString } from './index.ts';
import { normal } from './math.ts';

describe('engine public API', () => {
  it('exposes the foundations', () => {
    expect(ENGINE_VERSION).toBeGreaterThanOrEqual(1);
    expect(new Rng(seedFromString('a')).next()).toBe(new Rng(seedFromString('a')).next());
  });

  it('runs in plain Node without a build step and gives the same numbers', () => {
    const entry = JSON.stringify(new URL('./index.ts', import.meta.url).href);
    const math = JSON.stringify(new URL('./math.ts', import.meta.url).href);
    const script = [
      `const m = await import(${entry});`,
      `const { normal } = await import(${math});`,
      `const r = new m.Rng(42);`,
      `process.stdout.write(JSON.stringify({ v: m.ENGINE_VERSION, n: r.next(), z: normal(r) }));`,
    ].join('\n');
    let out: string;
    try {
      out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      const stderr = (error as { stderr?: string }).stderr ?? '';
      throw new Error(`plain Node could not run the engine:\n${stderr}`, { cause: error });
    }
    const r = new Rng(42);
    expect(JSON.parse(out)).toEqual({ v: ENGINE_VERSION, n: r.next(), z: normal(r) });
  });
});
