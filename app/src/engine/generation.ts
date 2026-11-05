import { FORMATIONS, FORMATION_SLOTS, PROFILE_FORMATIONS } from './formations.ts';
import { clamp, normal } from './math.ts';
import type { GameParams } from './params.ts';
import {
  ATTRIBUTE_RANGE,
  POSITIONS,
  POTENTIAL_MAX,
  SQUAD_COMPOSITION,
  SQUAD_SIZE,
  attributeKeysFor,
  computeOverall,
  drawGrowthCurve,
  drawPotential,
  drawTrait,
  fit,
  fitAttributesToOverall,
  overallWeight,
  validatePlayer,
  type AttributeKey,
  type IdentitySource,
  type Player,
  type PlayerAttributes,
  type PlayerNameText,
} from './players.ts';
import { Rng, seedFromString } from './rng.ts';
import type {
  AiProfile,
  ClubId,
  ClubSize,
  EngineWarning,
  Formation,
  PlayerId,
  Position,
  Trait,
} from './types.ts';

/*
 * Squad generation (docs/design/jogadores.md, "Geração de elencos"; T-006). Pure and seeded:
 * every club draws from its own streams (ADR-0007, rule 2), so changing one club never moves
 * another:
 * - `${seed}-strength-${clubId}`: the effective strength of the career;
 * - `${seed}-profile-${clubId}`:  the AI profile (always drawn; used only when the data has none)
 *   and the formations;
 * - `${seed}-squad-${clubId}`:    positions, then every player, then the potentials;
 * - `${seed}-names-${clubId}-${nationality}`: the seed handed to the IdentitySource.
 *
 * Order of the draws in the squad stream (part of the determinism contract):
 * 1. the pool of non-starter positions is shuffled (Fisher-Yates);
 * 2. for each player, in squad order: age, overall, the six attributes in table order, trait,
 *    age curve (peakAge, growth), nationality, morale;
 * 3. after the squad shift, the potential of each player, in squad order.
 */

/** Groups of the squad, in squad order (jogadores.md, "Elenco de 25"). */
export type SquadGroup = 'starters' | 'reserves' | 'rotation' | 'youth';

export const SQUAD_GROUPS: readonly SquadGroup[] = ['starters', 'reserves', 'rotation', 'youth'];

/** How many players each group has: 11 + 7 + 4 + 3 = SQUAD_SIZE. */
export const SQUAD_GROUP_SIZES: { readonly [G in SquadGroup]: number } = {
  starters: 11,
  reserves: 7,
  rotation: 4,
  youth: 3,
};

/** Overall of each group: `strength + offset + Normal(0, sd)` (jogadores.md, groups table). */
export const GROUP_OVERALL: {
  readonly [G in SquadGroup]: { readonly offset: number; readonly sd: number };
} = {
  starters: { offset: 0, sd: 3 },
  reserves: { offset: -5, sd: 3 },
  rotation: { offset: -10, sd: 4 },
  youth: { offset: -12, sd: 4 },
};

/**
 * Age of each group, inclusive. Starters are "22 to 33, most common 27": a triangular draw over
 * [22, 34) with its peak at 27.5, floored, so 27 is the most likely integer. The others are
 * uniform integers.
 */
export const GROUP_AGE: {
  readonly [G in SquadGroup]: { readonly min: number; readonly max: number };
} = {
  starters: { min: 22, max: 33 },
  reserves: { min: 19, max: 34 },
  rotation: { min: 23, max: 33 },
  youth: { min: 17, max: 20 },
};
/** Most common age of the starters. */
export const STARTER_MODE_AGE = 27;

/** Overall at generation, before and after the squad shift ("Overall sempre entre 35 e 92"). */
export const GENERATED_OVERALL_RANGE: { readonly min: number; readonly max: number } = {
  min: 35,
  max: 92,
};

/** Attributes of weight > 0 start at `overall + Normal(0, 6)`. */
export const WEIGHTED_ATTRIBUTE_SD = 6;
/** Attributes of weight 0 start at `overall − 20 + Normal(0, 8)`. */
export const UNWEIGHTED_ATTRIBUTE_OFFSET = -20;
export const UNWEIGHTED_ATTRIBUTE_SD = 8;

/** The best XI in the preferred formation ends within this distance of the effective strength. */
export const STRENGTH_TOLERANCE = 0.5;
/** Shifts tried on each side of the first estimate (each costs one best-XI pick). */
const SHIFT_SEARCH = 3;
/** Single-point moves of the fallback before giving up with a warning. */
const MAX_FINE_STEPS = 44;

/** 90% Brazilians; the rest from the other South American countries (jogadores.md). */
export const HOME_NATIONALITY = 'BR';
export const HOME_NATIONALITY_SHARE = 0.9;
/** The other nine CONMEBOL countries, ISO 3166-1 alpha-2, drawn with equal chance. */
export const SOUTH_AMERICAN_NATIONALITIES: readonly string[] = [
  'AR',
  'BO',
  'CL',
  'CO',
  'EC',
  'PE',
  'PY',
  'UY',
  'VE',
];

/**
 * Shirt numbers (jogadores.md, "Camisas"). Starters, in this position order (and slot order
 * within a position), take the first free number of their list, else the lowest free of 2..11.
 */
export const STARTER_SHIRT_ORDER: readonly Position[] = ['GK', 'FB', 'CB', 'DM', 'AM', 'ST'];
export const STARTER_SHIRTS: { readonly [P in Position]: readonly number[] } = {
  GK: [1],
  FB: [2, 6],
  CB: [3, 4],
  DM: [5, 8],
  AM: [10, 8, 7],
  ST: [9, 11, 7],
};
/** Shirt of the first reserve goalkeeper. */
export const RESERVE_GOALKEEPER_SHIRT = 12;
/** Other reserves and the rotation group take the lowest free number from here. */
export const SQUAD_SHIRTS_FROM = 13;
/** The youth take the lowest free number from here. */
export const YOUTH_SHIRTS_FROM = 30;

/** Initial morale: `Rng.int(50, 70)` (jogadores.md, "Estados que mudam"). */
export const START_MORALE: { readonly min: number; readonly max: number } = { min: 50, max: 70 };
/** Initial condition. */
export const START_CONDITION = 100;
/**
 * Initial `clubAppearances` of the starters, reserves and rotation group (jogadores.md, "Partidas
 * pelo clube"): they already played for the club before the career, so they never get the
 * `estreia` marker; the youth start at 0 and debut when they first take the pitch.
 */
export const PRE_CAREER_APPEARANCES = 1;

/** The "joia": the youth with the highest potential gets at least `strength + 8` (cap 95). */
export const JEWEL_POTENTIAL_MARGIN = 8;
/** The idol is the generated starter of at least this age with the highest overall. */
export const IDOL_MIN_AGE = 29;

/**
 * Default AI profile by size when the club list has none (ia-clubes.md, "Perfil por porte"),
 * drawn with these weights in this order.
 */
export const PROFILE_WEIGHTS_BY_SIZE: {
  readonly [S in ClubSize]: readonly (readonly [AiProfile, number])[];
} = {
  big: [
    ['ambitious', 4],
    ['traditional', 4],
    ['academy', 3],
    ['seller', 1],
  ],
  medium: [
    ['academy', 2],
    ['traditional', 1],
    ['seller', 1],
    ['chaotic', 1],
  ],
  small: [
    ['seller', 2],
    ['traditional', 1],
  ],
};

/** AI profile drawn by size (one draw). */
export function drawClubProfile(rng: Rng, size: ClubSize): AiProfile {
  const weights = PROFILE_WEIGHTS_BY_SIZE[size];
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let u = rng.next() * total;
  for (const [profile, weight] of weights) {
    if (u < weight) return profile;
    u -= weight;
  }
  return weights[weights.length - 1]![0];
}

/**
 * The two preferred formations of a club. "Formação preferida: sorteada entre as duas do perfil"
 * (jogadores.md): one draw picks which of the profile pair is the preferred one, and it goes
 * first (the squad is built for it, and the AI keeps it on a tie). The chaotic profile, which has
 * no pair, gets two distinct formations drawn among the six (two draws).
 */
export function drawPreferredFormations(
  rng: Rng,
  profile: AiProfile,
): readonly [Formation, Formation] {
  if (profile === 'chaotic') {
    const first = rng.int(0, FORMATIONS.length - 1);
    let second = rng.int(0, FORMATIONS.length - 2);
    if (second >= first) second++;
    return [FORMATIONS[first]!, FORMATIONS[second]!];
  }
  const pair = PROFILE_FORMATIONS[profile];
  return rng.int(0, 1) === 0 ? [pair[0], pair[1]] : [pair[1], pair[0]];
}

/**
 * Effective strength of the career: `strength + Normal(0, generation.clubStrengthSd)`
 * (jogadores.md, "Variação por carreira"). Not rounded nor clipped: the doc gives neither.
 * Always consumes the draws of one normal, even with sd 0.
 */
export function effectiveStrength(rng: Rng, strength: number, sd: number): number {
  return normal(rng, strength, sd);
}

type Draft = { -readonly [K in keyof Player]: Player[K] };
type DraftBase = Omit<Draft, 'name' | 'face' | 'nameSeed' | 'faceSeed'>;

/** Positions of the 25, in squad order: XI by formation slot, then reserves, rotation, youth. */
function squadPositions(rng: Rng, formation: Formation): Position[] {
  const starters = FORMATION_SLOTS[formation];
  const left: Record<Position, number> = { ...SQUAD_COMPOSITION };
  for (const position of starters) left[position]--;
  // Reserves: one of each position first (the second goalkeeper wears 12), so the bench can
  // always cover every slot; the remaining pool is shuffled and fills the rest.
  const reserves: Position[] = [];
  for (const position of POSITIONS) {
    if (left[position] > 0 && reserves.length < SQUAD_GROUP_SIZES.reserves) {
      reserves.push(position);
      left[position]--;
    }
  }
  const pool: Position[] = [];
  for (const position of POSITIONS) for (let i = 0; i < left[position]; i++) pool.push(position);
  rng.shuffle(pool);
  return [...starters, ...reserves, ...pool];
}

/** Shirt of each player, by index in squad order (see {@link STARTER_SHIRTS}). */
function assignShirts(positions: readonly Position[]): number[] {
  const shirts = new Array<number>(positions.length).fill(0);
  const used = new Set<number>();
  const take = (index: number, shirt: number) => {
    shirts[index] = shirt;
    used.add(shirt);
  };
  const lowestFree = (from: number, to = Number.MAX_SAFE_INTEGER) => {
    let n = from;
    while (used.has(n) && n < to) n++;
    return n;
  };
  const starters = SQUAD_GROUP_SIZES.starters;
  for (const position of STARTER_SHIRT_ORDER) {
    for (let i = 0; i < starters; i++) {
      if (positions[i] !== position) continue;
      const listed = STARTER_SHIRTS[position].find((n) => !used.has(n));
      take(i, listed ?? lowestFree(2, starters));
    }
  }
  let reserveGoalkeeper = false;
  for (let i = starters; i < positions.length; i++) {
    const group = groupAt(i);
    if (group === 'reserves' && positions[i] === 'GK' && !reserveGoalkeeper) {
      reserveGoalkeeper = true;
      take(i, RESERVE_GOALKEEPER_SHIRT);
    } else {
      take(i, lowestFree(group === 'youth' ? YOUTH_SHIRTS_FROM : SQUAD_SHIRTS_FROM));
    }
  }
  return shirts;
}

function groupAt(index: number): SquadGroup {
  let end = 0;
  for (const group of SQUAD_GROUPS) {
    end += SQUAD_GROUP_SIZES[group];
    if (index < end) return group;
  }
  return 'youth';
}

/** Starter age: triangular over [22, 34) peaking at 27.5, floored (one draw). */
function starterAge(rng: Rng): number {
  const a = GROUP_AGE.starters.min;
  const b = GROUP_AGE.starters.max + 1;
  const c = STARTER_MODE_AGE + 0.5;
  const u = rng.next();
  const x =
    u < (c - a) / (b - a)
      ? a + Math.sqrt(u * (b - a) * (c - a))
      : b - Math.sqrt((1 - u) * (b - a) * (b - c));
  return clamp(Math.floor(x), GROUP_AGE.starters.min, GROUP_AGE.starters.max);
}

function drawAge(rng: Rng, group: SquadGroup): number {
  if (group === 'starters') return starterAge(rng);
  return rng.int(GROUP_AGE[group].min, GROUP_AGE[group].max);
}

/**
 * Starting attributes: weight > 0 → `overall + Normal(0, 6)`; weight 0 → `overall − 20 +
 * Normal(0, 8)`; rounded and clipped to 1..99. All six keys of the position are created here,
 * because fitAttributesToOverall never creates the weight-0 ones.
 */
function drawAttributes(rng: Rng, position: Position, overall: number): PlayerAttributes {
  const start: Partial<Record<AttributeKey, number>> = {};
  for (const key of attributeKeysFor(position)) {
    const raw =
      overallWeight(position, key) > 0
        ? normal(rng, overall, WEIGHTED_ATTRIBUTE_SD)
        : normal(rng, overall + UNWEIGHTED_ATTRIBUTE_OFFSET, UNWEIGHTED_ATTRIBUTE_SD);
    start[key] = clamp(Math.round(raw), ATTRIBUTE_RANGE.min, ATTRIBUTE_RANGE.max);
  }
  return fitAttributesToOverall(start, position, overall);
}

/** One draw: below 0.9 Brazilian, otherwise one of the nine others by the same draw. */
function drawNationality(rng: Rng): string {
  const u = rng.next();
  if (u < HOME_NATIONALITY_SHARE) return HOME_NATIONALITY;
  const n = SOUTH_AMERICAN_NATIONALITIES.length;
  const index = Math.floor(((u - HOME_NATIONALITY_SHARE) / (1 - HOME_NATIONALITY_SHARE)) * n);
  return SOUTH_AMERICAN_NATIONALITIES[clamp(index, 0, n - 1)]!;
}

function clampGenerated(overall: number): number {
  return clamp(overall, GENERATED_OVERALL_RANGE.min, GENERATED_OVERALL_RANGE.max);
}

/**
 * Squad shift (jogadores.md): every overall moves by the same integer `d` (clipped to 35..92) so
 * that the best XI in the preferred formation lands within 0.5 of the target. A shift can change
 * who makes the best XI (an improvised player's `overall × fit` moves by `d × fit`, not `d`), so
 * the candidates around `round(target − strength)` are measured on the shifted overalls and the
 * closest wins (ties: the smallest |d|, then the lower d).
 *
 * In the rare squad where no common `d` lands within 0.5 (about 2 in 1,000: the best XI jumps
 * over the window), the members of the best XI move one point at a time, slot by slot, toward the
 * target until it does (each point moves the mean by about 0.09).
 *
 * Only then each player reaches the new overall by the coarse shift and the fine adjustment
 * (fitAttributesToOverall). Returns the final distance (target − strength), the common shift and
 * how many single-point moves the fallback made.
 */
function shiftSquad(
  players: DraftBase[],
  formation: Formation,
  target: number,
): { diff: number; shift: number; fineSteps: number } {
  const base = players.map((p, index) => ({
    id: p.id,
    position: p.position,
    age: p.age,
    overall: p.overall,
    index,
  }));
  const diffOf = (squad: readonly (typeof base)[number][]) =>
    target - elevenStrength(bestEleven(squad, formation));
  const shiftedBy = (d: number) =>
    base.map((p) => ({ ...p, overall: clampGenerated(p.overall + d) }));

  const first = Math.round(diffOf(base));
  let best = 0;
  let bestDiff = diffOf(base);
  for (let k = -SHIFT_SEARCH; k <= SHIFT_SEARCH; k++) {
    const d = first + k;
    const diff = diffOf(shiftedBy(d));
    const closer = Math.abs(diff) < Math.abs(bestDiff);
    const tie = Math.abs(diff) === Math.abs(bestDiff);
    const smaller = Math.abs(d) < Math.abs(best) || (Math.abs(d) === Math.abs(best) && d < best);
    if (closer || (tie && smaller)) {
      best = d;
      bestDiff = diff;
    }
  }

  const current = shiftedBy(best);
  let fineSteps = 0;
  for (let step = 0; step < MAX_FINE_STEPS && Math.abs(bestDiff) > STRENGTH_TOLERANCE; step++) {
    const eleven = bestEleven(current, formation);
    const member = eleven[step % eleven.length]!.player;
    member.overall = clampGenerated(member.overall + (bestDiff > 0 ? 1 : -1));
    bestDiff = diffOf(current);
    fineSteps++;
  }

  for (const { index, overall } of current) {
    const player = players[index]!;
    if (overall === player.overall) continue;
    player.attributes = fitAttributesToOverall(player.attributes, player.position, overall);
    player.overall = computeOverall(player.position, player.attributes);
  }
  return { diff: bestDiff, shift: best, fineSteps };
}

/** N of `${clubId}#N`, for the "lower id" tie-break; the list position when there is no id. */
export function idNumber(player: { readonly id?: PlayerId }, index: number): number {
  const hash = player.id?.lastIndexOf('#') ?? -1;
  if (player.id === undefined || hash < 0) return index;
  const n = Number(player.id.slice(hash + 1));
  return Number.isInteger(n) ? n : index;
}

/**
 * Best XI of a squad in a formation, as the AI would pick it with everyone fresh
 * (ia-clubes.md, "Escalação", steps 2 and 3 at condition 100): slot by slot in formation order,
 * the player not yet chosen with the highest `overall × fit`; ties by higher overall, then
 * younger, then lower id. "Lower id" compares the number N of `${clubId}#N` numerically (a text
 * comparison would put `#10` before `#2`); players without an id fall back to their order in the
 * list. Used to measure the generated squad; the match lineup with
 * condition, injuries and rotation is the AI's (T-010). Returns the chosen player of each slot
 * (fewer than 11 only if the squad is smaller).
 */
export function bestEleven<
  T extends Pick<Player, 'position' | 'overall' | 'age'> & { readonly id?: PlayerId },
>(players: readonly T[], formation: Formation): { player: T; slot: Position }[] {
  const taken = new Set<number>();
  const chosen: { player: T; slot: Position }[] = [];
  for (const slot of FORMATION_SLOTS[formation]) {
    let best = -1;
    let bestValue = -1;
    for (let i = 0; i < players.length; i++) {
      if (taken.has(i)) continue;
      const p = players[i]!;
      const value = p.overall * fit(p.position, slot);
      const b = best >= 0 ? players[best]! : undefined;
      if (
        b === undefined ||
        value > bestValue ||
        (value === bestValue &&
          (p.overall > b.overall ||
            (p.overall === b.overall &&
              (p.age < b.age || (p.age === b.age && idNumber(p, i) < idNumber(b, best))))))
      ) {
        best = i;
        bestValue = value;
      }
    }
    if (best < 0) break;
    taken.add(best);
    chosen.push({ player: players[best]!, slot });
  }
  return chosen;
}

/**
 * "Força" of an XI (balance-targets.md): the mean of `overall × fit` of the starters, without
 * condition, morale nor home advantage. 0 for an empty XI.
 */
export function elevenStrength(
  eleven: readonly { player: Pick<Player, 'position' | 'overall'>; slot: Position }[],
): number {
  if (eleven.length === 0) return 0;
  let sum = 0;
  for (const { player, slot } of eleven) sum += player.overall * fit(player.position, slot);
  return sum / eleven.length;
}

/** Index of the max by `score`; ties keep the first in squad order. */
function argMax<T>(items: readonly T[], score: (item: T) => number): number {
  let best = -1;
  for (let i = 0; i < items.length; i++) {
    if (best < 0 || score(items[i]!) > score(items[best]!)) best = i;
  }
  return best;
}

/**
 * The idol (jogadores.md, "Traço de personalidade" and "Geração de elencos", revised on
 * 2026-11-05): among the 11 generated starters, the one aged 29 or more with the highest overall;
 * without a starter of 29 or more, the starter with the highest overall. Ties: squad order. Never
 * a reserve: a reserve idol (5.7% of the clubs before) cost his club −1 of thermometer almost
 * every round without anyone deciding it.
 */
function idolIndex(players: readonly DraftBase[]): number {
  const starters = players.slice(0, SQUAD_GROUP_SIZES.starters);
  const veterans = starters.map((p, i) => ({ p, i })).filter(({ p }) => p.age >= IDOL_MIN_AGE);
  if (veterans.length > 0) return veterans[argMax(veterans, ({ p }) => p.overall)]!.i;
  return argMax(starters, (p) => p.overall);
}

export type SquadProblem =
  | 'size'
  | 'composition'
  | 'duplicate-id'
  | 'wrong-club'
  | 'duplicate-shirt'
  | 'idol-count'
  | 'idol-not-starter'
  | 'no-jewel';

/**
 * Squad-level rules of a generated squad (jogadores.md: composition 3/5/4/4/4/5, unique shirts,
 * exactly one idol, among the 11 starters, a joia among the youth with potential ≥ strength + 8
 * or 95). Per-player rules are {@link validatePlayer}'s. Returns the problems found; empty when
 * the squad is valid.
 */
export function checkGeneratedSquad(
  players: readonly Player[],
  clubId: ClubId,
  strength: number,
): SquadProblem[] {
  const problems = new Set<SquadProblem>();
  if (players.length !== SQUAD_SIZE) problems.add('size');
  for (const position of POSITIONS) {
    const n = players.filter((p) => p.position === position).length;
    if (n !== SQUAD_COMPOSITION[position]) problems.add('composition');
  }
  if (new Set(players.map((p) => p.id)).size !== players.length) problems.add('duplicate-id');
  if (players.some((p) => p.clubId !== clubId)) problems.add('wrong-club');
  if (new Set(players.map((p) => p.shirt)).size !== players.length) problems.add('duplicate-shirt');
  if (players.filter((p) => p.trait === 'idol').length !== 1) problems.add('idol-count');
  const idolAt = players.findIndex((p) => p.trait === 'idol');
  if (idolAt >= SQUAD_GROUP_SIZES.starters) problems.add('idol-not-starter');
  const floor = Math.min(POTENTIAL_MAX, Math.ceil(strength + JEWEL_POTENTIAL_MARGIN));
  const youth = players.slice(SQUAD_SIZE - SQUAD_GROUP_SIZES.youth);
  if (!youth.some((p) => p.potential >= floor)) problems.add('no-jewel');
  return [...problems];
}

export interface SquadRequest {
  clubId: ClubId;
  /** Seed of the career or league (`GameState.seed`); the streams are derived from it. */
  seed: number;
  /** Effective strength (after the career variation). */
  strength: number;
  /** Preferred formation: the XI is generated for its slots and measured in it. */
  formation: Formation;
}

export interface GeneratedSquad {
  /** The 25 players in squad order: XI by slot, reserves, rotation, youth. */
  players: Player[];
  /** Strength (mean `overall × fit`) of the best XI in the preferred formation. */
  elevenStrength: number;
  /** The squad shift: the common `d` and the single-point moves of the fallback (diagnostics). */
  adjustment: { shift: number; fineSteps: number };
  warnings: EngineWarning[];
}

/**
 * Generates one squad of 25 (docs/design/jogadores.md, "Geração de elencos"): the composition
 * 3/5/4/4/4/5, the four groups with their overall and age ranges, the squad shift to the target
 * strength, potentials, the joia, the idol, initial morale, unique shirts (starters 1..11 by
 * position, reserve goalkeeper 12, others from 13, youth from 30)
 * and ids `${clubId}#1`..`#25`. Names and faces come from `identities`, one call per
 * nationality (in code order), each told the names already given in the club.
 *
 * Never throws for a game situation. An IdentitySource that breaks its contract (wrong count, a
 * face over 32 characters) is a programming error and throws.
 */
export function generateSquad(
  request: SquadRequest,
  params: GameParams,
  identities: IdentitySource,
): GeneratedSquad {
  const { clubId, seed, strength, formation } = request;
  const rng = new Rng(seedFromString(`${seed}-squad-${clubId}`));
  const positions = squadPositions(rng, formation);
  const shirts = assignShirts(positions);
  const drafts: DraftBase[] = positions.map((position, index) => {
    const group = groupAt(index);
    const age = drawAge(rng, group);
    const { offset, sd } = GROUP_OVERALL[group];
    const overall = clampGenerated(Math.round(normal(rng, strength + offset, sd)));
    const attributes = drawAttributes(rng, position, overall);
    const trait: Trait = drawTrait(rng);
    const { peakAge, growth } = drawGrowthCurve(rng, params.players);
    const nationality = drawNationality(rng);
    const morale = rng.int(START_MORALE.min, START_MORALE.max);
    return {
      id: `${clubId}#${index + 1}`,
      clubId,
      nationality,
      position,
      attributes,
      overall: computeOverall(position, attributes),
      potential: 0,
      age,
      peakAge,
      growth,
      trait,
      shirt: shirts[index]!,
      condition: START_CONDITION,
      morale,
      injuryRounds: 0,
      suspendedGames: 0,
      yellowCount: 0,
      recentRatings: [],
      benchStreak: 0,
      clubAppearances: group === 'youth' ? 0 : PRE_CAREER_APPEARANCES,
    };
  });

  const warnings: EngineWarning[] = [];
  const adjustment = shiftSquad(drafts, formation, strength);
  const diff = adjustment.diff;
  if (Math.abs(diff) > STRENGTH_TOLERANCE) {
    warnings.push({ code: 'squad-strength-off', detail: { clubId, diff } });
  }

  // Potentials are drawn on the final overall, so potential ≥ overall always holds.
  for (const draft of drafts) draft.potential = drawPotential(rng, draft.overall, draft.age);
  const youthStart = SQUAD_SIZE - SQUAD_GROUP_SIZES.youth;
  const youth = drafts.slice(youthStart);
  const jewel = youth[argMax(youth, (p) => p.potential)]!;
  const floor = Math.min(POTENTIAL_MAX, Math.ceil(strength + JEWEL_POTENTIAL_MARGIN));
  jewel.potential = Math.max(jewel.potential, floor, jewel.overall);
  drafts[idolIndex(drafts)]!.trait = 'idol';

  const players = withIdentities(drafts, seed, clubId, identities);
  const problems = checkGeneratedSquad(players, clubId, strength);
  // Every rule holds by construction: a problem here is a bug of this generator.
  if (problems.length > 0) throw new Error(`squad of ${clubId} broke ${problems.join(', ')}`);
  return {
    players,
    elevenStrength: elevenStrength(bestEleven(players, formation)),
    adjustment: { shift: adjustment.shift, fineSteps: adjustment.fineSteps },
    warnings,
  };
}

function withIdentities(
  drafts: readonly DraftBase[],
  seed: number,
  clubId: ClubId,
  identities: IdentitySource,
): Player[] {
  const nationalities = [...new Set(drafts.map((d) => d.nationality))].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const named: (Player | undefined)[] = drafts.map(() => undefined);
  const existing: PlayerNameText[] = [];
  for (const nationality of nationalities) {
    const indices = drafts.flatMap((d, i) => (d.nationality === nationality ? [i] : []));
    const ids = identities.squad({
      seed: seedFromString(`${seed}-names-${clubId}-${nationality}`),
      nationality,
      count: indices.length,
      existing: [...existing],
    });
    if (ids.length !== indices.length) {
      throw new Error(
        `IdentitySource returned ${ids.length} identities, expected ${indices.length}`,
      );
    }
    indices.forEach((index, k) => {
      const id = ids[k]!;
      const name = { display: id.display, full: id.full, family: id.family };
      existing.push(name);
      const candidate = {
        ...drafts[index]!,
        nameSeed: id.nameSeed,
        faceSeed: id.faceSeed,
        name,
        face: id.face,
      };
      const checked = validatePlayer(candidate);
      if (!checked.ok) {
        throw new Error(
          `generated player ${candidate.id} is invalid: ${JSON.stringify(checked.detail)}`,
        );
      }
      named[index] = checked.value;
    });
  }
  return named as Player[];
}
