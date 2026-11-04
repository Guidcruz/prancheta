import type { AiProfile, ClubId, ClubSize, EngineWarning, Result } from './types.ts';

/*
 * Club definitions (docs/02-architecture.md, 3 "Dados de jogo" and 4.1; US-001). The approved
 * list lives in app/src/data/clubs.serie-a.json and enters the engine as an argument; the engine
 * never imports app/src/data/. This module owns the type and the structural validator.
 *
 * The checks that need the host (the SHA-256 blocklist and the shield generator of lib/) live in
 * app/src/data/check.ts, which runs only in Node (Vitest and `npm run content:check`).
 */

/** One club of the game, as approved by the CEO. Read-only: the engine never changes it. */
export interface ClubDef {
  readonly id: ClubId;
  readonly name: string;
  readonly shortName: string;
  /** Three capital letters, unique in the league, e.g. "FLG"; also the letter of the shield. */
  readonly abbreviation: string;
  readonly nickname: string;
  readonly city: string;
  /** Two-letter state code (UF), e.g. "SP". */
  readonly state: string;
  /** Primary and secondary colour, `#rrggbb`. */
  readonly colors: readonly [string, string];
  readonly size: ClubSize;
  /** Absent: drawn by size with the career seed (docs/design/ia-clubes.md). */
  readonly aiProfile?: AiProfile;
  /**
   * Target strength of the first XI, from the placement in the reference table; unrelated to
   * `size` (docs/design/clubes-serie-a.md). Absent in the data: {@link DEFAULT_STRENGTH}, with a
   * warning; always present in the output of {@link validateClubs}.
   */
  readonly strength?: number;
  readonly stadium: { readonly name: string; readonly capacity: number };
  /** Derbies. May be empty; when present, both clubs list each other. */
  readonly rivals: readonly ClubId[];
  /**
   * Titles won before the first season: Brasileiro, Copa do Brasil, Libertadores and
   * Sul-Americana. Static content for news and club cards; the engine computes nothing from it
   * (docs/design/clubes-serie-a.md).
   */
  readonly titles: ClubTitles;
}

export interface ClubTitles {
  readonly league: number;
  readonly cup: number;
  readonly libertadores: number;
  readonly sudamericana: number;
}

/** Clubs in a Série A season (SEASON_ROUNDS = 2 × (SERIE_A_CLUBS − 1)). */
export const SERIE_A_CLUBS = 20;

export const CLUB_SIZES: readonly ClubSize[] = ['big', 'medium', 'small'];
export const AI_PROFILES: readonly AiProfile[] = [
  'ambitious',
  'academy',
  'seller',
  'traditional',
  'chaotic',
];

/**
 * Valid `strength`, inclusive, whatever the size: size is who the club is, strength is how the
 * squad is now (docs/design/clubes-serie-a.md, "Porte e força").
 */
export const STRENGTH_RANGE: { readonly min: number; readonly max: number } = { min: 55, max: 85 };
/** `strength` of a club without one in the data: the middle of the ladder. */
export const DEFAULT_STRENGTH = 70;

/** Text fields compared against the blocklist of real names (US-001). */
export const BLOCKLIST_FIELDS = [
  'name',
  'shortName',
  'abbreviation',
  'nickname',
  'stadium.name',
] as const;
export type BlocklistField = (typeof BLOCKLIST_FIELDS)[number];

export type ClubProblem =
  | 'not-a-list'
  | 'club-count'
  | 'not-an-object'
  | 'missing'
  | 'unknown-key'
  | 'not-a-string'
  | 'empty'
  | 'invalid-id'
  | 'duplicate-id'
  | 'invalid-abbreviation'
  | 'duplicate-abbreviation'
  | 'invalid-state'
  | 'invalid-color'
  | 'invalid-size'
  | 'invalid-ai-profile'
  | 'not-a-number'
  | 'not-an-integer'
  | 'out-of-range'
  | 'self-rival'
  | 'duplicate-rival'
  | 'unknown-rival'
  | 'asymmetric-rival'
  /** A getter or Proxy trap threw while reading the input. */
  | 'unreadable';

/**
 * One reason why a club list was refused. `index` is the position in the list and `clubId` the
 * id when it is readable; `field` is dotted inside the club (`stadium.name`, `colors.1`), empty
 * for the list itself. `other` names the second club of a pair (duplicate id, rival).
 */
export interface ClubIssue {
  index?: number;
  clubId?: string;
  field: string;
  problem: ClubProblem;
  value?: unknown;
  other?: string;
  range?: { min: number; max: number };
}

/** Result of {@link validateClubs}: a `Result<ClubDef[], 'invalid-clubs'>` with typed detail. */
type ClubsBase = Result<ClubDef[], 'invalid-clubs'>;
export type ClubsResult =
  Extract<ClubsBase, { ok: true }> | (Extract<ClubsBase, { ok: false }> & { detail: ClubIssue[] });

export interface ValidateClubsOptions {
  /** Exact number of clubs expected; default {@link SERIE_A_CLUBS}. */
  count?: number;
}

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATE = /^[A-Z]{2}$/;
const ABBREVIATION = /^[A-Z]{3}$/;
const COLOR = /^#[0-9a-f]{6}$/i;

const CLUB_KEYS = [
  'id',
  'name',
  'shortName',
  'abbreviation',
  'nickname',
  'city',
  'state',
  'colors',
  'size',
  'aiProfile',
  'strength',
  'stadium',
  'rivals',
  'titles',
] as const;
const OPTIONAL_KEYS: ReadonlySet<string> = new Set(['aiProfile', 'strength']);
const STADIUM_KEYS = ['name', 'capacity'] as const;
const TITLE_KEYS = ['league', 'cup', 'libertadores', 'sudamericana'] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Collects issues of one club, tagged with its position and (once known) its id. */
class ClubScope {
  clubId: string | undefined;
  /** Issues added for this club so far. */
  count = 0;
  readonly index: number;
  private readonly issues: ClubIssue[];

  constructor(index: number, issues: ClubIssue[]) {
    this.index = index;
    this.issues = issues;
  }

  add(issue: Omit<ClubIssue, 'index' | 'clubId'>): void {
    const tagged: ClubIssue = { index: this.index, ...issue };
    if (this.clubId !== undefined) tagged.clubId = this.clubId;
    this.issues.push(tagged);
    this.count++;
  }
}

function checkText(scope: ClubScope, field: string, value: unknown): string | undefined {
  if (typeof value !== 'string') {
    scope.add({ field, problem: 'not-a-string', value });
    return undefined;
  }
  if (value.trim() === '') {
    scope.add({ field, problem: 'empty', value });
    return undefined;
  }
  return value;
}

function checkKeys(
  scope: ClubScope,
  prefix: string,
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  let complete = true;
  for (const key of keys) {
    if (!Object.hasOwn(value, key) && !OPTIONAL_KEYS.has(`${prefix}${key}`)) {
      scope.add({ field: `${prefix}${key}`, problem: 'missing' });
      complete = false;
    }
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) {
      scope.add({ field: `${prefix}${key}`, problem: 'unknown-key', value: value[key] });
    }
  }
  return complete;
}

function checkColors(scope: ClubScope, value: unknown): [string, string] | undefined {
  if (!Array.isArray(value) || value.length !== 2) {
    scope.add({ field: 'colors', problem: 'not-a-list', value });
    return undefined;
  }
  let valid = true;
  for (let i = 0; i < 2; i++) {
    const color = value[i] as unknown;
    if (typeof color !== 'string' || !COLOR.test(color)) {
      scope.add({ field: `colors.${i}`, problem: 'invalid-color', value: color });
      valid = false;
    }
  }
  return valid ? [value[0] as string, value[1] as string] : undefined;
}

function checkStadium(
  scope: ClubScope,
  value: unknown,
): { name: string; capacity: number } | undefined {
  if (!isPlainObject(value)) {
    scope.add({ field: 'stadium', problem: 'not-an-object', value });
    return undefined;
  }
  checkKeys(scope, 'stadium.', value, STADIUM_KEYS);
  const name = Object.hasOwn(value, 'name')
    ? checkText(scope, 'stadium.name', value.name)
    : undefined;
  const capacity = Object.hasOwn(value, 'capacity')
    ? checkCount(scope, 'stadium.capacity', value.capacity, 1)
    : undefined;
  return name !== undefined && capacity !== undefined ? { name, capacity } : undefined;
}

/** An integer of at least `min` (capacity, number of titles). */
function checkCount(
  scope: ClubScope,
  field: string,
  value: unknown,
  min: number,
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    scope.add({ field, problem: 'not-a-number', value });
  } else if (!Number.isInteger(value)) {
    scope.add({ field, problem: 'not-an-integer', value });
  } else if (value < min) {
    scope.add({ field, problem: 'out-of-range', value });
  } else {
    return value;
  }
  return undefined;
}

function checkTitles(scope: ClubScope, value: unknown): ClubTitles | undefined {
  if (!isPlainObject(value)) {
    scope.add({ field: 'titles', problem: 'not-an-object', value });
    return undefined;
  }
  checkKeys(scope, 'titles.', value, TITLE_KEYS);
  const titles: Record<string, number> = {};
  let complete = true;
  for (const key of TITLE_KEYS) {
    const count = Object.hasOwn(value, key)
      ? checkCount(scope, `titles.${key}`, value[key], 0)
      : undefined;
    if (count === undefined) complete = false;
    else titles[key] = count;
  }
  return complete ? (titles as unknown as ClubTitles) : undefined;
}

function checkRivalList(scope: ClubScope, value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    scope.add({ field: 'rivals', problem: 'not-a-list', value });
    return undefined;
  }
  const rivals: string[] = [];
  let valid = true;
  // Indexed loop, so holes of a sparse array are checked (as undefined) instead of skipped.
  for (let i = 0; i < value.length; i++) {
    const rival = value[i] as unknown;
    if (typeof rival !== 'string' || !ID.test(rival)) {
      scope.add({ field: `rivals.${i}`, problem: 'invalid-id', value: rival });
      valid = false;
    } else if (rivals.includes(rival)) {
      scope.add({ field: `rivals.${i}`, problem: 'duplicate-rival', value: rival, other: rival });
      valid = false;
    } else if (rival === scope.clubId) {
      scope.add({ field: `rivals.${i}`, problem: 'self-rival', value: rival });
      valid = false;
    } else {
      rivals.push(rival);
    }
  }
  return valid ? rivals : undefined;
}

/** Checks one entry of the list; returns a fresh ClubDef or undefined when anything is wrong. */
function checkClub(scope: ClubScope, raw: unknown): ClubDef | undefined {
  if (!isPlainObject(raw)) {
    scope.add({ field: '', problem: 'not-an-object', value: raw });
    return undefined;
  }
  // The id first, so every later issue of this club carries it.
  if (Object.hasOwn(raw, 'id')) {
    if (typeof raw.id === 'string' && ID.test(raw.id)) scope.clubId = raw.id;
    else scope.add({ field: 'id', problem: 'invalid-id', value: raw.id });
  }
  checkKeys(scope, '', raw, CLUB_KEYS);
  const has = (key: string) => Object.hasOwn(raw, key);

  const name = has('name') ? checkText(scope, 'name', raw.name) : undefined;
  const shortName = has('shortName') ? checkText(scope, 'shortName', raw.shortName) : undefined;
  let abbreviation: string | undefined;
  if (has('abbreviation')) {
    if (typeof raw.abbreviation === 'string' && ABBREVIATION.test(raw.abbreviation)) {
      abbreviation = raw.abbreviation;
    } else {
      scope.add({
        field: 'abbreviation',
        problem: 'invalid-abbreviation',
        value: raw.abbreviation,
      });
    }
  }
  const nickname = has('nickname') ? checkText(scope, 'nickname', raw.nickname) : undefined;
  const city = has('city') ? checkText(scope, 'city', raw.city) : undefined;
  let state: string | undefined;
  if (has('state')) {
    state = checkText(scope, 'state', raw.state);
    if (state !== undefined && !STATE.test(state)) {
      scope.add({ field: 'state', problem: 'invalid-state', value: state });
      state = undefined;
    }
  }
  const colors = has('colors') ? checkColors(scope, raw.colors) : undefined;

  let size: ClubSize | undefined;
  if (has('size')) {
    if (CLUB_SIZES.includes(raw.size as ClubSize)) size = raw.size as ClubSize;
    else scope.add({ field: 'size', problem: 'invalid-size', value: raw.size });
  }
  let aiProfile: AiProfile | undefined;
  if (has('aiProfile')) {
    if (AI_PROFILES.includes(raw.aiProfile as AiProfile)) aiProfile = raw.aiProfile as AiProfile;
    else scope.add({ field: 'aiProfile', problem: 'invalid-ai-profile', value: raw.aiProfile });
  }
  let strength: number | undefined;
  if (has('strength')) {
    const value = raw.strength;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      scope.add({ field: 'strength', problem: 'not-a-number', value });
    } else if (!Number.isInteger(value)) {
      scope.add({ field: 'strength', problem: 'not-an-integer', value });
    } else if (value < STRENGTH_RANGE.min || value > STRENGTH_RANGE.max) {
      const range = { ...STRENGTH_RANGE };
      scope.add({ field: 'strength', problem: 'out-of-range', value, range });
    } else {
      strength = value;
    }
  }
  const stadium = has('stadium') ? checkStadium(scope, raw.stadium) : undefined;
  const rivals = has('rivals') ? checkRivalList(scope, raw.rivals) : undefined;
  const titles = has('titles') ? checkTitles(scope, raw.titles) : undefined;

  if (scope.count > 0) return undefined;
  const club: {
    -readonly [K in keyof ClubDef]: ClubDef[K];
  } = {
    id: scope.clubId!,
    name: name!,
    shortName: shortName!,
    abbreviation: abbreviation!,
    nickname: nickname!,
    city: city!,
    state: state!,
    colors: colors!,
    size: size!,
    stadium: stadium!,
    rivals: rivals!,
    titles: titles!,
  };
  if (aiProfile !== undefined) club.aiProfile = aiProfile;
  club.strength = strength ?? DEFAULT_STRENGTH;
  return club;
}

/**
 * Rules across clubs: unique ids, every rival exists and lists the club back. Works on the raw
 * ids and rival lists that were readable, so a broken club elsewhere does not hide these issues.
 */
function checkAcrossClubs(
  entries: readonly { index: number; id: string; rivals: readonly unknown[] | undefined }[],
  issues: ClubIssue[],
): void {
  const byId = new Map<string, { index: number; rivals: readonly unknown[] | undefined }>();
  for (const entry of entries) {
    const first = byId.get(entry.id);
    if (first) {
      issues.push({
        index: entry.index,
        clubId: entry.id,
        field: 'id',
        problem: 'duplicate-id',
        value: entry.id,
        other: `#${first.index}`,
      });
    } else byId.set(entry.id, entry);
  }
  for (const entry of entries) {
    if (byId.get(entry.id)?.index !== entry.index || !entry.rivals) continue;
    entry.rivals.forEach((rival, i) => {
      if (typeof rival !== 'string' || !ID.test(rival) || rival === entry.id) return;
      const target = byId.get(rival);
      const base = { index: entry.index, clubId: entry.id, field: `rivals.${i}`, other: rival };
      if (!target) issues.push({ ...base, problem: 'unknown-rival', value: rival });
      else if (target.rivals && !target.rivals.includes(entry.id)) {
        issues.push({ ...base, problem: 'asymmetric-rival', value: rival });
      }
    });
  }
}

/** Abbreviations are unique in the league (they tell clubs apart in tables and on shields). */
function checkAbbreviations(raw: readonly unknown[], issues: ClubIssue[]): void {
  const first = new Map<string, number>();
  for (let index = 0; index < raw.length; index++) {
    const club = raw[index] as unknown;
    if (!isPlainObject(club) || typeof club.abbreviation !== 'string') continue;
    if (!ABBREVIATION.test(club.abbreviation)) continue;
    const seen = first.get(club.abbreviation);
    if (seen === undefined) {
      first.set(club.abbreviation, index);
      continue;
    }
    const other = raw[seen] as Record<string, unknown>;
    const issue: ClubIssue = {
      index,
      field: 'abbreviation',
      problem: 'duplicate-abbreviation',
      value: club.abbreviation,
      other: typeof other.id === 'string' ? other.id : `#${seen}`,
    };
    if (typeof club.id === 'string' && ID.test(club.id)) issue.clubId = club.id;
    issues.push(issue);
  }
}

/**
 * Checks a raw club list (the parsed JSON of app/src/data/) against the ClubDef contract:
 * exact count, required fields filled, known keys only, valid id slugs, colours, state, size,
 * profile, integer strength in STRENGTH_RANGE (absent: DEFAULT_STRENGTH with a
 * `club-strength-default` warning), positive integer capacity, titles as integers
 * of at least 0, unique ids, unique three-letter abbreviations and
 * symmetric derbies with existing clubs (an empty `rivals` is valid). Lists every issue at once
 * with club and field. Never throws; on success returns fresh copies that share nothing with
 * `raw`.
 */
export function validateClubs(raw: unknown, options: ValidateClubsOptions = {}): ClubsResult {
  // A getter or Proxy trap that throws is input, not a programming error: never let it escape.
  try {
    return checkClubs(raw, options);
  } catch {
    return { ok: false, error: 'invalid-clubs', detail: [{ field: '', problem: 'unreadable' }] };
  }
}

function checkClubs(raw: unknown, options: ValidateClubsOptions): ClubsResult {
  const count = options.count ?? SERIE_A_CLUBS;
  const issues: ClubIssue[] = [];
  if (!Array.isArray(raw)) {
    issues.push({ field: '', problem: 'not-a-list', value: raw });
    return { ok: false, error: 'invalid-clubs', detail: issues };
  }
  if (raw.length !== count) {
    issues.push({
      field: '',
      problem: 'club-count',
      value: raw.length,
      range: { min: count, max: count },
    });
  }
  const clubs: ClubDef[] = [];
  const warnings: EngineWarning[] = [];
  const entries: { index: number; id: string; rivals: readonly unknown[] | undefined }[] = [];
  for (let index = 0; index < raw.length; index++) {
    const scope = new ClubScope(index, issues);
    const club = checkClub(scope, raw[index] as unknown);
    if (club) {
      clubs.push(club);
      if (!Object.hasOwn(raw[index] as object, 'strength')) {
        warnings.push({ code: 'club-strength-default', detail: { clubId: club.id } });
      }
    }
    if (scope.clubId !== undefined) {
      const rawRivals = (raw[index] as Record<string, unknown>).rivals;
      // Kept as is (positions match `rivals.<i>`); unreadable items were reported above.
      const rivals = Array.isArray(rawRivals) ? (rawRivals as unknown[]) : undefined;
      entries.push({ index, id: scope.clubId, rivals });
    }
  }
  checkAcrossClubs(entries, issues);
  checkAbbreviations(raw, issues);
  if (issues.length > 0) return { ok: false, error: 'invalid-clubs', detail: issues };
  return { ok: true, value: clubs, warnings };
}
