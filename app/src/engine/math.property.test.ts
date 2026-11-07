import { describe, expect, it } from 'vitest';
import { EXP_CONSTANTS, exp } from './math.ts';
import { Rng } from './rng.ts';
import { kSwitch, reductionK, ulpDistance, ulpStep } from './testing/exp-table.ts';

/*
 * Properties of the engine's exp (ADR-0020, tests 4 and 5). 10,000 points by default;
 * `PROPERTY_FULL=1` runs 10 million (before a release):
 * `PROPERTY_FULL=1 npm test -w app -- src/engine/math.property.test.ts`.
 */
const FULL = process.env.PROPERTY_FULL === '1';
const POINTS = FULL ? 10_000_000 : 10_000;
const { U_THRESHOLD, O_THRESHOLD } = EXP_CONSTANTS;

/** A uniform double in [a, b) with the full 53 bits of resolution (two 32-bit draws). */
function draw(rng: Rng, a: number, b: number): number {
  return a + (b - a) * (rng.next() + rng.next() / 4294967296);
}

/** Half of the points in [-6, 6], the range of the game; the other half over the whole domain. */
function point(rng: Rng, i: number): number {
  return i % 2 === 0 ? draw(rng, -6, 6) : draw(rng, U_THRESHOLD, O_THRESHOLD);
}

/** exp never decreases from 64 ulps below `x0` to 64 ulps above it. */
function monotonicAround(x0: number): void {
  let previous = exp(ulpStep(x0, -64));
  for (let d = -63; d <= 64; d++) {
    const value = exp(ulpStep(x0, d));
    if (!(previous <= value)) expect.fail(`not monotonic at ${ulpStep(x0, d)}`);
    previous = value;
  }
}

describe('exp: properties (ADR-0020)', () => {
  it(`is at most 1 ulp from this environment's Math.exp (${POINTS} points)`, () => {
    // Both are below 1 ulp from e^x, so they may differ by 1 ulp at most; more is a bug of the
    // port. On Node 22.23.4 the distance measured was 0 everywhere.
    const rng = new Rng(20261107);
    let worst = 0;
    let worstX = 0;
    let differ = 0;
    for (let i = 0; i < POINTS; i++) {
      const x = point(rng, i);
      const ours = exp(x);
      const native = Math.exp(x);
      if (ours === native) continue;
      differ++;
      const d = ulpDistance(ours, native);
      if (d > worst) {
        worst = d;
        worstX = x;
      }
    }
    expect(worst, `worst at x = ${worstX} (${differ} points differ)`).toBeLessThanOrEqual(1);
  });

  it(`is monotonic: exp(x) <= exp(next double after x) (${POINTS} points)`, () => {
    const rng = new Rng(7011);
    for (let i = 0; i < POINTS; i++) {
      const x = point(rng, i);
      const up = ulpStep(x, 1);
      if (!(exp(x) <= exp(up))) expect.fail(`exp(${x}) > exp(${up})`);
    }
  });

  it('is monotonic across each limit of the reduction, ulp by ulp', () => {
    const { TINY, HALF_LN2, THREE_HALVES_LN2 } = EXP_CONSTANTS;
    const branches = [TINY, HALF_LN2, THREE_HALVES_LN2].flatMap((x) => [x, -x]);
    for (const limit of [...branches, O_THRESHOLD, U_THRESHOLD]) monotonicAround(limit);
  });

  it('is monotonic across every change of the general k, where k really changes', () => {
    // From the first switch inside the domain to the last: (m + 0.5) ln 2 in [U, O].
    let switches = 0;
    for (let m = -1075; m <= 1023; m++) {
      if (m === -1 || m === 0) continue; // inside the k = 0 and k = ±1 branches
      const point = kSwitch(m);
      // The window really crosses a limit of k: the k before and at the point differ by one.
      expect(reductionK(point) - reductionK(ulpStep(point, -1)), `m = ${m}`).toBe(1);
      monotonicAround(point);
      switches++;
    }
    expect(switches).toBe(2097);
  });

  it('stays positive and finite inside the domain, and in [e^-6, e^6] in the range of the game', () => {
    const rng = new Rng(99);
    const low = exp(-6);
    const high = exp(6);
    for (let i = 0; i < 10_000; i++) {
      const x = draw(rng, -6, 6);
      const value = exp(x);
      if (!(value >= low && value <= high)) expect.fail(`exp(${x}) = ${value}`);
    }
    for (let i = 0; i < 10_000; i++) {
      const value = exp(draw(rng, U_THRESHOLD, O_THRESHOLD));
      if (!(value >= 0 && value < Infinity)) expect.fail(`exp out of range: ${value}`);
    }
  });
});
