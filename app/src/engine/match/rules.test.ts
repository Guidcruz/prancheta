import { describe, expect, it } from 'vitest';
import { testParams } from '../testing/params.ts';
import {
  ASSIST_WEIGHTS,
  CHANCE_BOUNDS,
  GOAL_BOUNDS,
  HALFTIME_TALKS,
  HALFTIME_TALK_EFFECTS,
  MISS_OUTCOMES,
  SHOOTER_WEIGHTS,
  attendance,
  chanceProbability,
  energyDrain,
  goalProbability,
  halftimeBoost,
  scoreState,
} from './rules.ts';

const params = testParams();
const { match } = params;

describe('chance and goal probabilities (partida.md, "Chance de oportunidade e finalização")', () => {
  it('reproduces the numeric example: 13.8 points up → 0.109 a minute, down → 0.074', () => {
    // Power ≈ 74 × 1.106 = 81.8 against Defense 68.
    expect(chanceProbability(81.8, 68, match)).toBeCloseTo(0.109, 3);
    expect(chanceProbability(68, 81.8, match)).toBeCloseTo(0.0742, 3);
    expect(chanceProbability(70, 70, match)).toBeCloseTo(match.baseChance, 12);
  });

  it('reproduces the finishing example: finishing 78 against a goalkeeper of 66 → 0.167', () => {
    expect(goalProbability(78, 66, match)).toBeCloseTo(0.167, 3);
    expect(goalProbability(66, 66, match)).toBeCloseTo(match.conversion, 12);
  });

  it('clamps both to their bounds, NaN included', () => {
    expect(chanceProbability(400, 0, match)).toBe(CHANCE_BOUNDS.max);
    expect(chanceProbability(0, 400, match)).toBe(CHANCE_BOUNDS.min);
    expect(chanceProbability(Number.NaN, 70, match)).toBe(CHANCE_BOUNDS.min);
    expect(goalProbability(400, 0, match)).toBe(GOAL_BOUNDS.max);
    expect(goalProbability(0, 400, match)).toBe(GOAL_BOUNDS.min);
    expect(goalProbability(Number.NaN, 70, match)).toBe(GOAL_BOUNDS.min);
  });
});

describe('rule tables', () => {
  it('splits a miss into post 7%, save 48% and wide 45%', () => {
    expect(MISS_OUTCOMES.map((m) => m.outcome)).toEqual(['post', 'saved', 'wide']);
    expect(MISS_OUTCOMES.reduce((sum, m) => sum + m.share, 0)).toBeCloseTo(1, 12);
  });

  it('never picks the player in goal to shoot or to assist', () => {
    expect(SHOOTER_WEIGHTS.GK).toBe(0);
    expect(ASSIST_WEIGHTS.GK).toBe(0);
    expect(SHOOTER_WEIGHTS).toEqual({ ST: 3, AM: 1.6, DM: 0.6, FB: 0.5, CB: 0.4, GK: 0 });
    expect(ASSIST_WEIGHTS).toEqual({ AM: 3, FB: 1.5, ST: 1.5, DM: 1.2, CB: 0.5, GK: 0 });
  });

  it('gives every half-time talk one score in which it is the best (partida.md)', () => {
    const best = (state: 'losing' | 'drawing' | 'winning') =>
      [...HALFTIME_TALKS].sort(
        (a, b) => HALFTIME_TALK_EFFECTS[b][state] - HALFTIME_TALK_EFFECTS[a][state],
      )[0];
    expect(best('losing')).toBe('demand');
    expect(best('drawing')).toBe('motivate');
    expect(best('winning')).toBe('calm');
    expect(halftimeBoost('motivate', 0, 1)).toBe(0.03);
    expect(halftimeBoost('demand', 2, 0)).toBe(-0.03);
    expect(halftimeBoost('calm', 1, 1)).toBe(0.01);
    expect(scoreState(0, 1)).toBe('losing');
    expect(scoreState(2, 2)).toBe('drawing');
    expect(scoreState(3, 1)).toBe('winning');
  });
});

describe('energy drain (partida.md, "Cansaço")', () => {
  it('costs a physical-50 player about 27 points in 90 minutes at medium pressure, 38 at high', () => {
    expect(energyDrain(50, 'medium', false, match) * 90).toBeCloseTo(27, 9);
    expect(energyDrain(50, 'high', false, match) * 90).toBeCloseTo(37.8, 9);
    expect(energyDrain(50, 'low', false, match) * 90).toBeCloseTo(21.6, 9);
  });

  it('drains the player in goal at 30% and the stronger players less', () => {
    expect(energyDrain(50, 'medium', true, match)).toBeCloseTo(0.09, 12);
    expect(energyDrain(90, 'medium', false, match)).toBeLessThan(
      energyDrain(40, 'medium', false, match),
    );
  });
});

describe('attendance (torcida.md, "Público")', () => {
  it('fills 61% with a thermometer of 55 and about 95% at 90 in a derby', () => {
    expect(attendance(40_000, 55, false, params.fans)).toBe(Math.round(40_000 * 0.62 * 0.985));
    expect(attendance(40_000, 90, true, params.fans)).toBe(Math.round(40_000 * 0.62 * 1.23 * 1.25));
  });

  it('stays within 10% and 100% of the capacity, and is 0 without one', () => {
    expect(attendance(10_000, 0, false, { baseOccupancy: 0.1 })).toBe(1_000);
    expect(attendance(10_000, 100, true, { baseOccupancy: 1 })).toBe(10_000);
    expect(attendance(undefined, 50, false, params.fans)).toBe(0);
    expect(attendance(-5, 50, false, params.fans)).toBe(0);
    expect(attendance(Number.NaN, 50, false, params.fans)).toBe(0);
  });
});
