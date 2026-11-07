import type { Rng } from './rng.ts';

/*
 * Numeric helpers of the engine. No transcendental function of `Math` is called anywhere in the
 * engine, this file included (ADR-0007, rule 9; ADR-0020; lint enforces it): the ECMAScript
 * specification does not require them to be correctly rounded, so V8, JavaScriptCore and each of
 * their versions may disagree on the last bit. The ones the engine needs are written here with
 * the four operations only, which IEEE-754 binary64 defines bit for bit on every engine.
 */

/**
 * Limits `value` to [min, max]. NaN becomes `min`, so a strange parameter can never produce a
 * probability outside the range (docs/design/partida.md, edge cases).
 */
export function clamp(value: number, min: number, max: number): number {
  if (!(value >= min)) return min;
  return value > max ? max : value;
}

/*
 * Constants of fdlibm's e_exp.c, written in decimal; math.test.ts checks the bits of each one
 * against the hex of the original (ADR-0020, "Constantes").
 */
const LN2_HI = 6.9314718036912381649e-1; // 0x3fe62e42fee00000: the 21 low bits are zero
const LN2_LO = 1.90821492927058770002e-10; // 0x3dea39ef35793c76
const INV_LN2 = 1.442695040888963387; // 0x3ff71547652b82fe
const P1 = 1.66666666666666019037e-1; // 0x3fc555555555553e
const P2 = -2.77777777770155933842e-3; // 0xbf66c16c16bebd93
const P3 = 6.61375632143793436117e-5; // 0x3f11566aaf25de2c
const P4 = -1.6533902205465251539e-6; // 0xbebbbd41c5d26bf1
const P5 = 4.13813679705723846039e-8; // 0x3e66376972bea4d0
const O_THRESHOLD = 7.09782712893383973096e2; // 0x40862e42fefa39ef: above it, e^x overflows
const U_THRESHOLD = -7.4513321910194110842e2; // 0xc0874910d52d3051: below it, e^x is 0

// The high-word tests of e_exp.c, as doubles: |x| < 2^-28 (hx < 0x3e300000), |x| <= 0.5 ln 2
// (hx <= 0x3fd62e42, so below 0x3fd62e4300000000) and |x| < 1.5 ln 2 (hx < 0x3ff0a2b2).
const TINY = 3.725290298461914e-9; // 0x3e30000000000000 = 2^-28
const HALF_LN2 = 0.3465735912322998; // 0x3fd62e4300000000
const THREE_HALVES_LN2 = 1.0397205352783203; // 0x3ff0a2b200000000

/** Smallest and largest k of the table of 2^k: the normal range of binary64. */
const POW2_MIN = -1022;
const POW2_MAX = 1023;

/**
 * 2^k for k in [POW2_MIN, POW2_MAX], index k - POW2_MIN. Built by halving and doubling 1: every
 * step is a power of two in the normal range, so every product is exact (ADR-0020, "Escala").
 */
const POW2: readonly number[] = (() => {
  let p = 1;
  for (let k = 0; k > POW2_MIN; k--) p *= 0.5;
  const table: number[] = [];
  for (let k = POW2_MIN; k <= POW2_MAX; k++) {
    table.push(p);
    p *= 2;
  }
  return table;
})();

/** 2^-1000 (0x0170000000000000), the last step of a subnormal result. */
const TWO_M1000 = POW2[-1000 - POW2_MIN]!;

/**
 * Test-only view of the constants above (math.test.ts checks their bits). Not part of the
 * engine's API: `index.ts` does not export it.
 */
export const EXP_CONSTANTS = {
  LN2_HI,
  LN2_LO,
  INV_LN2,
  P1,
  P2,
  P3,
  P4,
  P5,
  O_THRESHOLD,
  U_THRESHOLD,
  TINY,
  HALF_LN2,
  THREE_HALVES_LN2,
  TWO_M1000,
} as const;

/**
 * e^x by arithmetic only (ADR-0020): the same bits on every IEEE-754 JavaScript engine.
 *
 * A port of `__ieee754_exp` of fdlibm (e_exp.c, Sun, 1993), step by step, without reading bits: the
 * high-word tests become comparisons with the doubles they stand for, the exponent addition
 * becomes a product by an exact power of two. Error below 1 ulp (fdlibm), and `exp(1)` is
 * `Math.E`, the correctly rounded value (fdlibm alone gives 1 ulp above). Only `+ - * /`,
 * comparisons, `Math.trunc` and `Math.E`: no Float64Array, DataView nor BigInt.
 *
 * Method of e_exp.c:
 * 1. Reduce x to r so that |r| <= 0.5 ln 2: x = k ln 2 + r, with ln 2 split in a high part with
 *    zero low bits (k × LN2_HI is exact) and a low part, r = hi - lo.
 * 2. Approximate e^r on [-0.5 ln 2, 0.5 ln 2] by a rational function: with
 *    c = r - r²(P1 + r²(P2 + r²(P3 + r²(P4 + r² P5)))) (Remez, error below 2^-59),
 *    e^r = 1 + r + r c / (2 - c), computed as 1 - ((lo - r c / (2 - c)) - hi).
 * 3. Scale back: e^x = 2^k e^r; for k < -1021 by 2^(k+1000) and then 2^-1000, a single rounding to
 *    the subnormal result; for k = 1024 by 2 and then 2^1023 (as later fdlibm releases do).
 *
 * The notice of fdlibm, which its license asks to preserve, is the legal comment just below, marked
 * so that a minifier that keeps legal comments keeps it.
 */
/*! @license
 * exp: a port of e_exp.c of fdlibm.
 * ====================================================
 * Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 *
 * Developed at SunSoft, a Sun Microsystems, Inc. business.
 * Permission to use, copy, modify, and distribute this
 * software is freely granted, provided that this notice
 * is preserved.
 * ====================================================
 */
export function exp(x: number): number {
  // Special cases, in the order of ADR-0020.
  if (x !== x) return x; // NaN
  if (x > O_THRESHOLD) return Infinity; // overflow, and +Infinity
  if (x < U_THRESHOLD) return 0; // underflow, and -Infinity
  if (x === 1) return Math.E;

  const ax = x < 0 ? -x : x;
  if (ax < TINY) return 1 + x; // ±0 and the tiny ones

  // Argument reduction.
  let k: number;
  let hi = 0;
  let lo = 0;
  let r: number;
  if (ax < HALF_LN2) {
    k = 0;
    r = x;
  } else {
    if (ax < THREE_HALVES_LN2) {
      k = x < 0 ? -1 : 1;
    } else {
      k = Math.trunc(INV_LN2 * x + (x < 0 ? -0.5 : 0.5));
    }
    hi = x - k * LN2_HI; // k × LN2_HI is exact: 32 significant bits times |k| <= 1075 < 2^11
    lo = k * LN2_LO;
    r = hi - lo;
  }

  // x is now in the primary range.
  const t = r * r;
  const c = r - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  if (k === 0) return 1 - ((r * c) / (c - 2) - r);
  const y = 1 - (lo - (r * c) / (2 - c) - hi);

  // Scale by 2^k: exact while the result is normal; a subnormal result is rounded once.
  if (k < POW2_MIN + 1) return y * POW2[k + 1000 - POW2_MIN]! * TWO_M1000;
  if (k > POW2_MAX) return y * 2 * POW2[POW2_MAX - POW2_MIN]!;
  return y * POW2[k - POW2_MIN]!;
}

/** Number of uniform draws consumed by {@link normal}; part of the determinism contract. */
export const NORMAL_DRAWS = 6;

/**
 * Approximate normal sample: the sum of 6 uniforms from the seeded Rng, centred and scaled
 * (docs/design/partida.md, "forma do dia"). Always consumes exactly {@link NORMAL_DRAWS} draws,
 * and the result stays within mean ± 4.25 sd.
 */
export function normal(rng: Rng, mean = 0, sd = 1): number {
  let sum = 0;
  for (let i = 0; i < NORMAL_DRAWS; i++) sum += rng.next();
  // Sum of 6 U(0,1): mean 3, variance 6/12 = 0.5, so (sum - 3) * sqrt(2) has variance 1.
  return mean + (sum - 3) * Math.SQRT2 * sd;
}
