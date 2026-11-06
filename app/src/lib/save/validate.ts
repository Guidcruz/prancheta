import * as v from 'valibot';
import {
  AI_PROFILES,
  BENCH_SIZE,
  FORMATIONS,
  FORMATION_SLOTS,
  HALFTIME_TALKS,
  MATCH_MODES,
  POSITIONS,
  POSTURES,
  RATING_RANGE,
  SEASON_ROUNDS,
  validateClubs,
  validatePlayer,
  type ChanceKind,
  type ClubDef,
  type FixtureId,
  type GameRules,
  type GameState,
  type HalftimeChoice,
  type InjurySeverity,
  type MatchSheet,
  type MissOutcome,
  type Player,
  type Posture,
  type Pressure,
  type Side,
  type TacticPreset,
} from '../../engine/index.ts';
import { fail, ok, type SaveResult } from './result.ts';
import { SAVE_SCHEMA_VERSION, type CareerSave } from './schema.ts';

/*
 * The strict schema of the save format v1 (ADR-0006; docs/02-architecture.md, 4.2; T-019). It is
 * what a snapshot passes after the migration when it opens, what a save passes before it is
 * written, and what an imported file will pass (T-020), so it reads untrusted input:
 *
 * - every object is strict (an unknown key fails), every text and list has a length bound, and a
 *   key `__proto__`, `constructor` or `prototype` anywhere fails (valibot drops those keys
 *   silently, which would hide them);
 * - the player is checked by the engine's own `validatePlayer` and the club definitions by
 *   `validateClubs`, never by ranges typed again here (docs/02-architecture.md, 4.1). The closed
 *   lists and ranges the engine exports (formations, positions, ratings...) are read from it;
 * - the lists the engine has only as a type (sides, pressures, kinds of facts...) are written here
 *   with `satisfies`, and a type check both ways between the schema and `CareerSave` makes the
 *   compiler refuse a drift;
 * - after the shape, a coherence check: the ids that the save references exist (the coach's club,
 *   the squads, the calendar, the sheets) and the first season's year is the base season (US-066).
 *
 * The limits in {@link SAVE_LIMITS} are the save layer's bounds against a hostile file, far above
 * any real career; they are not game rules. Changing the format (a key, a type, a closed list)
 * means a new `schemaVersion`, a migration and a fixture: the shape test (fixtures.test.ts) fails
 * otherwise.
 */

/** Bounds of the save against hostile input; generous on purpose (a real save is far below). */
export const SAVE_LIMITS = {
  /** Club, player, fixture, fact and template ids. */
  idLength: 100,
  /** Any other text of the save (template variables, version labels). */
  textLength: 200,
  /** The coach's nickname; the new-game screen (US-014) has its own, smaller limit. */
  coachNameLength: 100,
  /** News and social posts kept by the career. */
  refs: 20_000,
  /** Variables of one news item. */
  refVars: 32,
  /** docs/02-architecture.md, 4.2: "≤ 200 ids". */
  phraseMemory: 200,
  /** Clubs of the state; `validateClubs` then demands exactly the league's. */
  clubs: 64,
  players: 20_000,
  /** Players of one squad. */
  squad: 100,
  /** Lists of a team sheet beyond the 11 and the bench (captains, takers). */
  takers: 100,
  pastSeasons: 1_000,
  /** Events of one match. */
  matchEvents: 2_000,
  /** Goals or markers of one match. */
  matchItems: 200,
  /** Facts of one round. */
  facts: 2_000,
  /** Award winners, top scorers or evolved players of one season. */
  seasonItems: 2_000,
} as const;

// ---------------------------------------------------------------------------------------------
// Closed lists the engine has only as types. `satisfies` refuses a value that is not of the type,
// and the type check at the end of the schema refuses a value of the type missing from a list.

const SIDES = ['home', 'away'] as const satisfies readonly Side[];
const PRESSURES = ['low', 'medium', 'high'] as const satisfies readonly Pressure[];
const PRE_MATCH_POSTURES = POSTURES.filter((p): p is Exclude<Posture, 'allOut'> => p !== 'allOut');
const REALISMS = ['full', 'simplified'] as const satisfies readonly GameRules['realism'][];
const PHASES = ['season', 'seasonEnd'] as const satisfies readonly GameState['phase'][];
const CHANCE_KINDS = ['open', 'freeKick', 'penalty'] as const satisfies readonly ChanceKind[];
const MISS_OUTCOMES = ['saved', 'post', 'wide'] as const satisfies readonly MissOutcome[];
const SEVERITIES = [
  'light',
  'medium',
  'serious',
  'severe',
] as const satisfies readonly InjurySeverity[];
const PRESETS = ['press', 'holdResult', 'allOut'] as const satisfies readonly TacticPreset[];
const HALFTIME_CHOICES = [...HALFTIME_TALKS, 'skip'] as const satisfies readonly HalftimeChoice[];

// ---------------------------------------------------------------------------------------------
// Building blocks

const int = (min: number, max: number) =>
  v.pipe(v.number(), v.integer(), v.minValue(min), v.maxValue(max));
const count = int(0, Number.MAX_SAFE_INTEGER);
const positive = int(1, Number.MAX_SAFE_INTEGER);
const finite = v.pipe(v.number(), v.finite());
const unit = v.pipe(v.number(), v.minValue(0), v.maxValue(1));
const rating = v.pipe(v.number(), v.minValue(RATING_RANGE.min), v.maxValue(RATING_RANGE.max));
const text = (max: number = SAVE_LIMITS.textLength) => v.pipe(v.string(), v.maxLength(max));
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(SAVE_LIMITS.idLength));
const sha256 = v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/));
const isoDate = v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/));
const round = int(1, SEASON_ROUNDS);
/** Matches of a season: 20 clubs, each against each other twice (SEASON_ROUNDS = 2 × 19). */
const MAX_FIXTURES = (SEASON_ROUNDS * (SEASON_ROUNDS + 2)) / 4;
const score = v.strictTuple([count, count]);
const side = v.picklist(SIDES);
const formation = v.picklist(FORMATIONS);

function list<T extends v.GenericSchema>(item: T, max: number) {
  return v.pipe(v.array(item), v.maxLength(max));
}

function dict<T extends v.GenericSchema>(value: T, max: number) {
  return v.pipe(v.record(id, value), v.maxEntries(max));
}

const sides = <T extends v.GenericSchema>(value: T) => v.strictObject({ home: value, away: value });

// ---------------------------------------------------------------------------------------------
// Matches (engine/match/types.ts, engine/recap.ts)

const matchStats = v.strictObject({
  shots: count,
  onTarget: count,
  possession: int(0, 100),
  yellows: count,
  reds: count,
});

const matchGoal = v.strictObject({
  side,
  scorer: id,
  assist: v.exactOptional(id),
  kind: v.picklist(CHANCE_KINDS),
  minute: count,
  added: v.exactOptional(count),
});

const matchSummary = v.strictObject({
  score,
  abandoned: v.boolean(),
  goals: list(matchGoal, SAVE_LIMITS.matchItems),
  stats: sides(matchStats),
  motm: v.exactOptional(id),
  attendance: count,
});

const eventBase = {
  minute: count,
  added: v.exactOptional(count),
  half: v.picklist([1, 2]),
  importance: v.picklist([1, 2, 3]),
} as const;

const goalEvent = v.strictObject({
  ...eventBase,
  type: v.literal('goal'),
  side,
  scorer: id,
  assist: v.exactOptional(id),
  kind: v.picklist(CHANCE_KINDS),
  score,
});
const penaltyMissedEvent = v.strictObject({
  ...eventBase,
  type: v.literal('penaltyMissed'),
  side,
  taker: id,
  outcome: v.picklist(MISS_OUTCOMES),
});
const yellowEvent = v.strictObject({
  ...eventBase,
  type: v.literal('yellow'),
  side,
  player: id,
  triggersSuspension: v.boolean(),
});
const redEvent = v.strictObject({
  ...eventBase,
  type: v.literal('red'),
  side,
  player: id,
  reason: v.picklist(['direct', 'secondYellow']),
});
const injuryEvent = v.strictObject({
  ...eventBase,
  type: v.literal('injury'),
  side,
  player: id,
  severity: v.picklist(SEVERITIES),
});
const substitutionEvent = v.strictObject({
  ...eventBase,
  type: v.literal('substitution'),
  side,
  out: id,
  in: id,
  reason: v.picklist(['tactical', 'fatigue', 'injury']),
});

/** The events of a match sheet (`MATCH_SHEET_EVENTS`). */
const sheetEvent = v.variant('type', [
  goalEvent,
  penaltyMissedEvent,
  yellowEvent,
  redEvent,
  injuryEvent,
  substitutionEvent,
]);

const matchEvent = v.variant('type', [
  v.strictObject({ ...eventBase, type: v.literal('kickoff') }),
  v.strictObject({
    ...eventBase,
    type: v.literal('chance'),
    side,
    shooter: id,
    kind: v.picklist(['open', 'freeKick']),
    outcome: v.picklist(MISS_OUTCOMES),
    pGoal: unit,
  }),
  goalEvent,
  v.strictObject({ ...eventBase, type: v.literal('penaltyAwarded'), side, taker: id }),
  penaltyMissedEvent,
  yellowEvent,
  redEvent,
  injuryEvent,
  substitutionEvent,
  v.strictObject({
    ...eventBase,
    type: v.literal('tacticChange'),
    side,
    formation,
    posture: v.picklist(POSTURES),
    pressure: v.picklist(PRESSURES),
    preset: v.exactOptional(v.picklist(PRESETS)),
  }),
  v.strictObject({ ...eventBase, type: v.literal('stoppage'), minutes: count }),
  v.strictObject({ ...eventBase, type: v.literal('halftime'), score }),
  v.strictObject({
    ...eventBase,
    type: v.literal('halftimeTalk'),
    side,
    talk: v.picklist(HALFTIME_CHOICES),
  }),
  v.strictObject({ ...eventBase, type: v.literal('fulltime'), score, abandoned: v.boolean() }),
]);

const matchMarker = v.variant('kind', [
  v.strictObject({ kind: v.picklist(['goleada', 'virada', 'zebra', 'semSofrerGols']), side }),
  v.strictObject({
    kind: v.literal('golNoFim'),
    side,
    player: id,
    minute: count,
    added: v.exactOptional(count),
  }),
  v.strictObject({ kind: v.literal('hatTrick'), side, player: id, goals: count }),
  v.strictObject({ kind: v.literal('classico') }),
  v.strictObject({ kind: v.literal('estreia'), side, player: id }),
]);

const fact = v.variant('kind', [
  v.strictObject({
    kind: v.literal('leadership'),
    clubId: id,
    change: v.picklist(['took', 'lost', 'kept']),
    rounds: count,
  }),
  v.strictObject({ kind: v.picklist(['enteredZ4', 'leftZ4']), clubId: id }),
  v.strictObject({ kind: v.picklist(['unbeaten', 'winless']), clubId: id, games: count }),
  v.strictObject({
    kind: v.picklist(['unbeatenEnded', 'winlessEnded']),
    clubId: id,
    games: count,
    round,
    opponentId: id,
  }),
  v.strictObject({ kind: v.picklist(['championClinched', 'relegatedClinched']), clubId: id }),
  v.strictObject({ kind: v.literal('topScorerOfRound'), playerId: id, goals: count }),
  v.strictObject({
    kind: v.literal('decisiveLastRound'),
    stakes: v.picklist(['title', 'relegation']),
  }),
  v.strictObject({ kind: v.picklist(['suspended', 'injured']), playerId: id, games: count }),
]);

const matchRecap = v.strictObject({
  fixtureId: id,
  score,
  events: list(matchEvent, SAVE_LIMITS.matchEvents),
  stats: sides(matchStats),
  motm: v.exactOptional(id),
  motmRating: v.exactOptional(rating),
  markers: list(matchMarker, SAVE_LIMITS.matchItems),
  attendance: count,
});

const roundRecap = v.strictObject({
  season: positive,
  round,
  results: list(matchRecap, SEASON_ROUNDS),
  facts: list(fact, SAVE_LIMITS.facts),
});

const matchSheet = v.strictObject({
  fixtureId: id,
  events: list(sheetEvent, SAVE_LIMITS.matchEvents),
  motmRating: v.exactOptional(rating),
});

// ---------------------------------------------------------------------------------------------
// The game state (engine/game.ts and the types it holds)

const fixture = v.strictObject({
  id,
  round,
  date: isoDate,
  homeId: id,
  awayId: id,
  result: v.exactOptional(matchSummary),
});

const teamSheet = v.strictObject({
  lineup: v.strictObject({
    formation,
    starters: list(id, Math.max(...FORMATIONS.map((f) => FORMATION_SLOTS[f].length))),
    bench: list(id, BENCH_SIZE),
    captains: list(id, SAVE_LIMITS.takers),
    penaltyTakers: list(id, SAVE_LIMITS.takers),
    freeKickTakers: list(id, SAVE_LIMITS.takers),
  }),
  tactic: v.strictObject({
    posture: v.picklist(PRE_MATCH_POSTURES),
    pressure: v.picklist(PRESSURES),
  }),
});

const seasonStats = v.strictObject({
  games: count,
  minutes: count,
  goals: count,
  assists: count,
  yellows: count,
  reds: count,
  ratingSum: v.pipe(finite, v.minValue(0)),
  ratedGames: count,
  conceded: count,
});

const ratingAward = v.strictObject({ playerId: id, clubId: id, rating });

const campaignMatch = v.strictObject({
  round,
  opponentId: id,
  home: v.boolean(),
  scored: count,
  conceded: count,
});

const clubCampaign = v.strictObject({
  position: positive,
  points: count,
  target: positive,
  targetMet: v.boolean(),
  biggestWin: v.exactOptional(campaignMatch),
  biggestDefeat: v.exactOptional(campaignMatch),
  topScorers: list(v.strictObject({ playerId: id, goals: count }), SAVE_LIMITS.seasonItems),
  evolved: list(
    v.strictObject({ playerId: id, before: count, after: count }),
    SAVE_LIMITS.seasonItems,
  ),
  farewells: list(id, SAVE_LIMITS.seasonItems),
  academy: list(id, SAVE_LIMITS.seasonItems),
});

const seasonSummary = v.strictObject({
  season: positive,
  year: positive,
  championId: id,
  championPoints: count,
  relegationZone: list(id, SAVE_LIMITS.clubs),
  awards: v.strictObject({
    topScorers: list(
      v.strictObject({ playerId: id, clubId: id, goals: count }),
      SAVE_LIMITS.seasonItems,
    ),
    topAssists: list(
      v.strictObject({ playerId: id, clubId: id, assists: count }),
      SAVE_LIMITS.seasonItems,
    ),
    bestPlayer: v.exactOptional(ratingAward),
    revelation: v.exactOptional(ratingAward),
    bestGoalkeeper: v.exactOptional(
      v.strictObject({ playerId: id, clubId: id, concededPerGame: v.pipe(finite, v.minValue(0)) }),
    ),
    teamOfSeason: list(
      v.strictObject({
        slot: v.picklist(POSITIONS),
        playerId: v.exactOptional(id),
        clubId: v.exactOptional(id),
      }),
      SAVE_LIMITS.seasonItems,
    ),
  }),
  campaigns: dict(clubCampaign, SAVE_LIMITS.clubs),
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A club definition; the whole list is checked by `validateClubs` on the `clubs` record. */
const clubDef = v.custom<ClubDef>(isPlainObject);

/** A player, checked by the engine's own validator (never by ranges typed again here). */
const player = v.custom<Player>((value) => validatePlayer(value).ok);

const clubState = v.strictObject({
  def: clubDef,
  profile: v.picklist(AI_PROFILES),
  strength: finite,
  preferredFormations: v.strictTuple([formation, formation]),
  fans: finite,
  idolBenchStreak: count,
});

/** Every club definition in the state passes the engine's club validation, with a strength. */
function clubsAreValid(clubs: Readonly<Record<string, { readonly def: ClubDef }>>): boolean {
  const defs = Object.values(clubs).map((club) => club.def);
  const checked = validateClubs(defs);
  return checked.ok && defs.every((def) => typeof def.strength === 'number');
}

const gameState = v.strictObject({
  engineVersion: positive,
  retiredNamesRev: count,
  seed: int(0, 0xffffffff),
  year: positive,
  season: positive,
  round: int(1, SEASON_ROUNDS + 1),
  phase: v.picklist(PHASES),
  rules: v.strictObject({ realism: v.picklist(REALISMS) }),
  clubs: v.pipe(
    dict(clubState, SAVE_LIMITS.clubs),
    v.check((clubs) => clubsAreValid(clubs), 'invalid-clubs'),
  ),
  players: dict(player, SAVE_LIMITS.players),
  squads: dict(list(id, SAVE_LIMITS.squad), SAVE_LIMITS.clubs),
  fixtures: list(fixture, MAX_FIXTURES),
  lastSheets: dict(teamSheet, SAVE_LIMITS.clubs),
  seasonStats: dict(seasonStats, SAVE_LIMITS.players),
  pastSeasons: list(seasonSummary, SAVE_LIMITS.pastSeasons),
});

// ---------------------------------------------------------------------------------------------
// The envelope (schema.ts, CareerSaveV1)

const ref = v.strictObject({
  factId: id,
  templateId: id,
  variantId: id,
  vars: v.pipe(v.record(id, v.union([text(), finite])), v.maxEntries(SAVE_LIMITS.refVars)),
});

const careerEntries = {
  coachName: v.pipe(
    v.string(),
    v.maxLength(SAVE_LIMITS.coachNameLength),
    v.check((name) => name.trim() !== '', 'empty'),
  ),
  clubId: id,
  matchMode: v.picklist(MATCH_MODES),
  news: list(ref, SAVE_LIMITS.refs),
  social: list(ref, SAVE_LIMITS.refs),
  phraseMemory: list(id, SAVE_LIMITS.phraseMemory),
  pendingFanDecision: finite,
  exportReminder: v.boolean(),
  baseSeason: positive,
  lastRound: v.exactOptional(roundRecap),
  matchSheets: dict(matchSheet, MAX_FIXTURES),
};

const envelopeEntries = {
  schemaVersion: v.literal(SAVE_SCHEMA_VERSION),
  careerId: v.pipe(v.string(), v.uuid()),
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
  updatedAt: v.pipe(v.string(), v.isoTimestamp()),
  appVersion: v.pipe(v.string(), v.minLength(1), v.maxLength(32)),
  engineVersion: positive,
  paramsHash: sha256,
};

/**
 * The strict schema of {@link CareerSave} in the current format (v1): every field, down to each
 * event of each match sheet. An imported file (T-020) and a migrated save pass this one.
 */
export const careerSaveSchema = v.strictObject({
  ...envelopeEntries,
  career: v.strictObject(careerEntries),
  game: gameState,
});

/** The match sheets of one round, as a row of the `matchSheets` store keeps them. */
export const roundSheetsSchema = dict(matchSheet, MAX_FIXTURES);

const plainObject = v.custom<Record<string, unknown>>(isPlainObject);

/**
 * Opening a snapshot of the current format: the same, except the content of each match sheet,
 * which was checked by {@link roundSheetsSchema} when its row was written and is protected by the
 * row's SHA-256 in the snapshot's index (docs/02-architecture.md, 4.2). The sheets are about half
 * of the end-of-season save, and the opening has a budget (400 ms, docs/02-architecture.md, 5).
 */
const openSchema = v.strictObject({
  ...envelopeEntries,
  career: v.strictObject({ ...careerEntries, matchSheets: dict(plainObject, MAX_FIXTURES) }),
  game: gameState,
});

/**
 * Writing a save: the envelope and the career strictly; of what the engine made (the state, the
 * round's recap, the sheets) only what the store reads. The engine's output passes the full
 * schema in CI (fixtures.test.ts), and the write has a budget too (150 ms, same section), which
 * the full check of a 1.4 MB save would take most of in a slow phone. The new rows of sheets are
 * checked one by one ({@link parseRoundSheets}) and the snapshot is checked in full when it opens.
 */
const writeSchema = v.strictObject({
  ...envelopeEntries,
  career: v.strictObject({
    ...careerEntries,
    lastRound: v.exactOptional(plainObject),
    matchSheets: dict(plainObject, MAX_FIXTURES),
  }),
  game: v.looseObject({
    season: positive,
    round: int(1, SEASON_ROUNDS + 1),
    clubs: dict(v.looseObject({ def: plainObject }), SAVE_LIMITS.clubs),
    players: plainObject,
    fixtures: v.array(plainObject),
  }),
});

/*
 * The schema and the TypeScript type describe the same format: the schema's output is a
 * `CareerSave`, and every `CareerSave` is a (read-only) output of the schema, so a key, a variant
 * or a list value on one side only fails to compile.
 */
type SchemaOutput = v.InferOutput<typeof careerSaveSchema>;
type DeepReadonly<T> = T extends readonly (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;
const outputIsSave = (value: SchemaOutput): CareerSave => value;
const saveIsOutput = (value: CareerSave): DeepReadonly<SchemaOutput> => value;
void outputIsSave;
void saveIsOutput;

// ---------------------------------------------------------------------------------------------
// Parse

/**
 * Why a value is not a save of the current format: the dotted path of the first problem and its
 * kind (a valibot issue type such as `max_length`, `strict_object`, `custom`, or one of the
 * coherence checks). Never the value itself: a save holds the coach's nickname.
 */
export interface SaveIssue {
  readonly path: string;
  readonly problem: string;
}

/**
 * How much of a save is read: `full` (an imported file, a migrated save), `open` (a snapshot of
 * the current format, with its rows of sheets) or `write` (a save the game is about to store).
 */
export type SaveCheck = 'full' | 'open' | 'write';

const SCHEMAS: Readonly<Record<SaveCheck, v.GenericSchema>> = {
  full: careerSaveSchema,
  open: openSchema,
  write: writeSchema,
};

const isForbidden = (key: string) =>
  key === '__proto__' || key === 'constructor' || key === 'prototype';

/** `true` when some key of `value`, at any depth, could reach a prototype. */
function hasForbiddenKey(value: unknown): boolean {
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const node = stack.pop();
    if (typeof node !== 'object' || node === null) continue;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        const item: unknown = node[i];
        if (typeof item === 'object' && item !== null) stack.push(item);
      }
      continue;
    }
    for (const key in node) {
      if (!Object.hasOwn(node, key)) continue;
      if (isForbidden(key)) return true;
      const item = (node as Record<string, unknown>)[key];
      if (typeof item === 'object' && item !== null) stack.push(item);
    }
  }
  return false;
}

function issueOf(issues: readonly v.BaseIssue<unknown>[]): SaveIssue {
  const issue = issues[0];
  return {
    path: (issue && v.getDotPath(issue)) ?? '',
    problem: issue?.type ?? 'unknown',
  };
}

/**
 * Cross-references a valid shape must hold: the ids the save refers to exist. `undefined` when
 * the save is coherent.
 */
function incoherence(save: CareerSave): SaveIssue | undefined {
  const { game, career } = save;
  for (const [key, club] of Object.entries(game.clubs)) {
    if (club.def.id !== key) return { path: `game.clubs.${key}.def.id`, problem: 'key-mismatch' };
  }
  if (!Object.hasOwn(game.clubs, career.clubId)) {
    return { path: 'career.clubId', problem: 'unknown-club' };
  }
  for (const [key, p] of Object.entries(game.players)) {
    if (p.id !== key) return { path: `game.players.${key}.id`, problem: 'key-mismatch' };
  }
  const squadIds = Object.keys(game.squads);
  if (
    squadIds.length !== Object.keys(game.clubs).length ||
    !squadIds.every((c) => Object.hasOwn(game.clubs, c))
  ) {
    return { path: 'game.squads', problem: 'unknown-club' };
  }
  for (const [clubId, squad] of Object.entries(game.squads)) {
    for (const [i, playerId] of squad.entries()) {
      const member = Object.hasOwn(game.players, playerId) ? game.players[playerId] : undefined;
      if (member?.clubId !== clubId) {
        return { path: `game.squads.${clubId}.${i}`, problem: 'unknown-player' };
      }
    }
  }
  for (const clubId of Object.keys(game.lastSheets)) {
    if (!Object.hasOwn(game.clubs, clubId)) {
      return { path: `game.lastSheets.${clubId}`, problem: 'unknown-club' };
    }
  }
  for (const playerId of Object.keys(game.seasonStats)) {
    if (!Object.hasOwn(game.players, playerId)) {
      return { path: `game.seasonStats.${playerId}`, problem: 'unknown-player' };
    }
  }
  const played = new Set<string>();
  for (const [i, f] of game.fixtures.entries()) {
    if (!Object.hasOwn(game.clubs, f.homeId) || !Object.hasOwn(game.clubs, f.awayId)) {
      return { path: `game.fixtures.${i}`, problem: 'unknown-club' };
    }
    if (f.result !== undefined) played.add(f.id);
  }
  for (const [key, sheet] of Object.entries(career.matchSheets)) {
    if ((sheet as { fixtureId?: unknown }).fixtureId !== key || !played.has(key)) {
      return { path: `career.matchSheets.${key}`, problem: 'unknown-fixture' };
    }
  }
  // D4 (US-066): season 1 is played in the base season's year, and each turn adds one.
  if (game.year !== career.baseSeason + game.season - 1) {
    return { path: 'game.year', problem: 'base-season-mismatch' };
  }
  return undefined;
}

/**
 * Checks that `raw` is a save of the current format, strictly (see {@link SaveCheck} for how much
 * of it), and coherent; with `careerId`, that career's. Never throws, whatever the input (a getter
 * that throws is an invalid save). On success the value is valibot's copy of the input.
 */
export function parseCareerSave(
  raw: unknown,
  options: { readonly careerId?: string; readonly check?: SaveCheck } = {},
): SaveResult<CareerSave, 'invalid-save'> {
  const check = options.check ?? 'full';
  try {
    if (check !== 'write' && hasForbiddenKey(raw)) {
      return fail('invalid-save', { path: '', problem: 'forbidden-key' } satisfies SaveIssue);
    }
    const parsed = v.safeParse(SCHEMAS[check], raw, { abortEarly: true });
    if (!parsed.success) return fail('invalid-save', issueOf(parsed.issues));
    const save = parsed.output as CareerSave;
    if (options.careerId !== undefined && save.careerId !== options.careerId) {
      return fail('invalid-save', {
        path: 'careerId',
        problem: 'other-career',
      } satisfies SaveIssue);
    }
    if (check === 'write') {
      // The store groups the sheets by the calendar itself; here only the coach's club.
      return Object.hasOwn(save.game.clubs, save.career.clubId)
        ? ok(save)
        : fail('invalid-save', { path: 'career.clubId', problem: 'unknown-club' });
    }
    const incoherent = incoherence(save);
    return incoherent === undefined ? ok(save) : fail('invalid-save', incoherent);
  } catch {
    return fail('invalid-save', { path: '', problem: 'unreadable' } satisfies SaveIssue);
  }
}

/** Checks the match sheets of one round (a row of the `matchSheets` store). Never throws. */
export function parseRoundSheets(
  raw: unknown,
): SaveResult<Readonly<Record<FixtureId, MatchSheet>>, 'invalid-save'> {
  try {
    if (hasForbiddenKey(raw)) return fail('invalid-save', { path: '', problem: 'forbidden-key' });
    const parsed = v.safeParse(roundSheetsSchema, raw, { abortEarly: true });
    if (!parsed.success) return fail('invalid-save', issueOf(parsed.issues));
    for (const [key, sheet] of Object.entries(parsed.output)) {
      if (sheet.fixtureId !== key)
        return fail('invalid-save', { path: key, problem: 'key-mismatch' });
    }
    return ok(parsed.output);
  } catch {
    return fail('invalid-save', { path: '', problem: 'unreadable' });
  }
}
