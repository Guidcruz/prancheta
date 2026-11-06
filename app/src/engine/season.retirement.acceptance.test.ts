import { describe, expect, it } from 'vitest';
import type { GameState } from './game.ts';
import { RETIREMENT_MAX_AGE, RETIREMENT_MIN_AGE, endSeason, retires } from './season.ts';
import { fixedIdentitySource } from './testing/identity.ts';
import { testGame } from './testing/match.ts';
import { testParams } from './testing/params.ts';
import type { Position } from './types.ts';

/*
 * QA gate 2 of T-048: goalkeepers last much longer than outfield players. The table itself and the
 * share per age are in season.test.ts ("retires about the table share at each age"); these check
 * the cumulative effect the CEO asked for (reaching the late ages) with a large sample, and that
 * `endSeason` applies it to real squads. Wide margins: the expected gap is about 13x, the bounds
 * ask for 3x, so a different seed never makes them flaky (the sample is fixed anyway).
 */

const params = testParams();
const identities = fixedIdentitySource();

/** Share of players who are still playing at `target` out of those playing at 33. */
function reach(position: Position, target: number, n: number): number {
  let alive = 0;
  for (let k = 1; k <= n; k++) {
    const player = { id: `club#${k}`, position };
    let age = RETIREMENT_MIN_AGE;
    while (age < target && !retires({ seed: k, season: age }, { ...player, age: age + 1 })) age++;
    if (age >= target) alive++;
  }
  return alive / n;
}

describe('T-048: goalkeepers retire later than outfield players', () => {
  const N = 20_000;

  it('reach 39 several times more often than outfield players, and nobody reaches 40', () => {
    const gk = reach('GK', 39, N);
    const st = reach('ST', 39, N);
    // Surviving the draws of 34 to 39. Expected: 0.98 × 0.95 × 0.90 × 0.85 × 0.80 × 0.70 ≈ 40%
    // against 0.95 × 0.90 × 0.75 × 0.65 × 0.55 × 0.45 × 0.30 ≈ 3%.
    expect(gk).toBeGreaterThan(0.35);
    expect(gk).toBeLessThan(0.45);
    expect(st).toBeGreaterThan(0.015);
    expect(st).toBeLessThan(0.05);
    expect(gk).toBeGreaterThan(3 * st);
    for (const position of ['GK', 'CB', 'ST'] as const) {
      expect(reach(position, RETIREMENT_MAX_AGE, 2_000)).toBe(0);
    }
  });

  it('is the same for every outfield position (only the goalkeeper has his own row)', () => {
    const rates = (['CB', 'FB', 'DM', 'AM', 'ST'] as const).map((p) => reach(p, 37, 6_000));
    expect(Math.max(...rates) - Math.min(...rates)).toBeLessThan(0.05);
  });

  it('endSeason retires many more of the outfield players than of the goalkeepers at 39', () => {
    const gone = { GK: 0, other: 0 };
    const total = { GK: 0, other: 0 };
    for (let seed = 1; seed <= 12; seed++) {
      const base = testGame(seed);
      // All of 38, so 39 after the birthday of the turn (the evolution moves no age but this one).
      const players = Object.fromEntries(
        Object.entries(base.players).map(([id, p]) => [id, { ...p, age: 38 }]),
      );
      const state: GameState = { ...base, players, round: 39 };
      const closed = endSeason(state, params, [], identities);
      if (!closed.ok) throw new Error(closed.error);
      for (const [clubId, ids] of Object.entries(state.squads)) {
        for (const id of ids) {
          const key = state.players[id]!.position === 'GK' ? 'GK' : 'other';
          total[key]++;
          if (!closed.value.state.squads[clubId]!.includes(id)) gone[key]++;
        }
      }
    }
    expect(total.GK).toBeGreaterThan(300);
    const gk = gone.GK / total.GK; // expected 30%
    const other = gone.other / total.other; // expected 70%
    expect(gk).toBeGreaterThan(0.2);
    expect(gk).toBeLessThan(0.4);
    expect(other).toBeGreaterThan(0.6);
    expect(other).toBeLessThan(0.8);
  });
});
