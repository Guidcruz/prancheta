import { describe, expect, it } from 'vitest';
import {
  POSITIONS,
  POTENTIAL_MAX,
  computeOverall,
  drawGrowthCurve,
  drawPotential,
  drawTrait,
  fitAttributesToOverall,
  attributeKeysFor,
  validatePlayer,
  type AttributeKey,
} from './players.ts';
import { Rng } from './rng.ts';
import { testPlayer } from './testing/players.ts';
import type { Position } from './types.ts';

/** Builds a player the way T-006 will: only through the draws and the fitting of T-005. */
function generated(seed: number, growthMin: number, growthMax: number) {
  const rng = new Rng(seed);
  const position = POSITIONS[rng.int(0, POSITIONS.length - 1)] as Position;
  const age = rng.int(17, 34);
  const target = rng.int(1, 99);
  const start: Partial<Record<AttributeKey, number>> = {};
  for (const key of attributeKeysFor(position)) start[key] = rng.int(1, 99);
  const attributes = fitAttributesToOverall(start, position, target);
  const overall = computeOverall(position, attributes);
  const potential = drawPotential(rng, overall, age);
  const { peakAge, growth } = drawGrowthCurve(rng, { growthMin, growthMax, secondaryChance: 0.33 });
  const trait = drawTrait(rng);
  return {
    ...testPlayer({ position, attributes, overall, potential, age, peakAge, growth, trait }),
    target,
  };
}

/** All six attributes of a position: fitAttributesToOverall leaves weight-0 ones as they come. */
function fullStart(position: Position): Partial<Record<AttributeKey, number>> {
  return Object.fromEntries(attributeKeysFor(position).map((k) => [k, 50]));
}

describe('generated players (property)', () => {
  it.each([
    [0.8, 1.2],
    [0.5, 1.5],
  ])('5,000 players with growth in [%f, %f] all pass validatePlayer', (gmin, gmax) => {
    for (let seed = 1; seed <= 5000; seed++) {
      const { target, ...player } = generated(seed * 7919, gmin, gmax);
      expect(player.overall, `seed ${seed}`).toBe(target);
      const result = validatePlayer(player);
      if (!result.ok) throw new Error(`seed ${seed}: ${JSON.stringify(result.detail)}`);
      expect(player.potential).toBeGreaterThanOrEqual(player.overall);
      if (player.overall <= POTENTIAL_MAX)
        expect(player.potential).toBeLessThanOrEqual(POTENTIAL_MAX);
    }
  });

  it('overall 96..99 keeps potential = overall and is still accepted', () => {
    for (const position of POSITIONS) {
      for (let target = 96; target <= 99; target++) {
        const attributes = fitAttributesToOverall(fullStart(position), position, target);
        const overall = computeOverall(position, attributes);
        expect(overall).toBe(target);
        expect(drawPotential(new Rng(3), overall, 20)).toBe(overall);
        const player = testPlayer({ position, attributes, overall, potential: overall });
        const r = validatePlayer(player);
        expect(r.ok ? [] : r.detail, position + target).toEqual([]);
      }
    }
  });
});

describe('validatePlayer against hostile input', () => {
  const corrupt = (patch: Record<string, unknown>) => ({ ...testPlayer(), ...patch });

  it('never throws on strange values in every field', () => {
    const weird: unknown[] = [
      undefined,
      null,
      NaN,
      Infinity,
      -Infinity,
      -0,
      0.5,
      -1,
      2 ** 53,
      '',
      ' ',
      '1',
      [],
      {},
      () => 1,
      Symbol('x'),
      10n,

      [NaN],
      { length: 1 },
    ];
    for (const key of Object.keys(testPlayer())) {
      for (const value of weird) {
        expect(
          () => validatePlayer(corrupt({ [key]: value })),
          `${key}=${String(value)}`,
        ).not.toThrow();
      }
    }
    for (const key of Object.keys(testPlayer().attributes)) {
      for (const value of weird) {
        const p = testPlayer();
        const result = validatePlayer({ ...p, attributes: { ...p.attributes, [key]: value } });
        if (typeof value !== 'number' || value !== p.attributes[key as AttributeKey]) {
          expect(result.ok, `${key}=${String(value)}`).toBe(false);
        }
      }
    }
  });

  it('refuses NaN, Infinity, fractions and out-of-range values at the documented limits', () => {
    const bad: Array<[string, unknown]> = [
      ['age', 14],
      ['age', 100],
      ['age', 25.5],
      ['shirt', 0],
      ['shirt', 100],
      ['overall', 0],
      ['overall', 100],
      ['potential', 100],
      ['potential', 0],
      ['growth', 0.49],
      ['growth', 1.51],
      ['growth', NaN],
      ['yellowCount', 3],
      ['yellowCount', -1],
      ['peakAge', 25],
      ['peakAge', 30],
      ['condition', 101],
      ['morale', -1],
      ['injuryRounds', -1],
      ['nameSeed', 2 ** 32],
    ];
    for (const [key, value] of bad) {
      expect(validatePlayer(corrupt({ [key]: value })).ok, `${key}=${String(value)}`).toBe(false);
    }
    const good: Array<[string, unknown]> = [
      ['age', 15],
      ['age', 60],
      ['age', 99],
      ['shirt', 1],
      ['shirt', 99],
      ['growth', 0.5],
      ['growth', 1.5],
      ['yellowCount', 0],
      ['yellowCount', 2],
      ['potential', 99],
    ];
    for (const [key, value] of good) {
      expect(validatePlayer(corrupt({ [key]: value })).ok, `${key}=${String(value)}`).toBe(true);
    }
  });

  it('handles prototype tricks without throwing or leaking', () => {
    const polluted = JSON.parse('{"__proto__": {"admin": true}}');
    expect(() => validatePlayer(polluted)).not.toThrow();
    const withProto = JSON.parse(
      JSON.stringify(testPlayer()).replace('{', '{"__proto__":{"x":1},'),
    );
    expect(() => validatePlayer(withProto)).not.toThrow();
    expect(({} as Record<string, unknown>).x).toBeUndefined();
    const inherited = Object.create(testPlayer());
    expect(validatePlayer(inherited).ok).toBe(false);
  });

  it('refuses sparse and oversized recentRatings and attributes of another position', () => {
    expect(validatePlayer(corrupt({ recentRatings: [5, , 6] })).ok).toBe(false);
    expect(validatePlayer(corrupt({ recentRatings: [5, 5, 5, 5, 5, 5] })).ok).toBe(false);
    expect(validatePlayer(corrupt({ recentRatings: [2.9] })).ok).toBe(false);
    expect(validatePlayer(corrupt({ recentRatings: [10.1] })).ok).toBe(false);
    const gk = testPlayer({ position: 'GK' });
    expect(validatePlayer({ ...gk, attributes: testPlayer().attributes }).ok).toBe(false);
  });

  it('does not throw on a cyclic value', () => {
    const cyclic: Record<string, unknown> = { ...testPlayer() };
    cyclic.name = cyclic;
    expect(() => validatePlayer(cyclic)).not.toThrow();
  });

  it('does not throw on an object with a throwing getter', () => {
    const getter = { ...testPlayer() };
    Object.defineProperty(getter, 'age', {
      enumerable: true,
      get() {
        throw new Error('boom');
      },
    });
    expect(() => validatePlayer(getter)).not.toThrow();
    const trap = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('boom');
        },
      },
    );
    expect(() => validatePlayer(trap)).not.toThrow();
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    for (const raw of [getter, trap, revoked.proxy]) {
      const result = validatePlayer(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.detail).toEqual([{ field: '', problem: 'unreadable' }]);
    }
  });
});
