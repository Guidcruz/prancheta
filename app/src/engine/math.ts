import type { Rng } from './rng.ts';

/*
 * Numeric helpers of the engine. Transcendental functions (exp and friends) are only called here
 * (ADR-0007, rule 9; lint enforces it): if V8 and JavaScriptCore ever disagree on the last bit,
 * the implementation is swapped in this one file (and ENGINE_VERSION goes up).
 */

/**
 * Limits `value` to [min, max]. NaN becomes `min`, so a strange parameter can never produce a
 * probability outside the range (docs/design/partida.md, edge cases).
 */
export function clamp(value: number, min: number, max: number): number {
  if (!(value >= min)) return min;
  return value > max ? max : value;
}

/** e^x. The only entry point for the exponential inside the engine. */
export function exp(x: number): number {
  return Math.exp(x);
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
