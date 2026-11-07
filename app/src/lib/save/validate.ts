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
  type DraftSheet,
  type FixtureId,
  type GameRules,
  type GameState,
  type HalftimeChoice,
  type InjurySeverity,
  type MatchSheet,
  type MissOutcome,
  type Player,
  type PlayerId,
  type Posture,
  type Pressure,
  type Side,
  type TacticPreset,
} from '../../engine/index.ts';
import { isSafeDisplayText } from '../safe-text.ts';
import { fail, ok, type SaveResult } from './result.ts';
import { SAVE_SCHEMA_VERSION, type CareerSave } from './schema.ts';

/*
 * The strict schema of the current save format, v2 (ADR-0006, ADR-0021; docs/02-architecture.md,
 * 4.2; T-019, T-075). It is
 * what a snapshot passes after the migration when it opens, what a save passes before it is
 * written, and what an imported file will pass (T-020), so it reads untrusted input:
 *
 * - every object is strict (an unknown key fails), every text and list has a length bound, and
 *   every text that reaches the screen (the nickname, the variables of news and posts, club and
 *   player names) passes `isSafeDisplayText` (no controls, invisible or direction marks, zalgo;
 *   NFC);
 * - a key named `prototype` or after a member of `Object.prototype` (`__proto__`, `constructor`,
 *   `toString`, `valueOf`, `hasOwnProperty`...) fails: valibot 1.4's strict object tests a key
 *   with `key in entries`, so those names pass as known keys and are dropped from its output
 *   silently. The search runs in the `full` check (anywhere), in the `write` check (the envelope
 *   and the career the application layer builds) and in every row of sheets written;
 * - the player is checked by the engine's own `validatePlayer` and the club definitions by
 *   `validateClubs`, never by ranges typed again here (docs/02-architecture.md, 4.1). The closed
 *   lists and ranges the engine exports (formations, positions, ratings...) are read from it;
 * - the lists the engine has only as a type (sides, pressures, kinds of facts...) are written here
 *   with `satisfies`, and a type check both ways between the schema and `CareerSave` makes the
 *   compiler refuse a drift;
 * - after the shape, a coherence check: the ids that the save references exist (the coach's club,
 *   the squads, the calendar, the sheets, the coach's draft sheet) and the first season's year is
 *   the base season (US-066).
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
  /** `appVersion` of the envelope. */
  appVersionLength: 32,
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
/** A text shown on the screen: bounded, and safe to show (`isSafeDisplayText`). */
const text = (max: number = SAVE_LIMITS.textLength) =>
  v.pipe(v.string(), v.maxLength(max), v.check(isSafeDisplayText, 'unsafe-text'));
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(SAVE_LIMITS.idLength));
const sha256 = v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/));
const isoDate = v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/));
const round = int(1, SEASON_ROUNDS);
/** Matches of a season: 20 clubs, each against each other twice (SEASON_ROUNDS = 2 × 19). */
const MAX_FIXTURES = (SEASON_ROUNDS * (SEASON_ROUNDS + 2)) / 4;
/** Matches of a round: 20 clubs, two by two. */
const MATCHES_PER_ROUND = (SEASON_ROUNDS + 2) / 4;
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
  results: list(matchRecap, MATCHES_PER_ROUND),
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

/** Slots of a formation: 11 in every one of them. */
const XI = Math.max(...FORMATIONS.map((f) => FORMATION_SLOTS[f].length));

/** A tactic chosen before the match: the 3 pre-match postures (never `allOut`). */
const tactic = v.strictObject({
  posture: v.picklist(PRE_MATCH_POSTURES),
  pressure: v.picklist(PRESSURES),
});

const teamSheet = v.strictObject({
  lineup: v.strictObject({
    formation,
    starters: list(id, XI),
    bench: list(id, BENCH_SIZE),
    captains: list(id, SAVE_LIMITS.takers),
    penaltyTakers: list(id, SAVE_LIMITS.takers),
    freeKickTakers: list(id, SAVE_LIMITS.takers),
  }),
  tactic,
});

/** No id twice among `ids` (free slots, `null`, may repeat). */
function noRepeat(ids: readonly (string | null)[]): boolean {
  const seen = new Set<string>();
  for (const playerId of ids) {
    if (playerId === null) continue;
    if (seen.has(playerId)) return false;
    seen.add(playerId);
  }
  return true;
}

/**
 * The coach's sheet being edited (`career.draft`, ADR-0021, item 7): exactly 11 starters and up
 * to 7 bench slots, each an id or `null` (a free slot); each role list with up to 11 ids (the
 * distinct starters; the screen's limit of 3 is the reconciliation's, not the format's); the
 * pre-match tactic. No id twice in the 11 and the bench, nor in one list. The ids are checked
 * against the coach's squad by the coherence ({@link draftIncoherence}).
 */
export const draftSheetSchema = v.strictObject({
  lineup: v.pipe(
    v.strictObject({
      formation,
      starters: v.pipe(v.array(v.nullable(id)), v.length(XI)),
      bench: list(v.nullable(id), BENCH_SIZE),
      captains: list(id, XI),
      penaltyTakers: list(id, XI),
      freeKickTakers: list(id, XI),
    }),
    v.check((lineup) => noRepeat([...lineup.starters, ...lineup.bench]), 'duplicate-player'),
    v.check(
      (lineup) =>
        noRepeat(lineup.captains) &&
        noRepeat(lineup.penaltyTakers) &&
        noRepeat(lineup.freeKickTakers),
      'duplicate-player',
    ),
  ),
  tactic,
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
const player = v.custom<Player>((value) => {
  const checked = validatePlayer(value);
  if (!checked.ok) return false;
  const { display, full, family } = checked.value.name;
  return isSafeDisplayText(display) && isSafeDisplayText(full) && isSafeDisplayText(family);
});

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
  return (
    checked.ok &&
    defs.every(
      (def) =>
        typeof def.strength === 'number' &&
        [def.name, def.shortName, def.nickname, def.city, def.stadium.name].every(
          isSafeDisplayText,
        ),
    )
  );
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
// The envelope (schema.ts, CareerSaveV2)

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
    v.check(isSafeDisplayText, 'unsafe-text'),
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
  /** The same schema in the three levels: the application layer builds it (ADR-0021). */
  draft: v.exactOptional(draftSheetSchema),
};

const envelopeEntries = {
  schemaVersion: v.literal(SAVE_SCHEMA_VERSION),
  careerId: v.pipe(v.string(), v.uuid()),
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
  updatedAt: v.pipe(v.string(), v.isoTimestamp()),
  appVersion: v.pipe(v.string(), v.minLength(1), v.maxLength(SAVE_LIMITS.appVersionLength)),
  engineVersion: positive,
  paramsHash: sha256,
};

/**
 * The strict schema of {@link CareerSave} in the current format (v2): every field, down to each
 * event of each match sheet. An imported file (T-020) and a migrated save pass this one.
 */
export const careerSaveSchema = v.strictObject({
  ...envelopeEntries,
  career: v.strictObject(careerEntries),
  game: gameState,
});

/** The match sheets of one round, as a row of the `matchSheets` store keeps them. */
export const roundSheetsSchema = dict(matchSheet, MATCHES_PER_ROUND);

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
 * Writing a save: the envelope and the career strictly (the coach's draft sheet included); of what
 * the engine made (the state, the round's recap, the sheets) only what the store reads, and the
 * squads, which the coherence of the draft reads (ADR-0021). The engine's output passes the full
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
    year: positive,
    season: positive,
    round: int(1, SEASON_ROUNDS + 1),
    clubs: dict(v.looseObject({ def: plainObject }), SAVE_LIMITS.clubs),
    players: plainObject,
    squads: dict(list(id, SAVE_LIMITS.squad), SAVE_LIMITS.clubs),
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
 * `open` reads data this game made and the SHA-256 protects, so it skips the search for
 * prototype keys, which costs a third of it (valibot's output never has them); `write` searches
 * only the part the application layer builds (docs/02-architecture.md, 4.2).
 */
export type SaveCheck = 'full' | 'open' | 'write';

const SCHEMAS: Readonly<Record<SaveCheck, v.GenericSchema>> = {
  full: careerSaveSchema,
  open: openSchema,
  write: writeSchema,
};

/**
 * A key that could reach a prototype or that valibot's strict object takes for a known key:
 * `prototype`, or the name of any member of `Object.prototype` (`__proto__`, `constructor`,
 * `toString`, `valueOf`, `hasOwnProperty`, `__defineGetter__`...).
 */
const isForbidden = (key: string) => key === 'prototype' || key in Object.prototype;

/**
 * `true` when some key of `value`, at any depth, is forbidden (see {@link isForbidden}). Also run
 * on an older save before its migration (store.ts, and the import of T-020): the steps copy with
 * spread, so such a key never reaches a prototype on the way.
 */
export function hasForbiddenKey(value: unknown): boolean {
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

/**
 * The search of the `write` check: the envelope and the career, the part the application layer
 * builds, without the state, the round's recap and the sheets (the engine's; each new row of
 * sheets is searched by {@link parseRoundSheets}).
 */
function writeSurfaceHasForbiddenKey(raw: unknown): boolean {
  if (!isPlainObject(raw)) return false;
  for (const key of Object.keys(raw)) {
    if (isForbidden(key)) return true;
    const value = raw[key];
    if (key === 'game') continue;
    if (key !== 'career' || !isPlainObject(value)) {
      if (hasForbiddenKey(value)) return true;
      continue;
    }
    for (const field of Object.keys(value)) {
      if (isForbidden(field)) return true;
      if (field !== 'matchSheets' && field !== 'lastRound' && hasForbiddenKey(value[field])) {
        return true;
      }
    }
  }
  return false;
}

/** Longest segment and whole path of an error (security review L1). */
const PATH_SEGMENT_MAX = 40;
const PATH_MAX = 200;

/**
 * The dotted path of an error from its segments: each one cut to 40 characters, one that is not
 * safe to show (or empty, or with a dot) as `<key>`, the whole cut to 200. A key of a hostile
 * file never reaches the error log as it is.
 */
export function errorPath(segments: readonly unknown[]): string {
  const parts = segments.map((segment) => {
    const text = typeof segment === 'number' ? String(segment) : segment;
    if (typeof text !== 'string' || text === '' || text.includes('.')) return '<key>';
    if (!isSafeDisplayText(text)) return '<key>';
    const chars = [...text];
    return chars.length > PATH_SEGMENT_MAX ? chars.slice(0, PATH_SEGMENT_MAX).join('') : text;
  });
  const path = [...parts.join('.')];
  return path.length > PATH_MAX ? path.slice(0, PATH_MAX).join('') : path.join('');
}

const at = (...segments: readonly unknown[]) => errorPath(segments);

function issueOf(issues: readonly v.BaseIssue<unknown>[]): SaveIssue {
  const issue = issues[0];
  return {
    path: errorPath(issue?.path?.map((item) => item.key) ?? []),
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
    if (club.def.id !== key)
      return { path: at('game', 'clubs', key, 'def', 'id'), problem: 'key-mismatch' };
  }
  const own = writeIncoherence(save);
  if (own?.problem === 'unknown-club') return own;
  for (const [key, p] of Object.entries(game.players)) {
    if (p.id !== key) return { path: at('game', 'players', key, 'id'), problem: 'key-mismatch' };
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
        return { path: at('game', 'squads', clubId, i), problem: 'unknown-player' };
      }
    }
  }
  for (const clubId of Object.keys(game.lastSheets)) {
    if (!Object.hasOwn(game.clubs, clubId)) {
      return { path: at('game', 'lastSheets', clubId), problem: 'unknown-club' };
    }
  }
  for (const playerId of Object.keys(game.seasonStats)) {
    if (!Object.hasOwn(game.players, playerId)) {
      return { path: at('game', 'seasonStats', playerId), problem: 'unknown-player' };
    }
  }
  const played = new Set<string>();
  for (const [i, f] of game.fixtures.entries()) {
    if (!Object.hasOwn(game.clubs, f.homeId) || !Object.hasOwn(game.clubs, f.awayId)) {
      return { path: at('game', 'fixtures', i), problem: 'unknown-club' };
    }
    if (f.result !== undefined) played.add(f.id);
  }
  for (const [key, sheet] of Object.entries(career.matchSheets)) {
    if ((sheet as { fixtureId?: unknown }).fixtureId !== key || !played.has(key)) {
      return { path: at('career', 'matchSheets', key), problem: 'unknown-fixture' };
    }
  }
  return own;
}

/** The parts of a draft lineup with ids, in the order of the coherence check. */
const DRAFT_PARTS = ['starters', 'bench', 'captains', 'penaltyTakers', 'freeKickTakers'] as const;

/**
 * The coherence of the coach's draft sheet (ADR-0021, item 7): every id of it (starters, bench
 * and lists) is in `squad`, the coach's squad; else `unknown-player` at
 * `<prefix>.lineup.<part>.<index>`. The one implementation, used by the save's coherence in the
 * three levels and by {@link parseDraft}: what the write accepts, the opening accepts.
 */
function draftIncoherence(
  draft: DraftSheet,
  squad: readonly PlayerId[],
  prefix: readonly string[],
): SaveIssue | undefined {
  const members = new Set(squad);
  for (const part of DRAFT_PARTS) {
    for (const [i, playerId] of draft.lineup[part].entries()) {
      if (playerId !== null && !members.has(playerId)) {
        return { path: at(...prefix, 'lineup', part, i), problem: 'unknown-player' };
      }
    }
  }
  return undefined;
}

/** The squad of `clubId` in `game`, or none. */
function squadOf(game: Pick<GameState, 'squads'>, clubId: string): readonly PlayerId[] {
  return Object.hasOwn(game.squads, clubId) ? game.squads[clubId]! : [];
}

/** The part of {@link incoherence} that the application layer builds (the `write` check). */
function writeIncoherence(save: CareerSave): SaveIssue | undefined {
  if (!Object.hasOwn(save.game.clubs, save.career.clubId)) {
    return { path: 'career.clubId', problem: 'unknown-club' };
  }
  // D4 (US-066): season 1 is played in the base season's year, and each turn adds one.
  if (save.game.year !== save.career.baseSeason + save.game.season - 1) {
    return { path: 'game.year', problem: 'base-season-mismatch' };
  }
  const draft = save.career.draft;
  if (draft !== undefined) {
    return draftIncoherence(draft, squadOf(save.game, save.career.clubId), ['career', 'draft']);
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
    if (
      check === 'full'
        ? hasForbiddenKey(raw)
        : check === 'write' && writeSurfaceHasForbiddenKey(raw)
    ) {
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
      // What the open's coherence reads of the application layer's part (what the write accepts,
      // the opening accepts): the coach's club, the base season and the draft sheet's ids in the
      // coach's squad. The store checks the sheets
      // against the calendar itself; the rest of the coherence is the engine's, tested.
      const issue = writeIncoherence(save);
      return issue === undefined ? ok(save) : fail('invalid-save', issue);
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
        return fail('invalid-save', { path: at(key), problem: 'key-mismatch' });
    }
    return ok(parsed.output);
  } catch {
    return fail('invalid-save', { path: '', problem: 'unreadable' });
  }
}

/**
 * Checks the coach's draft sheet kept in the `careers` row (ADR-0021, item 7) against `squad`, the
 * coach's squad in the save it goes with: the same schema as `career.draft`, the same coherence and
 * the search for prototype keys. `SaveStore.writeDraft` calls it before writing and `openCareer`
 * before using the row's sheet. Never throws; the issue's path is relative to the sheet
 * (`lineup.starters.3`), and never has the value.
 */
export function parseDraft(
  raw: unknown,
  squad: readonly PlayerId[],
): SaveResult<DraftSheet, 'invalid-save'> {
  try {
    if (hasForbiddenKey(raw)) return fail('invalid-save', { path: '', problem: 'forbidden-key' });
    const parsed = v.safeParse(draftSheetSchema, raw, { abortEarly: true });
    if (!parsed.success) return fail('invalid-save', issueOf(parsed.issues));
    const issue = draftIncoherence(parsed.output, squad, []);
    return issue === undefined ? ok(parsed.output) : fail('invalid-save', issue);
  } catch {
    return fail('invalid-save', { path: '', problem: 'unreadable' });
  }
}
