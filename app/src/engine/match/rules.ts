import { clamp, exp } from '../math.ts';
import type { FansParams, MatchParams } from '../params.ts';
import type { AiProfile, Position, Pressure } from '../types.ts';
import type { HalftimeTalk, MissOutcome } from './types.ts';

/*
 * Rule constants and small formulas of the match (docs/design/partida.md, "Chance de oportunidade
 * e finalização", "Cansaço", "Acréscimos", "Estatísticas e notas", "Conversa no intervalo",
 * "Marcadores do resultado"; docs/design/torcida.md, "Público"). The tables are constants of
 * partida.md ("Constantes"), not /balance knobs; the knobs come in `MatchParams`.
 */

/** Regulation minutes of each half. */
export const HALF_MINUTES = 45;
/** Added time drawn at the end of each half: `Rng.int(min, max)` minutes. */
export const STOPPAGE: { readonly [H in 1 | 2]: { readonly min: number; readonly max: number } } = {
  1: { min: 0, max: 3 },
  2: { min: 2, max: 6 },
};

/** Bounds of `pChance` per team and minute. */
export const CHANCE_BOUNDS = { min: 0.01, max: 0.3 } as const;
/** Bounds of `pGoal` of an open-play chance. */
export const GOAL_BOUNDS = { min: 0.04, max: 0.4 } as const;

/** Weight of each slot position to be the shooter of an open-play chance (× finishing / 60). */
export const SHOOTER_WEIGHTS: { readonly [P in Position]: number } = {
  ST: 3.0,
  AM: 1.6,
  DM: 0.6,
  FB: 0.5,
  CB: 0.4,
  GK: 0,
};
/** Weight of each slot position to give the assist of an open-play goal (× passing / 60). */
export const ASSIST_WEIGHTS: { readonly [P in Position]: number } = {
  AM: 3.0,
  FB: 1.5,
  ST: 1.5,
  DM: 1.2,
  CB: 0.5,
  GK: 0,
};
/** Divisor of the attribute in the shooter and assist weights. */
export const WEIGHT_ATTRIBUTE_SCALE = 60;

/** How a chance that is not a goal ends, in this order of the cumulative draw. */
export const MISS_OUTCOMES: readonly { readonly outcome: MissOutcome; readonly share: number }[] = [
  { outcome: 'post', share: 0.07 },
  { outcome: 'saved', share: 0.48 },
  { outcome: 'wide', share: 0.45 },
];

/** `pGoal` from which a missed chance is a big one (importance 2). */
export const BIG_CHANCE_P_GOAL = 0.25;

/** Energy drain multiplier of each pressure (partida.md, "Táticas"). */
export const PRESSURE_DRAIN: { readonly [P in Pressure]: number } = {
  low: 0.8,
  medium: 1.0,
  high: 1.4,
};
/** The player in goal spends this share of an outfield player's drain. */
export const GOALKEEPER_DRAIN_SHARE = 0.3;

/** Effect of the half-time talk on the second half (`halftimeBoost`), by the half-time score. */
export const HALFTIME_TALK_EFFECTS: {
  readonly [T in HalftimeTalk]: {
    readonly losing: number;
    readonly drawing: number;
    readonly winning: number;
  };
} = {
  motivate: { losing: 0.03, drawing: 0.02, winning: 0 },
  demand: { losing: 0.04, drawing: 0, winning: -0.03 },
  calm: { losing: -0.02, drawing: 0.01, winning: 0.02 },
};
/** The talks in the order of the chaotic profile's draw. */
export const HALFTIME_TALKS: readonly HalftimeTalk[] = ['motivate', 'demand', 'calm'];
/**
 * The AI's half-time talk by profile (ia-clubes.md, "Perfis na 1a", column "Intervalo");
 * the chaotic profile draws one of {@link HALFTIME_TALKS} instead.
 */
export const AI_HALFTIME_TALK: {
  readonly [P in Exclude<AiProfile, 'chaotic'>]: {
    readonly losing: HalftimeTalk;
    readonly drawing: HalftimeTalk;
    readonly winning: HalftimeTalk;
  };
} = {
  ambitious: { losing: 'demand', drawing: 'motivate', winning: 'calm' },
  academy: { losing: 'motivate', drawing: 'motivate', winning: 'calm' },
  seller: { losing: 'motivate', drawing: 'motivate', winning: 'calm' },
  traditional: { losing: 'demand', drawing: 'motivate', winning: 'calm' },
};

/** Possession (display only): `clamp(50 + 1.5 × (Mid − Mid_opp) + Rng.int(−3, 3), 30, 70)`. */
export const POSSESSION = { base: 50, perMid: 1.5, noise: 3, min: 30, max: 70 } as const;

/** Player rating (partida.md, "Nota do jogador"). */
export const RATING = {
  base: 6.0,
  goal: 1.0,
  assist: 0.6,
  save: 0.3,
  conceded: -0.25,
  yellow: -0.5,
  red: -1.5,
  win: 0.4,
  loss: -0.4,
  /** The noise is uniform in [−0.5, 0.5). */
  noise: 0.5,
  min: 3.0,
  max: 10.0,
  /** Fewer regulation minutes than this: "sem nota". */
  minMinutes: 15,
} as const;

/** Thresholds of the result markers. */
export const MARKERS = {
  /** `goleada`: winning margin of at least this. */
  thrashingMargin: 3,
  /** `golNoFim`: the goal that set the final result came at this minute or later. */
  lateGoalMinute: 85,
  /** `hatTrick`: goals of one player. */
  hatTrickGoals: 3,
  /** `zebra`: the winner's strength + home was at least this far below the loser's. */
  upsetGap: 8,
  /** Displayed-strength points of the home side in the `zebra` comparison. */
  homePoints: 4,
} as const;

/** Attendance (torcida.md, "Público"). */
export const ATTENDANCE = {
  demandBase: 0.6,
  demandPerFans: 0.7,
  derbyMult: 1.25,
  minOccupancy: 0.1,
  maxOccupancy: 1.0,
} as const;

/**
 * Chance of a team creating a chance in a minute:
 * `clamp(baseChance × exp(kChance × (Power − Defense_opp) / 10), 0.01, 0.30)`, where both sides
 * already include the day form.
 */
export function chanceProbability(
  power: number,
  opponentDefense: number,
  match: Pick<MatchParams, 'baseChance' | 'kChance'>,
): number {
  const p = match.baseChance * exp((match.kChance * (power - opponentDefense)) / 10);
  return clamp(p, CHANCE_BOUNDS.min, CHANCE_BOUNDS.max);
}

/** `pGoal = clamp(conversion × exp(kFinish × (shot − gkEff) / 10), 0.04, 0.40)`. */
export function goalProbability(
  shot: number,
  goalkeeper: number,
  match: Pick<MatchParams, 'conversion' | 'kFinish'>,
): number {
  const p = match.conversion * exp((match.kFinish * (shot - goalkeeper)) / 10);
  return clamp(p, GOAL_BOUNDS.min, GOAL_BOUNDS.max);
}

/**
 * Energy a player loses in one minute (partida.md, "Cansaço"):
 * `fatigue.drainPerMinute × pressure.drain × (1.2 − 0.4 × physical / 100)`, times
 * {@link GOALKEEPER_DRAIN_SHARE} for the player in goal.
 */
export function energyDrain(
  physical: number,
  pressure: Pressure,
  inGoal: boolean,
  match: Pick<MatchParams, 'fatigue'>,
): number {
  const drain =
    match.fatigue.drainPerMinute * PRESSURE_DRAIN[pressure] * (1.2 - (0.4 * physical) / 100);
  return inGoal ? drain * GOALKEEPER_DRAIN_SHARE : drain;
}

/** Score state of a side at half time, from its own point of view. */
export function scoreState(own: number, other: number): 'losing' | 'drawing' | 'winning' {
  if (own < other) return 'losing';
  return own === other ? 'drawing' : 'winning';
}

/**
 * `halftimeBoost` of a side for the second half: the effect of its talk at its half-time score
 * (partida.md, "Conversa no intervalo"). The leader captain's double positive effect is T-010.
 */
export function halftimeBoost(talk: HalftimeTalk, own: number, other: number): number {
  return HALFTIME_TALK_EFFECTS[talk][scoreState(own, other)];
}

/**
 * Attendance (display only in 1a; torcida.md, "Público"):
 * `round(capacity × clamp(baseOccupancy × demand × (derby ? 1.25 : 1), 0.10, 1.00))`, with
 * `demand = 0.6 + 0.7 × fans / 100`. A missing or invalid capacity gives 0.
 */
export function attendance(
  capacity: number | undefined,
  fans: number,
  derby: boolean,
  params: Pick<FansParams, 'baseOccupancy'>,
): number {
  if (capacity === undefined || !(capacity > 0) || !Number.isFinite(capacity)) return 0;
  const demand = ATTENDANCE.demandBase + (ATTENDANCE.demandPerFans * clamp(fans, 0, 100)) / 100;
  const occupancy = clamp(
    params.baseOccupancy * demand * (derby ? ATTENDANCE.derbyMult : 1),
    ATTENDANCE.minOccupancy,
    ATTENDANCE.maxOccupancy,
  );
  return Math.round(capacity * occupancy);
}
