import { describe, it } from 'vitest';
import { clamp, exp, normal } from './math.ts';
import { Rng, seedFromString } from './rng.ts';
import { expectGolden } from './testing/golden.ts';

/*
 * Example golden: the building blocks every later golden depends on (seeded streams, normal
 * samples and exp). If this changes, every match, round and season golden changes too.
 */
describe('golden: engine foundations', () => {
  it('keeps the seeded streams, normal samples and exp stable', () => {
    const seed = seedFromString('1-s1-r1-clube-teste-01-clube-teste-02');
    const rng = new Rng(seed);
    expectGolden('foundations', {
      seed,
      uniforms: Array.from({ length: 5 }, () => rng.next()),
      ints: Array.from({ length: 5 }, () => rng.int(1, 99)),
      normals: Array.from({ length: 5 }, () => normal(rng, 0, 3)),
      forked: rng.fork().next(),
      exp: [-1.5, -0.2, 0, 0.193, 1, 2.5].map(exp),
      clamped: [-0.5, 0.15, 0.9].map((p) => clamp(p, 0.01, 0.3)),
    });
  });
});
