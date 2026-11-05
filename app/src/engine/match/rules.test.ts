import { describe, expect, it } from 'vitest';
import { testParams } from '../testing/params.ts';
import { POSITIONS } from '../players.ts';
import type { Trait } from '../types.ts';
import {
  ABANDONED_SCORE,
  ASSIST_WEIGHTS,
  CARD_POSITION_MULT,
  CHANCE_BOUNDS,
  GOAL_BOUNDS,
  HALFTIME_TALKS,
  HALFTIME_TALK_EFFECTS,
  INJURY_SEVERITIES,
  MAX_PLAYER_CARD_MULT,
  MIN_PLAYERS_ON_PITCH,
  MISS_OUTCOMES,
  PENALTY,
  PRESSURE_CARDS,
  SHOOTER_WEIGHTS,
  SUSPENSION,
  abandonedScore,
  attendance,
  chanceProbability,
  energyDrain,
  goalProbability,
  halftimeBoost,
  injuryProbability,
  playerCardMult,
  penaltyProbability,
  redProbability,
  scoreState,
  sideCardRates,
  yellowProbability,
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

describe('penalty (partida.md, table "Tipo" and "Mando na finalização")', () => {
  it('reproduces the example: 78 against 66 → 0.861 at home (home 0.106), 0.800 away, 0.828 neutral', () => {
    const home = 0.106;
    expect(penaltyProbability(78 * (1 + home), 66)).toBeCloseTo(0.861, 3);
    expect(penaltyProbability(78, 66 * (1 + home))).toBeCloseTo(0.8, 3);
    expect(penaltyProbability(78, 66)).toBeCloseTo(0.828, 12);
  });

  it('stays within 0.60 and 0.92, NaN included', () => {
    expect(penaltyProbability(99, 1)).toBe(PENALTY.max);
    expect(penaltyProbability(1, 99)).toBe(PENALTY.min);
    expect(penaltyProbability(Number.NaN, 66)).toBe(PENALTY.min);
  });
});

describe('cards (partida.md, "Cartões e suspensão")', () => {
  const rates = sideCardRates('medium', false, false, match);

  it('has the tables of the design document', () => {
    expect(CARD_POSITION_MULT).toEqual({ GK: 0.2, CB: 1.3, FB: 1.1, DM: 1.3, AM: 0.9, ST: 0.8 });
    expect(PRESSURE_CARDS).toEqual({ low: 0.7, medium: 1, high: 1.4 });
    expect(SUSPENSION).toEqual({ yellowLimit: 3, yellowGames: 1, redGames: 1 });
  });

  it('builds pYellow from every factor: pressure, position, trait, booked, derby and "Acalmar"', () => {
    expect(yellowProbability(rates, playerCardMult('AM', 'quiet'), false)).toBeCloseTo(
      0.002 * 0.9,
      15,
    );
    const all = sideCardRates('high', true, true, match);
    expect(yellowProbability(all, playerCardMult('CB', 'hothead'), true)).toBeCloseTo(
      0.002 * 1.4 * 1.3 * 1.5 * 0.5 * 1.2 * 0.75,
      15,
    );
    expect(sideCardRates('low', false, false, match).yellow).toBeCloseTo(0.0014, 15);
  });

  it('takes the booked factor from match.cards.bookedMult (0.5 by default)', () => {
    expect(match.cards.bookedMult).toBe(0.5);
    const tuned = sideCardRates('medium', false, false, {
      cards: { ...match.cards, bookedMult: 0.2 },
    });
    const mult = playerCardMult('CB', 'quiet');
    expect(yellowProbability(tuned, mult, true)).toBeCloseTo(0.002 * 1.3 * 0.2, 15);
    expect(yellowProbability(tuned, mult, false)).toBe(yellowProbability(rates, mult, false));
    const off = sideCardRates('medium', false, false, { cards: { ...match.cards, bookedMult: 0 } });
    expect(yellowProbability(off, mult, true)).toBe(0);
  });

  it('builds pRed without the derby nor the booked factor', () => {
    const derby = sideCardRates('high', true, true, match);
    expect(derby.red).toBeCloseTo(0.00003 * 1.4, 15);
    expect(redProbability(derby, playerCardMult('DM', 'hothead'))).toBeCloseTo(
      0.00003 * 1.4 * 1.3 * 1.5,
      15,
    );
  });

  it('clamps to 0..1 and never goes above the ceiling the match loop uses', () => {
    const huge = sideCardRates('high', true, false, {
      cards: { yellowPerMinute: 5, redPerMinute: 5, derbyMult: 1.5, bookedMult: 1 },
    });
    expect(yellowProbability(huge, 1, false)).toBe(1);
    expect(redProbability(huge, 1)).toBe(1);
    const traits: Trait[] = ['leader', 'hothead', 'professional', 'idol', 'quiet'];
    for (const position of POSITIONS) {
      for (const trait of traits) {
        expect(playerCardMult(position, trait)).toBeLessThanOrEqual(MAX_PLAYER_CARD_MULT);
      }
    }
    expect(MAX_PLAYER_CARD_MULT).toBeCloseTo(1.3 * 1.5, 15);
  });
});

describe('injuries (partida.md, "Lesões")', () => {
  it('gives a player at energy 60 1.8 times the risk of a rested one', () => {
    expect(injuryProbability(100, match)).toBeCloseTo(0.00012, 15);
    expect(injuryProbability(60, match) / injuryProbability(100, match)).toBeCloseTo(1.8, 12);
    expect(injuryProbability(0, match)).toBeCloseTo(0.00036, 15);
    expect(injuryProbability(50, { injury: { basePerMinute: 2 } })).toBe(1);
  });

  it('has the severity table: 60/25/12/3 with 1, 2–3, 4–8 and 10–20 rounds', () => {
    expect(INJURY_SEVERITIES).toEqual([
      { severity: 'light', share: 0.6, minRounds: 1, maxRounds: 1 },
      { severity: 'medium', share: 0.25, minRounds: 2, maxRounds: 3 },
      { severity: 'serious', share: 0.12, minRounds: 4, maxRounds: 8 },
      { severity: 'severe', share: 0.03, minRounds: 10, maxRounds: 20 },
    ]);
    expect(INJURY_SEVERITIES.reduce((sum, r) => sum + r.share, 0)).toBeCloseTo(1, 12);
  });
});

describe('abandoned match (partida.md, "Casos de borda": fewer than 7)', () => {
  it('gives the other side 3×0, or the score of the moment if it was winning by more', () => {
    expect(MIN_PLAYERS_ON_PITCH).toBe(7);
    expect(ABANDONED_SCORE).toBe(3);
    expect(abandonedScore([1, 0], 'home')).toEqual([0, 3]);
    expect(abandonedScore([2, 2], 'away')).toEqual([3, 0]);
    expect(abandonedScore([1, 4], 'home')).toEqual([0, 3]); // by 3: not more than 3×0
    expect(abandonedScore([0, 4], 'home')).toEqual([0, 4]);
    expect(abandonedScore([6, 1], 'away')).toEqual([6, 1]);
    expect(abandonedScore([0, 5], 'away')).toEqual([3, 0]);
  });
});

describe('leader captain (partida.md, "Capitão e cobradores")', () => {
  it('doubles only the positive effect of the half-time talk', () => {
    expect(halftimeBoost('demand', 0, 1, true)).toBeCloseTo(0.08, 15);
    expect(halftimeBoost('motivate', 1, 1, true)).toBeCloseTo(0.04, 15);
    expect(halftimeBoost('calm', 2, 0, true)).toBeCloseTo(0.04, 15);
    expect(halftimeBoost('demand', 2, 0, true)).toBe(-0.03);
    expect(halftimeBoost('calm', 0, 1, true)).toBe(-0.02);
    expect(halftimeBoost('motivate', 2, 0, true)).toBe(0);
    expect(halftimeBoost('demand', 0, 1, false)).toBe(0.04);
  });
});
