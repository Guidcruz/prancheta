import type { PlayersParams } from './params.ts';
import { clamp } from './math.ts';
import type { Rng } from './rng.ts';
import type { ClubId, PlayerId, Position, Result, Trait } from './types.ts';

/*
 * Player model (docs/02-architecture.md, 4.1; docs/design/jogadores.md; ADR-0012). Types, rule
 * tables and pure functions: the nominal rating (`overall`) by position, the out-of-position table
 * (`fit`), the trait and potential draws, the "promessa" label and the structural validator.
 *
 * Name and face are resolved once, when a player is created, by an IdentitySource received as an
 * argument (ADR-0012); the engine never imports lib/ nor content/. Squad generation, the joia
 * and the idol live in generation.ts and `newGame` in game.ts (T-006); evolution at the end of
 * the season is T-017.
 */

/** Attributes of outfield players (docs/design/jogadores.md, "Atributos e nota geral"). */
export type OutfieldAttributeKey =
  'speed' | 'technique' | 'passing' | 'finishing' | 'marking' | 'physical';
/** Attributes of goalkeepers; `physical` is shared with outfield players. */
export type GoalkeeperAttributeKey =
  'reflexes' | 'positioning' | 'aerial' | 'rushing' | 'distribution' | 'physical';
export type AttributeKey = OutfieldAttributeKey | GoalkeeperAttributeKey;

/**
 * The six attributes of a player, 1..99. Which six depends on the position (outfield or
 * goalkeeper; see {@link attributeKeysFor}), so the record is partial at type level and
 * {@link validatePlayer} demands exactly the six of the player's position.
 */
export type PlayerAttributes = Readonly<Partial<Record<AttributeKey, number>>>;

/** Name of a player as shown and stored (ADR-0012); produced outside the engine. */
export interface PlayerNameText {
  /** Name shown in the UI. */
  readonly display: string;
  /** "First Surname" or "First Surname Surname2". */
  readonly full: string;
  /** First surname (squad rule of at most 3 per surname). */
  readonly family: string;
}

/** What an IdentitySource returns for each new player (ADR-0012). */
export interface PlayerIdentity extends PlayerNameText {
  /** Only to generate again (`renameRetired`); never to display. */
  readonly nameSeed: number;
  /** Idem, for the face. */
  readonly faceSeed: number;
  /** Encoded face spec (T-027), opaque to the engine, at most {@link FACE_MAX_LENGTH} chars. */
  readonly face: string;
}

/**
 * Source of names and faces (ADR-0012): a pure function received by argument. The game uses
 * lib/generators/identity.ts (T-006); the engine tests use `engine/testing/identity.ts`, so
 * changing the name lists never changes a golden nor ENGINE_VERSION.
 */
export interface IdentitySource {
  /** Revision of content/names/retired.json; copied to GameState.retiredNamesRev. */
  readonly retiredRev: number;
  squad(req: {
    seed: number;
    /** ISO 3166-1 alpha-2. */
    nationality: string;
    count: number;
    /** Current squad, for the rules on repeated names and surnames. */
    existing: readonly PlayerNameText[];
  }): PlayerIdentity[];
}

/** A player of the career (docs/02-architecture.md, 4.1). Read-only: updates return copies. */
export interface Player {
  readonly id: PlayerId;
  readonly clubId: ClubId;
  /** Only to generate (and regenerate in renameRetired); never to display (ADR-0012). */
  readonly nameSeed: number;
  readonly faceSeed: number;
  /** Resolved at creation by the IdentitySource and stored. */
  readonly name: PlayerNameText;
  /** Encoded FaceSpec (T-027), opaque to the engine, at most {@link FACE_MAX_LENGTH} chars. */
  readonly face: string;
  /** ISO 3166-1 alpha-2; name and face are generated outside the engine. */
  readonly nationality: string;
  /** Natural position. */
  readonly position: Position;
  readonly attributes: PlayerAttributes;
  /** Always `computeOverall(position, attributes)`. */
  readonly overall: number;
  /** Ceiling of `overall`, hidden in the UI (only the "promessa" label shows). */
  readonly potential: number;
  readonly age: number;
  /** Personal age curve: drawn in {@link PEAK_AGE_RANGE}. */
  readonly peakAge: number;
  /** Personal growth multiplier: drawn in [players.growthMin, players.growthMax]. */
  readonly growth: number;
  readonly trait: Trait;
  readonly shirt: number;
  /** 0..100; starts at 100. */
  readonly condition: number;
  /** 0..100. */
  readonly morale: number;
  readonly injuryRounds: number;
  readonly suspendedGames: number;
  /** Resets on reaching 3 (which suspends) and at the end of the season, so 0..2. */
  readonly yellowCount: number;
  /** Last {@link RECENT_RATINGS_MAX} match ratings, 3..10, oldest first (form; display only). */
  readonly recentRatings: readonly number[];
  /** Rounds in a row he expected to play and did not take the pitch (round.ts, T-014). */
  readonly benchStreak: number;
  readonly clubAppearances: number;
}

// ---------------------------------------------------------------------------------------------
// Rule constants (docs/design/jogadores.md, "Parâmetros" › "Constantes": rules, not /balance knobs)

export const POSITIONS: readonly Position[] = ['GK', 'CB', 'FB', 'DM', 'AM', 'ST'];

export const OUTFIELD_ATTRIBUTES: readonly OutfieldAttributeKey[] = [
  'speed',
  'technique',
  'passing',
  'finishing',
  'marking',
  'physical',
];
export const GOALKEEPER_ATTRIBUTES: readonly GoalkeeperAttributeKey[] = [
  'reflexes',
  'positioning',
  'aerial',
  'rushing',
  'distribution',
  'physical',
];

/** Valid value of every attribute and of `overall`, inclusive. */
export const ATTRIBUTE_RANGE: { readonly min: number; readonly max: number } = { min: 1, max: 99 };

/**
 * Weights of the natural position in `overall`, in hundredths (0.15 → 15), so the sum is exact
 * integer arithmetic. Each row adds up to 100 (docs/design/jogadores.md, weights table).
 */
export const OVERALL_WEIGHTS: {
  readonly [P in Position]: Readonly<
    Record<P extends 'GK' ? GoalkeeperAttributeKey : OutfieldAttributeKey, number>
  >;
} = {
  GK: { reflexes: 30, positioning: 25, aerial: 15, rushing: 15, distribution: 5, physical: 10 },
  CB: { speed: 15, technique: 10, passing: 10, finishing: 0, marking: 40, physical: 25 },
  FB: { speed: 30, technique: 10, passing: 20, finishing: 0, marking: 25, physical: 15 },
  DM: { speed: 10, technique: 15, passing: 25, finishing: 0, marking: 30, physical: 20 },
  AM: { speed: 15, technique: 30, passing: 30, finishing: 15, marking: 0, physical: 10 },
  ST: { speed: 20, technique: 20, passing: 5, finishing: 40, marking: 0, physical: 15 },
};

/**
 * Out-of-position table: `FIT[natural][slot]` (docs/design/jogadores.md, "Jogador fora da
 * posição"). Not symmetric: a centre-back plays as attacker at 0.70, an attacker as centre-back
 * at 0.65.
 */
export const FIT: { readonly [N in Position]: { readonly [S in Position]: number } } = {
  GK: { GK: 1, CB: 0.4, FB: 0.4, DM: 0.4, AM: 0.4, ST: 0.4 },
  CB: { GK: 0.4, CB: 1, FB: 0.9, DM: 0.9, AM: 0.75, ST: 0.7 },
  FB: { GK: 0.4, CB: 0.9, FB: 1, DM: 0.85, AM: 0.85, ST: 0.75 },
  DM: { GK: 0.4, CB: 0.9, FB: 0.85, DM: 1, AM: 0.9, ST: 0.75 },
  AM: { GK: 0.4, CB: 0.7, FB: 0.8, DM: 0.9, AM: 1, ST: 0.9 },
  ST: { GK: 0.4, CB: 0.65, FB: 0.75, DM: 0.75, AM: 0.9, ST: 1 },
};

/** Smallest `fit` still shown as "improvisado" (0.85 to 0.90); below it, "fora de posição". */
export const IMPROVISED_MIN_FIT = 0.85;

/**
 * Chance of each trait drawn at generation (docs/design/jogadores.md, "Traço de personalidade").
 * `quiet` takes the rest (55%). `idol` is never drawn: T-006 gives it to one player per club.
 */
export const TRAIT_CHANCES: Readonly<Record<'leader' | 'hothead' | 'professional', number>> = {
  leader: 0.1,
  hothead: 0.15,
  professional: 0.2,
};
/** Order of the cumulative draw in {@link drawTrait}; part of the determinism contract. */
const DRAWN_TRAITS = ['leader', 'hothead', 'professional'] as const;

export const TRAITS: readonly Trait[] = ['leader', 'hothead', 'professional', 'idol', 'quiet'];

/** Ceiling of `potential` at generation (docs/design/jogadores.md, "Potencial"). */
export const POTENTIAL_MAX = 95;
/**
 * Ceiling of a stored `potential` ("Limites dos campos"): 95 is only the generation cap, and a
 * legitimate save (an overall above 95 keeps potential = overall) must never be refused.
 */
export const POTENTIAL_STORED_MAX = 99;
/** Valid stored `age`: generation gives 17..34; the rest is sanity for long careers. */
export const AGE_RANGE: { readonly min: number; readonly max: number } = { min: 15, max: 60 };
/** Valid shirt number (unique per club, checked where the squad is built, T-006). */
export const SHIRT_RANGE: { readonly min: number; readonly max: number } = { min: 1, max: 99 };
/** Share of `overall` used for an attribute the player does not have ("Atributo ausente"). */
const MISSING_ATTRIBUTE_TENTHS = 4;
/** Up to this age the potential has the large headroom of youth. */
export const YOUTH_MAX_AGE = 23;
/** From 24 to this age the potential is `overall + Rng.int(0, 4)`; older, equal to overall. */
export const PRIME_MAX_AGE = 26;
const PRIME_MAX_HEADROOM = 4;

/** "Promessa": at most this age... */
export const PROSPECT_MAX_AGE = 23;
/** ...and at least this gap between potential and overall. */
export const PROSPECT_MIN_GAP = 10;

/** `peakAge` is drawn between these ages, inclusive (PROJETO.md via jogadores.md, "Evolução"). */
export const PEAK_AGE_RANGE: { readonly min: number; readonly max: number } = { min: 26, max: 29 };

/** Squad of 25 by natural position: 3 GK, 5 CB, 4 FB, 4 DM, 4 AM, 5 ST (jogadores.md). */
export const SQUAD_COMPOSITION: { readonly [P in Position]: number } = {
  GK: 3,
  CB: 5,
  FB: 4,
  DM: 4,
  AM: 4,
  ST: 5,
};
/** Size of every squad; comes from the composition, never from a parameter. */
export const SQUAD_SIZE = POSITIONS.reduce((sum, p) => sum + SQUAD_COMPOSITION[p], 0);

/** Valid `morale` and `condition`, inclusive. */
export const MORALE_RANGE: { readonly min: number; readonly max: number } = { min: 0, max: 100 };
export const CONDITION_RANGE: { readonly min: number; readonly max: number } = { min: 0, max: 100 };
/** Valid match rating (partida.md, "Nota do jogador"). */
export const RATING_RANGE: { readonly min: number; readonly max: number } = { min: 3, max: 10 };
/** Form is the average of the last five ratings. */
export const RECENT_RATINGS_MAX = 5;
/** Yellow cards that trigger a suspension; the counter resets on reaching it. */
export const YELLOWS_FOR_SUSPENSION = 3;
/** Longest encoded face (ADR-0012). */
export const FACE_MAX_LENGTH = 32;

// ---------------------------------------------------------------------------------------------
// Rules

/** The six attribute keys of a position, in the order of the design tables. */
export function attributeKeysFor(position: Position): readonly AttributeKey[] {
  return position === 'GK' ? GOALKEEPER_ATTRIBUTES : OUTFIELD_ATTRIBUTES;
}

/** Weight (0..1) of an attribute in the overall of a position; 0 when it does not belong. */
export function overallWeight(position: Position, key: AttributeKey): number {
  const row = OVERALL_WEIGHTS[position] as Readonly<Partial<Record<AttributeKey, number>>>;
  return (row[key] ?? 0) / 100;
}

/**
 * `overall = round(Σ weight × attribute)` with the weights of the natural position. Computed in
 * hundredths with integer attributes, so it is exact (no 76.4999… surprises) and halves round
 * up. A missing attribute counts as 0 (validatePlayer refuses such a player).
 */
export function computeOverall(position: Position, attributes: PlayerAttributes): number {
  const row = OVERALL_WEIGHTS[position] as Readonly<Partial<Record<AttributeKey, number>>>;
  let hundredths = 0;
  for (const key of attributeKeysFor(position)) {
    hundredths += (row[key] ?? 0) * (attributes[key] ?? 0);
  }
  return Math.floor((hundredths + 50) / 100);
}

/** How well a player of `natural` position performs in a `slot`: `overall × fit`. */
export function fit(natural: Position, slot: Position): number {
  return FIT[natural][slot];
}

export type FitLevel = 'natural' | 'improvised' | 'outOfPosition';

/**
 * Label of a fit in the UI: 1.00 no mark; 0.85 to 0.90 "improvisado"; below 0.85 "fora de
 * posição". The UI always pairs it with an icon and text, never colour alone.
 */
export function fitLevel(natural: Position, slot: Position): FitLevel {
  const value = fit(natural, slot);
  if (value >= 1) return 'natural';
  return value >= IMPROVISED_MIN_FIT ? 'improvised' : 'outOfPosition';
}

/**
 * Trait at generation: leader 10%, hothead 15%, professional 20%, quiet the rest. Consumes
 * exactly one draw. Never returns `idol` (assigned per club by T-006).
 */
export function drawTrait(rng: Rng): Exclude<Trait, 'idol'> {
  const u = rng.next();
  let limit = 0;
  for (const trait of DRAWN_TRAITS) {
    limit += TRAIT_CHANCES[trait];
    if (u < limit) return trait;
  }
  return 'quiet';
}

/**
 * Hidden potential at generation (docs/design/jogadores.md, "Geração de elencos" › Potencial):
 * - up to 23: `overall + round(U^1.5 × (30 − 2 × (age − 17)))`, `U = rng.next()` (one draw);
 * - 24 to 26: `overall + rng.int(0, 4)` (one draw);
 * - 27 or older: `overall` (no draw).
 * Capped at {@link POTENTIAL_MAX} and never below `overall`: a player whose overall is already
 * above 95 gets `potential = overall` (the cap never lowers it; US-004 demands potential ≥
 * overall). The "joia" floor is T-006.
 *
 * U^1.5 is computed as `U × √U`: `Math.sqrt` is correctly rounded on every JavaScript engine,
 * unlike `Math.pow` (ADR-0007, rule 9).
 */
export function drawPotential(rng: Rng, overall: number, age: number): number {
  let raw = overall;
  if (age <= YOUTH_MAX_AGE) {
    const u = rng.next();
    const headroom = Math.max(0, 30 - 2 * (age - 17));
    raw = overall + Math.round(u * Math.sqrt(u) * headroom);
  } else if (age <= PRIME_MAX_AGE) {
    raw = overall + rng.int(0, PRIME_MAX_HEADROOM);
  }
  return Math.max(overall, Math.min(POTENTIAL_MAX, raw));
}

/**
 * Personal age curve (docs/design/jogadores.md, "Evolução"): `peakAge = rng.int(26, 29)`, then
 * `growth` uniform in [players.growthMin, players.growthMax). Consumes exactly two draws.
 */
export function drawGrowthCurve(
  rng: Rng,
  players: PlayersParams,
): { peakAge: number; growth: number } {
  const peakAge = rng.int(PEAK_AGE_RANGE.min, PEAK_AGE_RANGE.max);
  const growth = players.growthMin + rng.next() * (players.growthMax - players.growthMin);
  return { peakAge, growth };
}

/**
 * Value of an attribute for the match (docs/design/jogadores.md, "Atributo ausente"): the
 * player's own when it belongs to their position, otherwise `clamp(round(0.4 × overall), 1, 99)`
 * (a goalkeeper of overall 70 finishes as 28). Integer arithmetic: 0.4 × overall never lands on
 * an exact half, and this avoids float drift anyway.
 */
export function attributeOf(
  player: Pick<Player, 'attributes' | 'overall'>,
  key: AttributeKey,
): number {
  const own = player.attributes[key];
  if (own !== undefined) return own;
  const rounded = Math.floor((MISSING_ATTRIBUTE_TENTHS * player.overall + 5) / 10);
  return clamp(rounded, ATTRIBUTE_RANGE.min, ATTRIBUTE_RANGE.max);
}

/**
 * Attribute keys of a position with weight > 0, from the heaviest down; ties keep the order of
 * the design table (so AM → technique, ST → finishing, GK → reflexes first).
 */
function weightedKeysByWeight(position: Position): AttributeKey[] {
  const keys = attributeKeysFor(position).filter((k) => overallWeight(position, k) > 0);
  // Array.prototype.sort is stable, so equal weights keep the table order.
  return keys.sort((a, b) => overallWeight(position, b) - overallWeight(position, a));
}

/**
 * Moves the attributes so that `computeOverall` gives exactly `target` (docs/design/jogadores.md,
 * "Ajuste ao alvo"), used by generation, the squad shift and evolution:
 * 1. coarse shift: `d = target − overall` is added to every attribute of weight > 0 (the weights
 *    add up to 1, so the formula moves by `d`), each clipped to 1..99;
 * 2. fine adjustment: while the formula is not the target, the heaviest attribute not yet at the
 *    edge (99 going up, 1 going down) moves 1 point toward it; ties by table order.
 * Each step moves the formula by at most 0.40, so it never overshoots, and every target in 1..99
 * is reachable. Attributes of weight 0 are left untouched. `target` is rounded and clipped to
 * 1..99; a missing attribute of the position starts at the target. Pure: returns a new record.
 */
export function fitAttributesToOverall(
  attributes: PlayerAttributes,
  position: Position,
  target: number,
): PlayerAttributes {
  const goal = clamp(Math.round(target), ATTRIBUTE_RANGE.min, ATTRIBUTE_RANGE.max);
  const order = weightedKeysByWeight(position);
  const result: Partial<Record<AttributeKey, number>> = { ...attributes };
  for (const key of order) {
    const start = Math.round(result[key] ?? goal);
    result[key] = clamp(start, ATTRIBUTE_RANGE.min, ATTRIBUTE_RANGE.max);
  }
  const d = goal - computeOverall(position, result);
  for (const key of order) {
    result[key] = clamp(result[key]! + d, ATTRIBUTE_RANGE.min, ATTRIBUTE_RANGE.max);
  }
  // Each step moves one attribute toward the target, so 99 × 6 steps always suffice, and some
  // attribute is off the edge while the formula misses a target in 1..99. Reaching either
  // throw below is a programming error, never a game situation.
  for (let steps = 0; computeOverall(position, result) !== goal; steps++) {
    if (steps >= 600) throw new Error(`fitAttributesToOverall did not converge to ${goal}`);
    const up = computeOverall(position, result) < goal;
    const edge = up ? ATTRIBUTE_RANGE.max : ATTRIBUTE_RANGE.min;
    const key = order.find((k) => result[k] !== edge);
    if (key === undefined) throw new Error(`fitAttributesToOverall cannot reach ${goal}`);
    result[key] = result[key]! + (up ? 1 : -1);
  }
  return result;
}

/** The "promessa" label: at most 23 years old and `potential − overall ≥ 10`. */
export function isProspect(player: Pick<Player, 'age' | 'overall' | 'potential'>): boolean {
  return player.age <= PROSPECT_MAX_AGE && player.potential - player.overall >= PROSPECT_MIN_GAP;
}

// ---------------------------------------------------------------------------------------------
// Validation

export type PlayerProblem =
  | 'not-an-object'
  | 'missing'
  | 'unknown-key'
  | 'not-a-string'
  | 'empty'
  | 'too-long'
  | 'not-a-number'
  | 'not-an-integer'
  | 'out-of-range'
  | 'not-a-list'
  | 'invalid-id'
  | 'invalid-nationality'
  | 'invalid-position'
  | 'invalid-trait'
  | 'overall-mismatch'
  | 'potential-below-overall'
  /** A getter or Proxy trap threw while reading the input. */
  | 'unreadable';

/**
 * One reason why a player was refused. `field` is dotted inside the player (`name.display`,
 * `attributes.finishing`, `recentRatings.2`), empty for the player itself.
 */
export interface PlayerIssue {
  field: string;
  problem: PlayerProblem;
  value?: unknown;
  range?: { min: number; max: number };
}

/** Result of {@link validatePlayer}: a `Result<Player, 'invalid-player'>` with typed detail. */
type PlayerBase = Result<Player, 'invalid-player'>;
export type PlayerResult =
  | Extract<PlayerBase, { ok: true }>
  | (Extract<PlayerBase, { ok: false }> & { detail: PlayerIssue[] });

const PLAYER_KEYS = [
  'id',
  'clubId',
  'nameSeed',
  'faceSeed',
  'name',
  'face',
  'nationality',
  'position',
  'attributes',
  'overall',
  'potential',
  'age',
  'peakAge',
  'growth',
  'trait',
  'shirt',
  'condition',
  'morale',
  'injuryRounds',
  'suspendedGames',
  'yellowCount',
  'recentRatings',
  'benchStreak',
  'clubAppearances',
] as const;
const NAME_KEYS = ['display', 'full', 'family'] as const;

/** Same slug rule as ClubDef ids (clubs.ts). */
const CLUB_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** `${clubId}#${n}`, n a non-negative integer without leading zeros. */
const PLAYER_ID = /^([a-z0-9]+(?:-[a-z0-9]+)*)#(0|[1-9][0-9]*)$/;
const NATIONALITY = /^[A-Z]{2}$/;
const UINT32_MAX = 0xffffffff;
/**
 * `growth` is drawn inside [players.growthMin, players.growthMax], whose widest valid bounds are
 * 0.5 and 1.5 (PARAM_RANGES). A stored player is checked against those bounds, not the current
 * parameters, so tuning the parameters never invalidates a save.
 */
const GROWTH_RANGE = { min: 0.5, max: 1.5 };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

class Issues {
  readonly list: PlayerIssue[] = [];

  add(issue: PlayerIssue): void {
    this.list.push(issue);
  }

  keys(prefix: string, value: Record<string, unknown>, keys: readonly string[]): void {
    for (const key of keys) {
      if (!Object.hasOwn(value, key)) this.add({ field: `${prefix}${key}`, problem: 'missing' });
    }
    for (const key of Object.keys(value)) {
      if (!keys.includes(key)) {
        this.add({ field: `${prefix}${key}`, problem: 'unknown-key', value: value[key] });
      }
    }
  }

  text(field: string, value: unknown, maxLength?: number): string | undefined {
    if (typeof value !== 'string') {
      this.add({ field, problem: 'not-a-string', value });
    } else if (value.trim() === '') {
      this.add({ field, problem: 'empty', value });
    } else if (maxLength !== undefined && value.length > maxLength) {
      this.add({ field, problem: 'too-long', value, range: { min: 1, max: maxLength } });
    } else {
      return value;
    }
    return undefined;
  }

  number(
    field: string,
    value: unknown,
    range: { min: number; max: number },
    integer: boolean,
  ): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      this.add({ field, problem: 'not-a-number', value });
    } else if (integer && !Number.isInteger(value)) {
      this.add({ field, problem: 'not-an-integer', value });
    } else if (value < range.min || value > range.max) {
      this.add({ field, problem: 'out-of-range', value, range: { ...range } });
    } else {
      return value;
    }
    return undefined;
  }
}

const COUNT = { min: 0, max: Number.MAX_SAFE_INTEGER };
const SEED = { min: 0, max: UINT32_MAX };

function checkName(issues: Issues, value: unknown): PlayerNameText | undefined {
  if (!isPlainObject(value)) {
    issues.add({ field: 'name', problem: 'not-an-object', value });
    return undefined;
  }
  issues.keys('name.', value, NAME_KEYS);
  const display = issues.text('name.display', value.display);
  const full = issues.text('name.full', value.full);
  const family = issues.text('name.family', value.family);
  return display !== undefined && full !== undefined && family !== undefined
    ? { display, full, family }
    : undefined;
}

function checkAttributes(
  issues: Issues,
  value: unknown,
  position: Position | undefined,
): PlayerAttributes | undefined {
  if (!isPlainObject(value)) {
    issues.add({ field: 'attributes', problem: 'not-an-object', value });
    return undefined;
  }
  // Without a valid position the expected six keys are unknown: only the values are checked.
  const keys = position === undefined ? Object.keys(value) : attributeKeysFor(position);
  if (position !== undefined) issues.keys('attributes.', value, keys);
  const attributes: Partial<Record<AttributeKey, number>> = {};
  let complete = position !== undefined;
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) continue;
    const n = issues.number(`attributes.${key}`, value[key], ATTRIBUTE_RANGE, true);
    if (n === undefined) complete = false;
    else attributes[key as AttributeKey] = n;
  }
  return complete ? attributes : undefined;
}

function checkRatings(issues: Issues, value: unknown): number[] | undefined {
  if (!Array.isArray(value)) {
    issues.add({ field: 'recentRatings', problem: 'not-a-list', value });
    return undefined;
  }
  if (value.length > RECENT_RATINGS_MAX) {
    const range = { min: 0, max: RECENT_RATINGS_MAX };
    issues.add({ field: 'recentRatings', problem: 'out-of-range', value: value.length, range });
    return undefined;
  }
  const ratings: number[] = [];
  let valid = true;
  // Indexed loop, so holes of a sparse array are checked (as undefined) instead of skipped.
  for (let i = 0; i < value.length; i++) {
    const n = issues.number(`recentRatings.${i}`, value[i] as unknown, RATING_RANGE, false);
    if (n === undefined) valid = false;
    else ratings.push(n);
  }
  return valid ? ratings : undefined;
}

/**
 * Structural validation of one player (a save being opened, a test fixture, the output of the
 * generator). Never throws; returns a fresh copy on success, or every issue found. Squad-level
 * rules (unique shirts, the composition, one idol) are checked where squads are built (T-006).
 */
export function validatePlayer(raw: unknown): PlayerResult {
  // A getter or Proxy trap that throws is input, not a programming error: never let it escape.
  try {
    return checkPlayer(raw);
  } catch {
    return { ok: false, error: 'invalid-player', detail: [{ field: '', problem: 'unreadable' }] };
  }
}

function checkPlayer(raw: unknown): PlayerResult {
  const issues = new Issues();
  if (!isPlainObject(raw)) {
    issues.add({ field: '', problem: 'not-an-object', value: raw });
    return { ok: false, error: 'invalid-player', detail: issues.list };
  }
  issues.keys('', raw, PLAYER_KEYS);
  const has = (key: string) => Object.hasOwn(raw, key);

  let clubId: string | undefined;
  if (has('clubId')) {
    if (typeof raw.clubId === 'string' && CLUB_ID.test(raw.clubId)) clubId = raw.clubId;
    else issues.add({ field: 'clubId', problem: 'invalid-id', value: raw.clubId });
  }
  let id: string | undefined;
  if (has('id')) {
    const match = typeof raw.id === 'string' ? PLAYER_ID.exec(raw.id) : null;
    // The id carries the club it was created in; it stays stable for the whole career, so it is
    // not compared with `clubId` (a transfer in Etapa 3 keeps the id).
    if (match !== null) id = raw.id as string;
    else issues.add({ field: 'id', problem: 'invalid-id', value: raw.id });
  }
  const nameSeed = has('nameSeed')
    ? issues.number('nameSeed', raw.nameSeed, SEED, true)
    : undefined;
  const faceSeed = has('faceSeed')
    ? issues.number('faceSeed', raw.faceSeed, SEED, true)
    : undefined;
  const name = has('name') ? checkName(issues, raw.name) : undefined;
  const face = has('face') ? issues.text('face', raw.face, FACE_MAX_LENGTH) : undefined;
  let nationality: string | undefined;
  if (has('nationality')) {
    if (typeof raw.nationality === 'string' && NATIONALITY.test(raw.nationality)) {
      nationality = raw.nationality;
    } else {
      issues.add({ field: 'nationality', problem: 'invalid-nationality', value: raw.nationality });
    }
  }
  let position: Position | undefined;
  if (has('position')) {
    if (POSITIONS.includes(raw.position as Position)) position = raw.position as Position;
    else issues.add({ field: 'position', problem: 'invalid-position', value: raw.position });
  }
  const attributes = has('attributes')
    ? checkAttributes(issues, raw.attributes, position)
    : undefined;
  const overall = has('overall')
    ? issues.number('overall', raw.overall, ATTRIBUTE_RANGE, true)
    : undefined;
  if (overall !== undefined && attributes !== undefined && position !== undefined) {
    const expected = computeOverall(position, attributes);
    if (expected !== overall) {
      const range = { min: expected, max: expected };
      issues.add({ field: 'overall', problem: 'overall-mismatch', value: overall, range });
    }
  }
  const potential = has('potential')
    ? issues.number(
        'potential',
        raw.potential,
        { min: ATTRIBUTE_RANGE.min, max: POTENTIAL_STORED_MAX },
        true,
      )
    : undefined;
  if (potential !== undefined && overall !== undefined && potential < overall) {
    issues.add({ field: 'potential', problem: 'potential-below-overall', value: potential });
  }
  const age = has('age') ? issues.number('age', raw.age, AGE_RANGE, true) : undefined;
  const peakAge = has('peakAge')
    ? issues.number('peakAge', raw.peakAge, PEAK_AGE_RANGE, true)
    : undefined;
  const growth = has('growth')
    ? issues.number('growth', raw.growth, GROWTH_RANGE, false)
    : undefined;
  let trait: Trait | undefined;
  if (has('trait')) {
    if (TRAITS.includes(raw.trait as Trait)) trait = raw.trait as Trait;
    else issues.add({ field: 'trait', problem: 'invalid-trait', value: raw.trait });
  }
  const shirt = has('shirt') ? issues.number('shirt', raw.shirt, SHIRT_RANGE, true) : undefined;
  const condition = has('condition')
    ? issues.number('condition', raw.condition, CONDITION_RANGE, false)
    : undefined;
  const morale = has('morale')
    ? issues.number('morale', raw.morale, MORALE_RANGE, false)
    : undefined;
  const count = (key: string) => (has(key) ? issues.number(key, raw[key], COUNT, true) : undefined);
  const injuryRounds = count('injuryRounds');
  const suspendedGames = count('suspendedGames');
  const yellowCount = has('yellowCount')
    ? issues.number(
        'yellowCount',
        raw.yellowCount,
        { min: 0, max: YELLOWS_FOR_SUSPENSION - 1 },
        true,
      )
    : undefined;
  const recentRatings = has('recentRatings') ? checkRatings(issues, raw.recentRatings) : undefined;
  const benchStreak = count('benchStreak');
  const clubAppearances = count('clubAppearances');

  if (issues.list.length > 0) return { ok: false, error: 'invalid-player', detail: issues.list };
  return {
    ok: true,
    warnings: [],
    value: {
      id: id!,
      clubId: clubId!,
      nameSeed: nameSeed!,
      faceSeed: faceSeed!,
      name: name!,
      face: face!,
      nationality: nationality!,
      position: position!,
      attributes: attributes!,
      overall: overall!,
      potential: potential!,
      age: age!,
      peakAge: peakAge!,
      growth: growth!,
      trait: trait!,
      shirt: shirt!,
      condition: condition!,
      morale: morale!,
      injuryRounds: injuryRounds!,
      suspendedGames: suspendedGames!,
      yellowCount: yellowCount!,
      recentRatings: recentRatings!,
      benchStreak: benchStreak!,
      clubAppearances: clubAppearances!,
    },
  };
}
