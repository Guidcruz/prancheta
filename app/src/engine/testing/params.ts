/**
 * A valid GameParams with the initial values of the design documents, for engine tests (the
 * engine cannot import app/src/params/; app/src/lib/params.test.ts checks the real files).
 *
 * Test-only code: never imported by `index.ts`.
 */
import type { GameParams } from '../params.ts';

export function testParams(overrides: { clubStrengthSd?: number } = {}): GameParams {
  return {
    match: {
      baseChance: 0.09,
      kChance: 0.14,
      conversion: 0.15,
      kFinish: 0.09,
      midWeight: 0.5,
      dayFormSd: 3,
      homeBase: 0.05,
      missingPlayerPenalty: 0.07,
      penaltyShare: 0.015,
      freeKickShare: 0.06,
      assistShare: 0.7,
      fatigue: { drainPerMinute: 0.3, recoveryPerDay: 7 },
      injury: { basePerMinute: 0.00012 },
      cards: { yellowPerMinute: 0.002, redPerMinute: 0.00003, derbyMult: 1.2 },
    },
    players: { growthMin: 0.8, growthMax: 1.2 },
    generation: { clubStrengthSd: overrides.clubStrengthSd ?? 1.5 },
    ai: { rotationCondition: 85, rotationMinRatio: 0.9, subEnergy: 65, tiredTeamCondition: 85 },
    season: { fifaWeeks: [9, 21, 25, 30], midweekWeeks: [3, 7, 12, 16, 19, 23, 28, 32] },
    fans: {
      homeBonusMin: 0.02,
      homeBonusMax: 0.08,
      derbyBonus: 0.02,
      moraleDrift: 1,
      start: 60,
      baseline: 55,
      resultWeight: 4,
      derbyResultMult: 1.5,
      reversion: 0.08,
      decisionCap: 4,
      baseOccupancy: 0.62,
    },
  };
}
