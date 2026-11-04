import { describe, expect, it } from 'vitest';
import { Rng, seedFromString } from './rng';

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    expect(Array.from({ length: 50 }, () => a.next())).toEqual(
      Array.from({ length: 50 }, () => b.next()),
    );
  });

  it('matches the golden sequence (changing the algorithm breaks saves, replays and online)', () => {
    const r = new Rng(42);
    const got = Array.from({ length: 5 }, () => Number(r.next().toFixed(8)));
    expect(got).toMatchInlineSnapshot(`
      [
        0.60110375,
        0.44829056,
        0.85246579,
        0.66973404,
        0.1748139,
      ]
    `);
    expect(seedFromString('flamingo')).toMatchInlineSnapshot(`1206972572`);
  });

  it('differs between seeds', () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });

  it('keeps int() within bounds', () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
    }
  });

  it('pick() returns undefined for an empty array and an element otherwise', () => {
    const r = new Rng(3);
    expect(r.pick([])).toBeUndefined();
    expect(['a', 'b', 'c']).toContain(r.pick(['a', 'b', 'c']));
  });

  it('chance() respects the probability roughly', () => {
    const r = new Rng(11);
    let hits = 0;
    for (let i = 0; i < 10000; i++) if (r.chance(0.3)) hits++;
    expect(hits / 10000).toBeGreaterThan(0.27);
    expect(hits / 10000).toBeLessThan(0.33);
  });

  it('fork() gives independent but reproducible streams', () => {
    const a = new Rng(5).fork();
    const b = new Rng(5).fork();
    expect(a.next()).toBe(b.next());
  });

  it('getState/fromState continue the same sequence', () => {
    const a = new Rng(99);
    a.next();
    a.next();
    const b = Rng.fromState(a.getState());
    expect(b.next()).toBe(a.next());
  });

  it('derives stable seeds from strings', () => {
    expect(seedFromString('flamingo')).toBe(seedFromString('flamingo'));
    expect(seedFromString('flamingo')).not.toBe(seedFromString('palmeirinha'));
  });
});
