import { FORMATION_SLOTS } from './formations.ts';
import type { GameState } from './game.ts';
import { bestEleven, elevenStrength } from './generation.ts';
import type { Lineup } from './lineup.ts';
import { clamp } from './math.ts';
import type { GameParams, MatchParams } from './params.ts';
import { fit, type Player } from './players.ts';
import { fail, ok } from './result.ts';
import type { ClubId, Formation, PlayerId, Position, Posture, Pressure, Result } from './types.ts';

/*
 * Team strength before and during a match (docs/design/partida.md, "Nota efetiva de um jogador em
 * campo", "Formações", "Forças de setor e poder de ataque", "Táticas" and "Mando de campo e
 * clássico"; T-008). Everything here is pure arithmetic on the state: no Rng, no draws. The day
 * form (`dayForm`) is added on top by the match (T-009), and `T(t)` already takes the missing
 * players and the half-time talk as inputs, both 0 by default.
 *
 * The tables below are rule constants of partida.md ("Constantes"), not /balance knobs.
 */

/** The four lines of a team: the goalkeeper is in none of the three strength sectors. */
export type Sector = 'gk' | 'def' | 'mid' | 'atk';

/**
 * Sector of each slot of `FORMATION_SLOTS[formation]`, in the same order. The full-backs of a
 * back three (3-5-2, 3-4-3) are wing-backs and count in midfield; in a back five (5-3-2) they
 * are defenders, so the table is explicit instead of derived from the positions.
 */
export const FORMATION_SECTORS: { readonly [F in Formation]: readonly Sector[] } = {
  '4-4-2': ['gk', 'def', 'def', 'def', 'def', 'mid', 'mid', 'mid', 'mid', 'atk', 'atk'],
  '4-3-3': ['gk', 'def', 'def', 'def', 'def', 'mid', 'mid', 'mid', 'atk', 'atk', 'atk'],
  '4-2-3-1': ['gk', 'def', 'def', 'def', 'def', 'mid', 'mid', 'mid', 'mid', 'mid', 'atk'],
  '3-5-2': ['gk', 'def', 'def', 'def', 'mid', 'mid', 'mid', 'mid', 'mid', 'atk', 'atk'],
  '3-4-3': ['gk', 'def', 'def', 'def', 'mid', 'mid', 'mid', 'mid', 'atk', 'atk', 'atk'],
  '5-3-2': ['gk', 'def', 'def', 'def', 'def', 'def', 'mid', 'mid', 'mid', 'atk', 'atk'],
};

/** Sector multipliers of each formation (partida.md, "Formações"). */
export const FORMATION_MULTIPLIERS: {
  readonly [F in Formation]: { readonly def: number; readonly mid: number; readonly atk: number };
} = {
  '4-4-2': { def: 1.0, mid: 1.0, atk: 1.0 },
  '4-3-3': { def: 0.99, mid: 0.96, atk: 1.06 },
  '4-2-3-1': { def: 1.01, mid: 1.04, atk: 0.95 },
  '3-5-2': { def: 0.96, mid: 1.06, atk: 1.0 },
  '3-4-3': { def: 0.95, mid: 0.98, atk: 1.1 },
  '5-3-2': { def: 1.05, mid: 0.95, atk: 0.97 },
};

/** Posture effects on the attacking power and the defence (partida.md, "Táticas"). */
export const POSTURE_EFFECTS: {
  readonly [P in Posture]: { readonly power: number; readonly def: number };
} = {
  defensive: { power: 0.95, def: 1.05 },
  balanced: { power: 1.0, def: 1.0 },
  attacking: { power: 1.05, def: 0.95 },
  allOut: { power: 1.1, def: 0.85 },
};

/**
 * Pressure effect on the midfield (partida.md, "Táticas"). The energy drain and the card
 * multipliers of the same table belong to the match (T-009, T-010) and are added there.
 */
export const PRESSURE_EFFECTS: { readonly [P in Pressure]: { readonly mid: number } } = {
  low: { mid: 0.96 },
  medium: { mid: 1.0 },
  high: { mid: 1.05 },
};

/** `moraleMult = 0.95 + 0.10 × moral / 100` (moral 0 → 0.95; 50 → 1.00; 100 → 1.05). */
export const MORALE_MULT = { base: 0.95, span: 0.1 } as const;
/** `condMult = 0.80 + 0.20 × energy / 100` (energy 100 → 1.00; 70 → 0.94). */
export const CONDITION_MULT = { base: 0.8, span: 0.2 } as const;
/** Players on the pitch of a full team; `faltando(t)` counts from here. */
export const STARTERS_COUNT = 11;

/** Morale multiplier of the effective rating; the morale is clipped to 0..100. */
export function moraleMultiplier(morale: number): number {
  return MORALE_MULT.base + (MORALE_MULT.span * clamp(morale, 0, 100)) / 100;
}

/** Condition multiplier of the effective rating; the energy is clipped to 0..100. */
export function conditionMultiplier(energy: number): number {
  return CONDITION_MULT.base + (CONDITION_MULT.span * clamp(energy, 0, 100)) / 100;
}

/**
 * Effective rating of a player in a slot (partida.md, "Nota efetiva"):
 * `eff = overall × fit(natural, slot) × moraleMult × condMult`. `energy` is the energy on the
 * pitch: before the kick-off it is the player's condition (the default); the match lowers it
 * minute by minute (T-009).
 */
export function effectiveRating(
  player: Pick<Player, 'position' | 'overall' | 'morale' | 'condition'>,
  slot: Position,
  energy: number = player.condition,
): number {
  return (
    player.overall *
    fit(player.position, slot) *
    moraleMultiplier(player.morale) *
    conditionMultiplier(energy)
  );
}

/**
 * Home advantage of the home team (partida.md, "Mando de campo e clássico"; ADR-0005, ADR-0011):
 * `match.homeBase + fans.homeBonusMin + (fans.homeBonusMax − fans.homeBonusMin) × fans / 100`,
 * plus `fans.derbyBonus` in a derby. `fans` is the home club's thermometer, clipped to 0..100.
 * The away team (and both teams on neutral ground) get 0: that choice is the caller's.
 */
export function homeAdvantage(
  context: { readonly fans: number; readonly derby: boolean },
  params: Pick<GameParams, 'match' | 'fans'>,
): number {
  const { homeBonusMin, homeBonusMax, derbyBonus } = params.fans;
  const crowd = homeBonusMin + ((homeBonusMax - homeBonusMin) * clamp(context.fans, 0, 100)) / 100;
  return params.match.homeBase + crowd + (context.derby ? derbyBonus : 0);
}

/** The inputs of `T(t)` that change with the match situation. */
export interface StrengthFactors {
  /** `home(t)`: {@link homeAdvantage} for the home team, 0 for the away team. */
  readonly home: number;
  /** `faltando(t)`: players short of 11 (red cards, injuries without a substitute). Default 0. */
  readonly missing?: number;
  /** `halftimeBoost(t)` of the half-time talk, e.g. 0.03 for +3% (T-009). Default 0. */
  readonly halftimeBoost?: number;
}

/**
 * `T(t) = (1 + home) × (1 − match.missingPlayerPenalty × faltando) × (1 + halftimeBoost)`. The
 * middle factor never goes below 0, so a strange input cannot make a strength negative.
 */
export function teamFactor(
  factors: StrengthFactors,
  match: Pick<MatchParams, 'missingPlayerPenalty'>,
): number {
  const missing = factors.missing ?? 0;
  const halftimeBoost = factors.halftimeBoost ?? 0;
  const shortHanded = Math.max(0, 1 - match.missingPlayerPenalty * missing);
  return (1 + factors.home) * shortHanded * (1 + halftimeBoost);
}

/** Strengths of a team at a moment of the match, before the day form (T-009). */
export interface TeamStrengths {
  /** `eff` of the player in the goalkeeper slot (`gkEff` of the opponent's finishing). */
  readonly goalkeeper: number;
  /** `Def(t)`, `Mid(t)`, `Atk(t)`. */
  readonly def: number;
  readonly mid: number;
  readonly atk: number;
  /** `Power(t) = (midWeight × Mid + (1 − midWeight) × Atk) × posture.power`. */
  readonly power: number;
  /** `Defense(t) = Def × posture.def`. */
  readonly defense: number;
  /** `T(t)`, already applied to the three sectors. */
  readonly factor: number;
}

/** What the strength needs from the tactic; a `TeamSheet` tactic fits, and so does `allOut`. */
export interface StrengthTactic {
  readonly posture: Posture;
  readonly pressure: Pressure;
}

/**
 * Sector strengths from the effective ratings of the 11 slots, in slot order of the formation.
 * The building block of {@link sectorStrengths}, for the match loop that keeps the ratings up to
 * date minute by minute. `ratings` must have one value per slot; a different length is a
 * programming error (the validated entry point is {@link sectorStrengths}).
 */
export function strengthsFromRatings(
  formation: Formation,
  tactic: StrengthTactic,
  ratings: readonly number[],
  factors: StrengthFactors,
  match: Pick<MatchParams, 'midWeight' | 'missingPlayerPenalty'>,
): TeamStrengths {
  const sectors = FORMATION_SECTORS[formation];
  if (ratings.length !== sectors.length) {
    throw new RangeError(
      `expected ${sectors.length} ratings for ${formation}, got ${ratings.length}`,
    );
  }
  const sum = { gk: 0, def: 0, mid: 0, atk: 0 };
  const count = { gk: 0, def: 0, mid: 0, atk: 0 };
  for (let i = 0; i < sectors.length; i++) {
    const sector = sectors[i]!;
    sum[sector] += ratings[i]!;
    count[sector] += 1;
  }
  const t = teamFactor(factors, match);
  const shape = FORMATION_MULTIPLIERS[formation];
  const posture = POSTURE_EFFECTS[tactic.posture];
  const def = (sum.def / count.def) * shape.def * t;
  const mid = (sum.mid / count.mid) * shape.mid * PRESSURE_EFFECTS[tactic.pressure].mid * t;
  const atk = (sum.atk / count.atk) * shape.atk * t;
  return {
    goalkeeper: sum.gk / count.gk,
    def,
    mid,
    atk,
    power: (match.midWeight * mid + (1 - match.midWeight) * atk) * posture.power,
    defense: def * posture.def,
    factor: t,
  };
}

/** Why a lineup cannot be measured (the `detail` of `invalid-lineup`). */
export type LineupProblem =
  | { reason: 'no-formation'; formation: string }
  | { reason: 'wrong-count'; count: number }
  | { reason: 'duplicate'; player: PlayerId }
  | { reason: 'unknown-player'; player: PlayerId }
  | { reason: 'unavailable'; player: PlayerId };

/** The part of a team sheet the strength reads: formation and starters, posture and pressure. */
export interface StrengthSheet {
  readonly lineup: Pick<Lineup, 'formation' | 'starters'>;
  readonly tactic: StrengthTactic;
}

/** Match situation of a team for {@link sectorStrengths}. */
export interface StrengthContext extends StrengthFactors {
  /** Energy on the pitch by player; a player not listed uses their condition. */
  readonly energy?: Readonly<Record<PlayerId, number>>;
}

function isFormation(value: string): value is Formation {
  return Object.prototype.hasOwnProperty.call(FORMATION_SLOTS, value);
}

/** Injured or suspended players are not fit to play (jogadores.md, "Estados que mudam"). */
function isAvailable(player: Pick<Player, 'injuryRounds' | 'suspendedGames'>): boolean {
  return player.injuryRounds <= 0 && player.suspendedGames <= 0;
}

/**
 * Sector strengths of a team sheet (US-007): the effective rating of each starter in their slot,
 * the sector means with the formation, posture and pressure, and `T(t)`. `squad` is the club's
 * squad (as in `TeamInput.players`).
 *
 * Never throws on a game situation: a sheet without 11 distinct, available players of the squad
 * in a known formation returns `invalid-lineup`, with the first problem found as `detail`
 * (checked in this order: formation, count, then each starter in slot order). Replacing an
 * unavailable starter is the match's job (partida.md, "Casos de borda"; T-010), not this one.
 */
export function sectorStrengths(
  squad: readonly Player[],
  sheet: StrengthSheet,
  context: StrengthContext,
  params: Pick<GameParams, 'match'>,
): Result<TeamStrengths, 'invalid-lineup'> {
  const { formation, starters } = sheet.lineup;
  if (!isFormation(formation)) {
    return fail('invalid-lineup', { reason: 'no-formation', formation } satisfies LineupProblem);
  }
  const slots = FORMATION_SLOTS[formation];
  if (starters.length !== slots.length) {
    return fail('invalid-lineup', {
      reason: 'wrong-count',
      count: starters.length,
    } satisfies LineupProblem);
  }
  const byId = new Map<PlayerId, Player>();
  for (const player of squad) byId.set(player.id, player);
  const seen = new Set<PlayerId>();
  const ratings: number[] = [];
  for (let i = 0; i < slots.length; i++) {
    const id = starters[i]!;
    if (seen.has(id)) {
      return fail('invalid-lineup', { reason: 'duplicate', player: id } satisfies LineupProblem);
    }
    seen.add(id);
    const player = byId.get(id);
    if (player === undefined) {
      return fail('invalid-lineup', {
        reason: 'unknown-player',
        player: id,
      } satisfies LineupProblem);
    }
    if (!isAvailable(player)) {
      return fail('invalid-lineup', { reason: 'unavailable', player: id } satisfies LineupProblem);
    }
    ratings.push(effectiveRating(player, slots[i]!, context.energy?.[id] ?? player.condition));
  }
  return ok(strengthsFromRatings(formation, sheet.tactic, ratings, context, params.match));
}

/**
 * Displayed strength of a club (docs/02-architecture.md, 4.1; balance-targets.md, "Força" de um
 * time): the mean of `overall × fit` of the 11 starters, without condition, morale nor home
 * advantage. A real number in 0..99 (overall ≤ 99, fit ≤ 1); the interface rounds it for display.
 *
 * - With `lineup`: its formation and its 11 starters, which must be distinct players of the
 *   club's squad. Availability is not checked here (that is `validateLineup`, T-011).
 * - Without `lineup`: the best XI of the available players (not injured, not suspended) in the
 *   club's first preferred formation, picked as the AI does with everyone fresh (`bestEleven`).
 *
 * `undefined` when there is no answer: unknown club, a lineup that is not 11 distinct players of
 * the club in a known formation, or fewer than 11 available players.
 */
export function teamStrength(
  state: Pick<GameState, 'clubs' | 'players' | 'squads'>,
  clubId: ClubId,
  lineup?: Pick<Lineup, 'formation' | 'starters'>,
): number | undefined {
  const club = state.clubs[clubId];
  if (club === undefined) return undefined;
  const squadIds = state.squads[clubId] ?? [];

  if (lineup === undefined) {
    const available: Player[] = [];
    for (const id of squadIds) {
      const player = state.players[id];
      if (player !== undefined && isAvailable(player)) available.push(player);
    }
    const eleven = bestEleven(available, club.preferredFormations[0]);
    return eleven.length === STARTERS_COUNT ? elevenStrength(eleven) : undefined;
  }

  if (!isFormation(lineup.formation)) return undefined;
  const slots = FORMATION_SLOTS[lineup.formation];
  if (lineup.starters.length !== slots.length) return undefined;
  const inSquad = new Set(squadIds);
  const seen = new Set<PlayerId>();
  const eleven: { player: Player; slot: Position }[] = [];
  for (let i = 0; i < slots.length; i++) {
    const id = lineup.starters[i]!;
    const player = state.players[id];
    if (seen.has(id) || !inSquad.has(id) || player === undefined) return undefined;
    seen.add(id);
    eleven.push({ player, slot: slots[i]! });
  }
  return elevenStrength(eleven);
}
