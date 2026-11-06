import { describe, it } from 'vitest';
import {
  POSITIONS,
  attributeKeysFor,
  computeOverall,
  drawGrowthCurve,
  drawPotential,
  drawTrait,
} from './players.ts';
import { Rng, seedFromString } from './rng.ts';
import { expectGolden } from './testing/golden.ts';
import { fixedIdentitySource } from './testing/identity.ts';

/*
 * Golden of the deterministic player rules: the seeded draws of trait, potential and age curve,
 * the overall of seeded attributes, and the fixed identity source every later golden (squads,
 * newGame) is built on. If this changes, the squads of every career change too.
 */
describe('golden: player model', () => {
  it('keeps the player draws and the test identities stable', () => {
    const rng = new Rng(seedFromString('1-players-golden'));
    const overalls = POSITIONS.map((position) => {
      const attributes = Object.fromEntries(
        attributeKeysFor(position).map((key) => [key, rng.int(1, 99)]),
      );
      return { position, attributes, overall: computeOverall(position, attributes) };
    });
    const traits = Array.from({ length: 20 }, () => drawTrait(rng));
    const potentials = [17, 19, 21, 23, 24, 25, 26, 27, 33].map((age) => ({
      age,
      potential: drawPotential(rng, 65, age),
    }));
    const curves = Array.from({ length: 4 }, () =>
      drawGrowthCurve(rng, { growthMin: 0.8, growthMax: 1.2 }),
    );
    const identities = fixedIdentitySource().squad({
      seed: seedFromString('1-identities-clube-teste-01'),
      nationality: 'BR',
      count: 3,
      ages: [20, 25, 30],
      existing: [],
    });
    expectGolden('players', { overalls, traits, potentials, curves, identities });
  });
});
