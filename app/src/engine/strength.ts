import { FORMATION_SLOTS } from './formations.ts';
import type { GameState } from './game.ts';
import { bestEleven, elevenStrength } from './generation.ts';
import type { Lineup } from './lineup.ts';
import { clamp } from './math.ts';
import type { GameParams, MatchParams } from './params.ts';
import { attributeOf, fit, type Player } from './players.ts';
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
/** Index of the goalkeeper slot in every formation (`FORMATION_SLOTS[f][0]` is always `GK`). */
export const GOALKEEPER_SLOT = 0;
/**
 * A sector with nobody left plays at this share of the mean outfield `eff` (partida.md, "Vaga
 * vazia"): the "improvisado" fit of the position table (0.90), as someone covers the role.
 */
export const EMPTY_SECTOR_FIT = 0.9;

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
 * `T(t) = (1 + home) × (1 − match.missingPlayerPenalty × faltando) × (1 + halftimeBoost)`.
 * Strange inputs cannot make a strength negative or NaN: `missing` is clipped to 0..11 and
 * `halftimeBoost` to −1 or more (NaN counts as the lower end of each), and the middle factor
 * never goes below 0.
 */
export function teamFactor(
  factors: StrengthFactors,
  match: Pick<MatchParams, 'missingPlayerPenalty'>,
): number {
  const missing = clamp(factors.missing ?? 0, 0, STARTERS_COUNT);
  const halftimeBoost = clamp(factors.halftimeBoost ?? 0, -1, Number.POSITIVE_INFINITY);
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
 * The inputs of `T(t)` for {@link strengthsFromRatings}: `faltando(t)` is not one of them,
 * because it is always the number of empty slots ("Vaga vazia": with N on the pitch, exactly
 * 11 − N slots are empty).
 */
export type RatingFactors = Omit<StrengthFactors, 'missing'>;

/**
 * Sector strengths from the effective ratings of the 11 slots, in slot order of the formation
 * (partida.md, "Forças de setor" and "Vaga vazia"). The building block of
 * {@link sectorStrengths}, for the match loop that keeps the ratings up to date minute by minute.
 *
 * An `undefined` rating is an empty slot (red card, injury without a substitute):
 * - each sector mean is over its occupied slots only, and every empty slot counts once in
 *   `faltando(t)` of `T(t)`;
 * - a sector with nobody left is worth `EMPTY_SECTOR_FIT × mean(eff of every outfield player on
 *   the pitch)`, still times `formation.*`, `pressure.mid` (midfield) and `T(t)`;
 * - with no outfield player at all (never in a match: it ends below 7) an empty sector is 0, so
 *   nothing is ever NaN.
 *
 * Programming errors (they throw): `ratings` of a length other than 11, or an empty goalkeeper
 * slot (the caller first sends an outfield player to goal with {@link fillEmptyGoal}).
 */
export function strengthsFromRatings(
  formation: Formation,
  tactic: StrengthTactic,
  ratings: readonly (number | undefined)[],
  factors: RatingFactors,
  match: Pick<MatchParams, 'midWeight' | 'missingPlayerPenalty'>,
): TeamStrengths {
  const sectors = FORMATION_SECTORS[formation];
  if (ratings.length !== sectors.length) {
    throw new RangeError(
      `expected ${sectors.length} ratings for ${formation}, got ${ratings.length}`,
    );
  }
  // Plain locals instead of records keyed by sector: the match calls this twice a minute (T-009).
  let gkSum = 0;
  let defSum = 0;
  let midSum = 0;
  let atkSum = 0;
  let gkCount = 0;
  let defCount = 0;
  let midCount = 0;
  let atkCount = 0;
  let empty = 0;
  for (let i = 0; i < sectors.length; i++) {
    const rating = ratings[i];
    if (rating === undefined) {
      empty += 1;
      continue;
    }
    const sector = sectors[i]!;
    if (sector === 'def') {
      defSum += rating;
      defCount += 1;
    } else if (sector === 'mid') {
      midSum += rating;
      midCount += 1;
    } else if (sector === 'atk') {
      atkSum += rating;
      atkCount += 1;
    } else {
      gkSum += rating;
      gkCount += 1;
    }
  }
  if (gkCount === 0) {
    throw new RangeError('the goalkeeper slot is empty: call fillEmptyGoal first');
  }
  const outfield = defCount + midCount + atkCount;
  const outfieldMean = outfield > 0 ? (defSum + midSum + atkSum) / outfield : 0;
  const mean = (sum: number, count: number) =>
    count > 0 ? sum / count : EMPTY_SECTOR_FIT * outfieldMean;

  const t = teamFactor({ ...factors, missing: empty }, match);
  const shape = FORMATION_MULTIPLIERS[formation];
  const posture = POSTURE_EFFECTS[tactic.posture];
  const def = mean(defSum, defCount) * shape.def * t;
  const mid = mean(midSum, midCount) * shape.mid * PRESSURE_EFFECTS[tactic.pressure].mid * t;
  const atk = mean(atkSum, atkCount) * shape.atk * t;
  return {
    goalkeeper: gkSum / gkCount,
    def,
    mid,
    atk,
    power: (match.midWeight * mid + (1 - match.midWeight) * atk) * posture.power,
    defense: def * posture.def,
    factor: t,
  };
}

/**
 * The goalkeeper slot never stays empty (partida.md, "Vaga vazia" and "Casos de borda"): when it
 * is, the outfield player on the pitch with the highest `physical` moves to goal and **his** slot
 * becomes the empty one. Ties keep the first in slot order. `slots` are the occupants of the 11
 * slots in formation order (`undefined` = empty); returns a new array and the index of the slot
 * that was vacated (`undefined` when nothing moved: the goalkeeper is there, or no one is left on
 * the outfield).
 */
export function fillEmptyGoal<T extends Pick<Player, 'attributes' | 'overall'>>(
  slots: readonly (T | undefined)[],
): { slots: (T | undefined)[]; vacated?: number } {
  const result = [...slots];
  if (result[GOALKEEPER_SLOT] !== undefined) return { slots: result };
  let best = -1;
  let bestPhysical = -1;
  for (let i = 0; i < result.length; i++) {
    const occupant = result[i];
    if (i === GOALKEEPER_SLOT || occupant === undefined) continue;
    const physical = attributeOf(occupant, 'physical');
    if (physical > bestPhysical) {
      best = i;
      bestPhysical = physical;
    }
  }
  if (best < 0) return { slots: result };
  result[GOALKEEPER_SLOT] = result[best];
  result[best] = undefined;
  return { slots: result, vacated: best };
}

/**
 * Why a lineup cannot be measured (the `detail` of `invalid-lineup`), with the reasons of
 * `validateLineup` (docs/02-architecture.md, 4.1): `wrong-club` is a starter who is not in the
 * club's squad.
 */
export type LineupProblem =
  | { reason: 'no-formation'; formation: string }
  | { reason: 'wrong-count'; count: number }
  | { reason: 'duplicate'; player: PlayerId }
  | { reason: 'wrong-club'; player: PlayerId }
  | { reason: 'unavailable'; player: PlayerId };

/**
 * Result of {@link sectorStrengths}: a `Result<TeamStrengths, 'invalid-lineup'>` whose `detail`
 * is typed, so callers read the reason without a cast.
 */
type StrengthsBase = Result<TeamStrengths, 'invalid-lineup'>;
export type StrengthsResult =
  | Extract<StrengthsBase, { ok: true }>
  | (Extract<StrengthsBase, { ok: false }> & { detail: LineupProblem });

/** The part of a team sheet the strength reads: formation and starters, posture and pressure. */
export interface StrengthSheet {
  readonly lineup: Pick<Lineup, 'formation' | 'starters'>;
  readonly tactic: StrengthTactic;
}

/** Match situation of a team for {@link sectorStrengths} (always 11 on the pitch). */
export interface StrengthContext extends RatingFactors {
  /** Energy on the pitch by player; a player not listed uses their condition. */
  readonly energy?: Readonly<Record<PlayerId, number>>;
}

function isFormation(value: string): value is Formation {
  return Object.prototype.hasOwnProperty.call(FORMATION_SLOTS, value);
}

/** Injured or suspended players are not fit to play (jogadores.md, "Estados que mudam"). */
export function isAvailable(player: Pick<Player, 'injuryRounds' | 'suspendedGames'>): boolean {
  return player.injuryRounds <= 0 && player.suspendedGames <= 0;
}

/**
 * The checks shared by {@link sectorStrengths} and {@link teamStrength}: a known formation,
 * `count` distinct starters (11 by default), each found by `lookup` (the club's squad) and, when
 * `requireAvailable`, neither injured nor suspended. Returns the starters with their slots (the
 * first `count` slots of the formation), or the first problem (formation, count, then each
 * starter in slot order). Shared with `validateLineup` (ai.ts, T-011), so the reasons and their
 * order are the same everywhere; only `validateLineup` passes a `count` below 11 (a squad with
 * fewer than 11 available players).
 */
export function resolveStarters(
  lineup: Pick<Lineup, 'formation' | 'starters'>,
  lookup: (id: PlayerId) => Player | undefined,
  requireAvailable: boolean,
  count: number = STARTERS_COUNT,
): { formation: Formation; eleven: { player: Player; slot: Position }[] } | LineupProblem {
  const { formation, starters } = lineup;
  if (!isFormation(formation)) return { reason: 'no-formation', formation };
  const slots = FORMATION_SLOTS[formation];
  if (starters.length !== count) return { reason: 'wrong-count', count: starters.length };
  const seen = new Set<PlayerId>();
  const eleven: { player: Player; slot: Position }[] = [];
  for (let i = 0; i < starters.length; i++) {
    const id = starters[i]!;
    if (seen.has(id)) return { reason: 'duplicate', player: id };
    seen.add(id);
    const player = lookup(id);
    if (player === undefined) return { reason: 'wrong-club', player: id };
    if (requireAvailable && !isAvailable(player)) return { reason: 'unavailable', player: id };
    eleven.push({ player, slot: slots[i]! });
  }
  return { formation, eleven };
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
): StrengthsResult {
  const byId = new Map<PlayerId, Player>();
  for (const player of squad) byId.set(player.id, player);
  const resolved = resolveStarters(sheet.lineup, (id) => byId.get(id), true);
  if ('reason' in resolved) return { ok: false, error: 'invalid-lineup', detail: resolved };
  const ratings = resolved.eleven.map(({ player, slot }) =>
    effectiveRating(player, slot, context.energy?.[player.id] ?? player.condition),
  );
  const value = strengthsFromRatings(
    resolved.formation,
    sheet.tactic,
    ratings,
    context,
    params.match,
  );
  return { ok: true, value, warnings: [] };
}

/**
 * The XI that the displayed strength of a club reads when no lineup is given: today the best XI
 * of the available players (not injured, not suspended) in the club's first preferred formation
 * (`4-4-2` if that one is unknown), everyone fresh (`bestEleven`); the T-013 makes it read
 * `lastSheets`. Fewer than 11 entries when fewer than 11 are available; undefined for an unknown
 * club. {@link teamStrength} and the AI's view of the opponent (ai.ts, `Δ`) both read it, so they
 * never diverge.
 */
export function shownEleven(
  state: Pick<GameState, 'clubs' | 'players' | 'squads'>,
  clubId: ClubId,
): { player: Player; slot: Position }[] | undefined {
  const club = state.clubs[clubId];
  if (club === undefined) return undefined;
  const available: Player[] = [];
  for (const id of state.squads[clubId] ?? []) {
    const player = state.players[id];
    if (player !== undefined && isAvailable(player)) available.push(player);
  }
  const first = club.preferredFormations[0];
  return bestEleven(available, isFormation(first) ? first : '4-4-2');
}

/**
 * Displayed strength of a club (docs/02-architecture.md, 4.1; balance-targets.md, "Força" de um
 * time): the mean of `overall × fit` of the 11 starters, without condition, morale nor home
 * advantage. A real number in 0..99 (overall ≤ 99, fit ≤ 1); the interface rounds it for display.
 *
 * - With `lineup`: its formation and its 11 starters, which must be distinct players of the
 *   club's squad. Availability is not checked here (that is `validateLineup`, ai.ts).
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
    const eleven = shownEleven(state, clubId);
    return eleven !== undefined && eleven.length === STARTERS_COUNT
      ? elevenStrength(eleven)
      : undefined;
  }

  const inSquad = new Set(squadIds);
  const resolved = resolveStarters(
    lineup,
    (id) => (inSquad.has(id) ? state.players[id] : undefined),
    false,
  );
  return 'reason' in resolved ? undefined : elevenStrength(resolved.eleven);
}
