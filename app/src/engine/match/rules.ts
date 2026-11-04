import { clamp, exp } from '../math.ts';
import type { FansParams, MatchParams } from '../params.ts';
import type { AiProfile, Position, Posture, Pressure, Side, Trait } from '../types.ts';
import type { HalftimeTalk, InjurySeverity, MissOutcome, TacticPreset } from './types.ts';

/*
 * Rule constants and small formulas of the match (docs/design/partida.md, "Chance de oportunidade
 * e finalização", "Cansaço", "Lesões", "Cartões e suspensão", "Acréscimos", "Estatísticas e
 * notas", "Conversa no intervalo", "Marcadores do resultado", "Casos de borda";
 * docs/design/torcida.md, "Público"). The tables are constants of
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

/** Penalty: `clamp(0.78 + 0.004 × (finishing − gkEff), 0.60, 0.92)`. */
export const PENALTY = { base: 0.78, perPoint: 0.004, min: 0.6, max: 0.92 } as const;
/** Direct free kick: `pGoal` (with `technique` in place of `finishing`) times this. */
export const FREE_KICK_GOAL_MULT = 0.45;

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

/** Card multiplier of each pressure (partida.md, "Táticas"). */
export const PRESSURE_CARDS: { readonly [P in Pressure]: number } = {
  low: 0.7,
  medium: 1.0,
  high: 1.4,
};
/** Card multiplier of the position of the slot the player is in (partida.md, "Cartões"). */
export const CARD_POSITION_MULT: { readonly [P in Position]: number } = {
  GK: 0.2,
  CB: 1.3,
  FB: 1.1,
  DM: 1.3,
  AM: 0.9,
  ST: 0.8,
};
/**
 * The other card factors (partida.md, "Cartões e suspensão" and "Conversa no intervalo"):
 * - `hothead`: `traitMult` of the temperamental trait (1 for the others);
 * - `booked`: a player who already has a yellow ("pendurado") gets the next one at half the rate;
 * - `calm`: yellows of a side that heard "Acalmar" at half time, in the second half.
 */
export const CARD_FACTORS = { hothead: 1.5, booked: 0.5, calm: 0.75 } as const;
/**
 * Suspension in 1a: the 3rd accumulated yellow suspends for 1 game and resets the counter; a red
 * suspends for 1 game. The two yellows of a second-yellow red never enter the accumulation.
 */
export const SUSPENSION = { yellowLimit: 3, yellowGames: 1, redGames: 1 } as const;

/** `pInjury = injury.basePerMinute × (1 + fatigueWeight × (1 − energy / 100))`. */
export const INJURY_FATIGUE_WEIGHT = 2;
/** Injury severities, in the order of the cumulative draw, with the rounds out (inclusive). */
export const INJURY_SEVERITIES: readonly {
  readonly severity: InjurySeverity;
  readonly share: number;
  readonly minRounds: number;
  readonly maxRounds: number;
}[] = [
  { severity: 'light', share: 0.6, minRounds: 1, maxRounds: 1 },
  { severity: 'medium', share: 0.25, minRounds: 2, maxRounds: 3 },
  { severity: 'serious', share: 0.12, minRounds: 4, maxRounds: 8 },
  { severity: 'severe', share: 0.03, minRounds: 10, maxRounds: 20 },
];

/**
 * Fewer players than this on the pitch ends the match (partida.md, "Casos de borda"): the other
 * side wins {@link ABANDONED_SCORE}×0, or by the score of the moment if it was winning by more.
 */
export const MIN_PLAYERS_ON_PITCH = 7;
export const ABANDONED_SCORE = 3;

/** A leader captain multiplies the positive effect of the half-time talk by this. */
export const LEADER_CAPTAIN_TALK_MULT = 2;

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

/** Substitutions per side and match (partida.md, "Substituições": `match.maxSubs = 5`, a rule). */
export const MAX_SUBS = 5;

/**
 * What each in-match shortcut sets (partida.md, "Comandos em jogo"): "Pressionar" only the
 * pressure; "Segurar o resultado" and "Todo mundo no ataque" the posture and the pressure.
 */
export const TACTIC_PRESETS: {
  readonly [P in TacticPreset]: { readonly posture?: Posture; readonly pressure: Pressure };
} = {
  press: { pressure: 'high' },
  holdResult: { posture: 'defensive', pressure: 'low' },
  allOut: { posture: 'allOut', pressure: 'high' },
};

/**
 * The minutes of the AI's in-match rules (ia-clubes.md, "Durante o jogo"; constants, "ordem das
 * regras em jogo"). The AI decides after a regulation minute is played, and the decision takes
 * effect in the next one, like a coach's command:
 * - `fatigue` (rule 2): from `fatigueFrom` to `fatigueTo`, a player with energy below
 *   `ai.subEnergy` is replaced by a better reserve;
 * - `chase` (rule 3): from `chaseFrom` (`chaoticChaseFrom` for the chaotic profile), losing;
 * - `allOut` (rule 4): from `allOutFrom`, losing by `oneGoal`;
 * - `hold` (rule 5): from `holdFrom` (`ambitiousHoldFrom` for the ambitious profile), winning by
 *   `oneGoal`;
 * - rule 6: before `keepSubUntil`, a tactical substitution always leaves one for an injury.
 */
export const IN_MATCH_AI = {
  fatigueFrom: 60,
  fatigueTo: 80,
  chaseFrom: 70,
  chaoticChaseFrom: 60,
  allOutFrom: 80,
  holdFrom: 75,
  ambitiousHoldFrom: 80,
  keepSubUntil: 80,
  oneGoal: 1,
} as const;

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
 * `pGoal` of a penalty: `clamp(0.78 + 0.004 × (finishing − gkEff), 0.60, 0.92)`. The caller puts
 * the home factor in both sides first ("Mando na finalização"): finishing 78 against 66 gives
 * 0.861 for the home taker (home 0.106), 0.800 for the away one and 0.828 on neutral ground.
 */
export function penaltyProbability(finishing: number, goalkeeper: number): number {
  return clamp(
    PENALTY.base + PENALTY.perPoint * (finishing - goalkeeper),
    PENALTY.min,
    PENALTY.max,
  );
}

/** The per-minute card rates of a side, before the player's own factors. */
export interface SideCardRates {
  /** `cards.yellowPerMinute × pressure.cards × (derby ? cards.derbyMult : 1) × (calm ? 0.75 : 1)`. */
  readonly yellow: number;
  /** `cards.redPerMinute × pressure.cards`. */
  readonly red: number;
}

/**
 * Card rates of a side in a minute (partida.md, "Cartões e suspensão"): its pressure, the derby
 * (yellows only, as in the formula) and, in the second half of a side that heard "Acalmar",
 * yellows × 0.75. Computed once per side and minute.
 */
export function sideCardRates(
  pressure: Pressure,
  derby: boolean,
  calm: boolean,
  match: Pick<MatchParams, 'cards'>,
): SideCardRates {
  const p = PRESSURE_CARDS[pressure];
  return {
    yellow:
      match.cards.yellowPerMinute *
      p *
      (derby ? match.cards.derbyMult : 1) *
      (calm ? CARD_FACTORS.calm : 1),
    red: match.cards.redPerMinute * p,
  };
}

/**
 * The highest `positionMult × traitMult` of any player (a hothead centre-back or defensive
 * midfielder): the ceiling of the match loop's shortcut. Internal: not part of the engine API.
 */
export const MAX_PLAYER_CARD_MULT =
  Math.max(...Object.values(CARD_POSITION_MULT)) * CARD_FACTORS.hothead;

/** `positionMult × traitMult` of a player: the position of his slot, 1.5 for a hothead. */
export function playerCardMult(position: Position, trait: Trait): number {
  return CARD_POSITION_MULT[position] * (trait === 'hothead' ? CARD_FACTORS.hothead : 1);
}

/**
 * Yellow card in one minute: `pYellow = side yellow rate × positionMult × traitMult × (already
 * booked ? 0.5 : 1)`, clamped to 0..1 (a second yellow is a red).
 */
export function yellowProbability(rates: SideCardRates, mult: number, booked: boolean): number {
  return clamp(rates.yellow * mult * (booked ? CARD_FACTORS.booked : 1), 0, 1);
}

/**
 * Direct red card in one minute: `pRed = side red rate × positionMult × traitMult`, clamped to
 * 0..1 (the formula has no derby nor booked factor).
 */
export function redProbability(rates: SideCardRates, mult: number): number {
  return clamp(rates.red * mult, 0, 1);
}

/**
 * Injury in one minute (partida.md, "Lesões"): `injury.basePerMinute × (1 + 2 × (1 − energy /
 * 100))`, with the energy of the moment, clamped to 0..1. Energy 60 → 1.8 times the risk of 100.
 */
export function injuryProbability(energy: number, match: Pick<MatchParams, 'injury'>): number {
  const p = match.injury.basePerMinute * (1 + INJURY_FATIGUE_WEIGHT * (1 - energy / 100));
  return clamp(p, 0, 1);
}

/**
 * Final score of a match abandoned because `short` fell below {@link MIN_PLAYERS_ON_PITCH}: the
 * other side wins 3×0, or keeps the score of the moment if it was already winning by more than 3.
 */
export function abandonedScore(score: readonly [number, number], short: Side): [number, number] {
  const [home, away] = score;
  const margin = short === 'home' ? away - home : home - away;
  if (margin > ABANDONED_SCORE) return [home, away];
  return short === 'home' ? [0, ABANDONED_SCORE] : [ABANDONED_SCORE, 0];
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
 * (partida.md, "Conversa no intervalo"). With a captain who has the leader trait, a positive
 * effect counts {@link LEADER_CAPTAIN_TALK_MULT} times ("Capitão e cobradores"); a negative one
 * does not change.
 */
export function halftimeBoost(
  talk: HalftimeTalk,
  own: number,
  other: number,
  leaderCaptain = false,
): number {
  const effect = HALFTIME_TALK_EFFECTS[talk][scoreState(own, other)];
  return leaderCaptain && effect > 0 ? effect * LEADER_CAPTAIN_TALK_MULT : effect;
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
