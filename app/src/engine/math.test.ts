import { describe, expect, it } from 'vitest';
import { clamp, exp, EXP_CONSTANTS, normal, NORMAL_DRAWS } from './math.ts';
import { ulpStep } from './testing/exp-table.ts';
import { Rng } from './rng.ts';

describe('clamp', () => {
  it('limits values to the range', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(-2, 0, 1)).toBe(0);
    expect(clamp(7, 0, 1)).toBe(1);
    expect(clamp(0, 0, 1)).toBe(0);
    expect(clamp(1, 0, 1)).toBe(1);
  });

  it('turns NaN into the minimum, so a probability never escapes its range', () => {
    expect(clamp(Number.NaN, 0.01, 0.3)).toBe(0.01);
    expect(clamp(Number.POSITIVE_INFINITY, 0.01, 0.3)).toBe(0.3);
    expect(clamp(Number.NEGATIVE_INFINITY, 0.01, 0.3)).toBe(0.01);
  });
});

describe('exp', () => {
  it('is the exponential', () => {
    expect(exp(0)).toBe(1);
    expect(exp(1)).toBe(Math.E);
    // Worked example of docs/design/partida.md: 0.090 × exp(0.14 × 1.38) ≈ 0.109.
    expect(0.09 * exp(0.14 * 1.38)).toBeCloseTo(0.109, 3);
  });
});

/** The bits of a double as 16 hex digits, read by DataView (test only; ADR-0020, test 1). */
function bits(x: number): string {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  return view.getBigUint64(0).toString(16).padStart(16, '0');
}

describe('exp: the constants of e_exp.c (ADR-0020, test 1)', () => {
  // A wrong digit in a decimal literal of math.ts changes its bits.
  it.each([
    ['LN2_HI', '3fe62e42fee00000'],
    ['LN2_LO', '3dea39ef35793c76'],
    ['INV_LN2', '3ff71547652b82fe'],
    ['P1', '3fc555555555553e'],
    ['P2', 'bf66c16c16bebd93'],
    ['P3', '3f11566aaf25de2c'],
    ['P4', 'bebbbd41c5d26bf1'],
    ['P5', '3e66376972bea4d0'],
    ['O_THRESHOLD', '40862e42fefa39ef'],
    ['U_THRESHOLD', 'c0874910d52d3051'],
    ['TINY', '3e30000000000000'],
    ['HALF_LN2', '3fd62e4300000000'],
    ['THREE_HALVES_LN2', '3ff0a2b200000000'],
    ['TWO_M1000', '0170000000000000'],
  ] as const)('%s has the bits %s', (name, hex) => {
    expect(bits(EXP_CONSTANTS[name])).toBe(hex);
  });

  it('LN2_HI has its 21 low bits at zero, so k × LN2_HI is exact for every k of the domain', () => {
    // 53 - 21 = 32 significant bits, times |k| <= 1075 < 2^11: at most 43 bits, so no rounding.
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, EXP_CONSTANTS.LN2_HI);
    expect(view.getBigUint64(0) & 0x1fffffn).toBe(0n);
  });
});

describe('exp: special cases (ADR-0020, test 2)', () => {
  const { O_THRESHOLD, U_THRESHOLD } = EXP_CONSTANTS;

  it('NaN, ±0, 1 and ±Infinity', () => {
    expect(exp(Number.NaN)).toBeNaN();
    expect(exp(0)).toBe(1);
    expect(exp(-0)).toBe(1);
    expect(exp(1)).toBe(Math.E);
    expect(bits(exp(1))).toBe('4005bf0a8b145769');
    expect(exp(Infinity)).toBe(Infinity);
    expect(Object.is(exp(-Infinity), 0)).toBe(true);
  });

  it('overflows just above O_THRESHOLD and stays finite at it and 1 ulp below', () => {
    expect(exp(ulpStep(O_THRESHOLD, 1))).toBe(Infinity);
    expect(exp(O_THRESHOLD)).toBeLessThan(Infinity);
    expect(exp(O_THRESHOLD)).toBeGreaterThan(1.79e308);
    expect(exp(ulpStep(O_THRESHOLD, -1))).toBeLessThan(Infinity);
    expect(exp(Number.MAX_VALUE)).toBe(Infinity);
  });

  it('underflows to 0 just below U_THRESHOLD and gives a subnormal at it and 1 ulp above', () => {
    expect(Object.is(exp(ulpStep(U_THRESHOLD, -1)), 0)).toBe(true);
    expect(exp(U_THRESHOLD)).toBe(Number.MIN_VALUE);
    expect(exp(ulpStep(U_THRESHOLD, 1))).toBe(Number.MIN_VALUE);
    expect(Object.is(exp(-Number.MAX_VALUE), 0)).toBe(true);
  });

  it('gives known subnormals, rounded once', () => {
    expect(exp(-745)).toBe(Number.MIN_VALUE);
    // e^-740 = 4.1995579896506e-322 = 85.0 × 2^-1074 after rounding.
    expect(exp(-740)).toBe(85 * Number.MIN_VALUE);
    expect(exp(-740)).toBeLessThan(2.2250738585072014e-308);
  });

  it('gives 1 + x below 2^-28 and covers k = ±1 and k = 1024', () => {
    expect(exp(Number.MIN_VALUE)).toBe(1);
    expect(exp(1e-10)).toBe(1 + 1e-10);
    expect(exp(-1e-10)).toBe(1 - 1e-10);
    // k = ±1 (0.5 ln 2 <= |x| < 1.5 ln 2), the general k and k = 1024 (values of fdlibm).
    expect(exp(-1)).toBe(0.36787944117144233);
    expect(exp(0.5)).toBe(1.6487212707001282);
    expect(exp(-0.5)).toBe(0.6065306597126334);
    expect(exp(2)).toBe(7.38905609893065);
    expect(exp(-2)).toBe(0.1353352832366127);
    expect(exp(709.7)).toBe(1.6549840276802644e308);
  });
});

describe('normal', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng(10);
    const b = new Rng(10);
    expect(Array.from({ length: 20 }, () => normal(a, 5, 2))).toEqual(
      Array.from({ length: 20 }, () => normal(b, 5, 2)),
    );
  });

  it('consumes exactly NORMAL_DRAWS uniforms', () => {
    const used = new Rng(77);
    const reference = new Rng(77);
    normal(used);
    for (let i = 0; i < NORMAL_DRAWS; i++) reference.next();
    expect(used.getState()).toBe(reference.getState());
  });

  it('has roughly the requested mean and standard deviation, within a bounded range', () => {
    const rng = new Rng(2026);
    const n = 20000;
    const samples = Array.from({ length: n }, () => normal(rng, 10, 3));
    const mean = samples.reduce((s, x) => s + x, 0) / n;
    const sd = Math.sqrt(samples.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
    expect(mean).toBeGreaterThan(9.9);
    expect(mean).toBeLessThan(10.1);
    expect(sd).toBeGreaterThan(2.9);
    expect(sd).toBeLessThan(3.1);
    for (const x of samples) {
      expect(Math.abs(x - 10)).toBeLessThanOrEqual(3 * 3 * Math.SQRT2);
    }
  });

  it('with sd 0 returns the mean', () => {
    expect(normal(new Rng(1), 4, 0)).toBe(4);
  });
});
