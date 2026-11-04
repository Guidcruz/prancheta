import { describe, expect, it } from 'vitest';
import { clamp, exp, normal, NORMAL_DRAWS } from './math.ts';
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
    expect(exp(1)).toBeCloseTo(Math.E, 15);
    // Worked example of docs/design/partida.md: 0.090 × exp(0.14 × 1.38) ≈ 0.109.
    expect(0.09 * exp(0.14 * 1.38)).toBeCloseTo(0.109, 3);
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
