import { Rng } from '@engine/rng';

/**
 * Fictional player names (US-003). The engine keeps only `Player.nameSeed`; the name is produced
 * here, outside the engine, and is a pure function of (nameSeed, lists): same seed, same lists,
 * same name, forever.
 *
 * Browser-safe on purpose (no node:crypto): the blocklist of real athletes is consulted through an
 * injected `isBlocked` predicate. In production the predicate is not needed, because CI proves the
 * lists cannot produce a blocked name (see `findBlockedNames`); tests and CI build the predicate
 * from app/src/data/athletes-blocklist.sha256.json with the Node-only helpers of data/blocklist.ts.
 */

/** Content lists, one set per nationality (Etapa 1: only Brazilian). All entries are fictional. */
export interface NameLists {
  /** Simple first names. */
  given: readonly string[];
  /** Compound first names ("João Pedro"), used in about 4% of the first names. */
  givenCompound: readonly string[];
  /** Surnames. */
  family: readonly string[];
  /** Short forms of first names (diminutives); never shown alone. */
  short: readonly string[];
  /** Base nicknames ("apelidos de boleiro"). */
  nicknames: readonly string[];
  /** Invented places ("Vale Cometa"), shown after a first name or short form. */
  origins: readonly string[];
}

export interface PlayerName {
  /** Seed that reproduces exactly this name through `nameFromSeed`; store it in `Player.nameSeed`. */
  nameSeed: number;
  /** Name shown in the UI (one of the seven forms of `DISPLAY_FORMS`). */
  display: string;
  /** "First Surname" or "First Surname Surname2". */
  full: string;
  /** First surname, used by the squad rule of at most 3 per surname. */
  family: string;
}

/** True when the name matches a real athlete. Receives the display and the full name separately. */
export type IsBlocked = (name: string) => boolean;

/** Cumulative weights of the seven display forms (30/25/15/10/8/7/5, docs/content/lotes). */
const FORM_LIMITS = [0.3, 0.55, 0.7, 0.8, 0.88, 0.95, 1] as const;
const COMPOUND_SHARE = 0.04;
const SECOND_FAMILY_SHARE = 0.35;
const MIN_SURNAME_ONLY_LETTERS = 4;
const MAX_PER_FAMILY = 3;
const MAX_ATTEMPTS = 200;

/** The seven display forms, in the order of `FORM_LIMITS`. */
export const DISPLAY_FORMS = [
  'given-family',
  'family',
  'short-family',
  'nickname',
  'name-origin',
  'given-nickname',
  'short-nickname',
] as const;

/**
 * Key for comparing names: same rule as `normalizeName` in data/blocklist.ts (kept in sync by a
 * test) plus hyphen to space. Repeated here because that file imports node:crypto and cannot go
 * to the browser. The hyphen step only matters to comparisons inside the squad: the lists hold no
 * hyphens (`checkNameLists`), so hashes of generated names never depend on it.
 */
export function normalizeNameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function letterCount(name: string): number {
  return normalizeNameKey(name).replace(/[^\p{L}]/gu, '').length;
}

/**
 * The name for a seed. Pure; does not look at any blocklist. Always consumes the same draws, so
 * each choice depends only on the seed and its own list.
 */
export function nameFromSeed(nameSeed: number, lists: NameLists): PlayerName {
  const rng = new Rng(nameSeed);
  const compound = rng.next() < COMPOUND_SHARE ? rng.pick(lists.givenCompound) : undefined;
  const simple = rng.pick(lists.given);
  const given = compound ?? simple ?? '';
  const familyCount = lists.family.length;
  const i1 = rng.int(0, Math.max(0, familyCount - 1));
  const i2 = rng.int(0, Math.max(0, familyCount - 2));
  const family = lists.family[i1] ?? '';
  const hasSecond = rng.next() < SECOND_FAMILY_SHARE && familyCount > 1;
  const family2 = hasSecond ? (lists.family[i2 >= i1 ? i2 + 1 : i2] ?? '') : '';
  const short = rng.pick(lists.short) ?? given;
  const nickname = rng.pick(lists.nicknames);
  const origin = rng.pick(lists.origins);
  const useShort = rng.next() < 0.5; // for the origin form: first name or short form
  const roll = rng.next();

  const form = DISPLAY_FORMS[FORM_LIMITS.findIndex((limit) => roll < limit)] ?? 'given-family';
  const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' ');
  let display = join(given, family);
  if (form === 'family' && letterCount(family) >= MIN_SURNAME_ONLY_LETTERS) display = family;
  else if (form === 'short-family') display = join(short, family);
  else if (form === 'nickname' && nickname !== undefined) display = nickname;
  else if (form === 'name-origin' && origin !== undefined) {
    display = join(useShort ? short : given, origin);
  } else if (form === 'given-nickname' && nickname !== undefined) {
    display = join(given, nickname);
  } else if (form === 'short-nickname' && nickname !== undefined) {
    display = join(short, nickname);
  }
  return { nameSeed: nameSeed >>> 0, display, full: join(given, family, family2), family };
}

/**
 * Names for a whole squad. Rules, all deterministic: no two with the same display name (accents,
 * case and hyphens ignored); a bare surname display ("Tavares") does not share the squad with
 * another player of that surname, and vice versa; at most 3 players per first surname; and no
 * display or full name blocked. Candidate seeds come from `seed` in order, so a rejected name is
 * skipped the same way every time, and each result carries the seed that reproduces it alone
 * through `nameFromSeed`. Never throws: with degenerate lists it gives up after 200 tries and
 * numbers the display ("Nome 2"), which only happens in tests.
 */
export function namesForSquad(
  seed: number,
  count: number,
  lists: NameLists,
  isBlocked?: IsBlocked,
): PlayerName[] {
  const rng = new Rng(seed);
  const displays = new Set<string>();
  const perFamily = new Map<string, { count: number; bare: boolean }>();
  const result: PlayerName[] = [];
  for (let i = 0; i < count; i++) {
    let chosen: PlayerName | undefined;
    let last: PlayerName | undefined;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && chosen === undefined; attempt++) {
      const candidate = nameFromSeed(rng.int(0, 0xffffffff), lists);
      last = candidate;
      const key = normalizeNameKey(candidate.display);
      const familyKey = normalizeNameKey(candidate.family);
      const sameFamily = perFamily.get(familyKey);
      const bare = key === familyKey;
      const clash =
        displays.has(key) ||
        (sameFamily !== undefined &&
          (sameFamily.count >= MAX_PER_FAMILY ||
            (bare && sameFamily.count > 0) ||
            sameFamily.bare));
      const blocked = isBlocked?.(candidate.display) || isBlocked?.(candidate.full);
      if (!clash && !blocked) chosen = candidate;
    }
    if (chosen === undefined) {
      let n = 2;
      const base = last ?? nameFromSeed(0, lists);
      while (displays.has(normalizeNameKey(`${base.display} ${n}`))) n++;
      chosen = { ...base, display: `${base.display} ${n}` };
    }
    const key = normalizeNameKey(chosen.display);
    const familyKey = normalizeNameKey(chosen.family);
    displays.add(key);
    const entry = perFamily.get(familyKey) ?? { count: 0, bare: false };
    entry.count++;
    entry.bare ||= key === familyKey;
    perFamily.set(familyKey, entry);
    result.push(chosen);
  }
  return result;
}

export type NameKind =
  'nickname' | 'family' | 'first-family' | 'first-nickname' | 'first-origin' | 'second-family';

/**
 * Every string the lists can show as a display name or a full name (each form of
 * `DISPLAY_FORMS`, and "First Surname Surname2" for simple or compound first names), with the
 * kind of form that makes it. The `second-family` kind is the bulk (|first names| x |surnames|^2),
 * so it can be skipped.
 */
export function* labeledNames(
  lists: NameLists,
  { withSecondFamily = true } = {},
): Generator<{ name: string; kind: NameKind }> {
  const givens = [...lists.given, ...lists.givenCompound];
  const initials = [...givens, ...lists.short];
  for (const name of lists.nicknames) yield { name, kind: 'nickname' };
  for (const name of lists.family) yield { name, kind: 'family' };
  for (const f of lists.family) {
    for (const g of initials) yield { name: `${g} ${f}`, kind: 'first-family' };
  }
  for (const n of lists.nicknames) {
    for (const g of initials) yield { name: `${g} ${n}`, kind: 'first-nickname' };
  }
  for (const o of lists.origins) {
    for (const g of initials) yield { name: `${g} ${o}`, kind: 'first-origin' };
  }
  if (!withSecondFamily) return;
  for (const g of givens) {
    for (const f of lists.family) {
      for (const f2 of lists.family) {
        if (f2 !== f) yield { name: `${g} ${f} ${f2}`, kind: 'second-family' };
      }
    }
  }
}

/** Names the lists can produce that the predicate blocks, with their kind. Empty means clean. */
export function findBlockedNames(
  lists: NameLists,
  isBlocked: IsBlocked,
  options?: { withSecondFamily?: boolean },
): { name: string; kind: NameKind }[] {
  const found = new Map<string, NameKind>();
  for (const { name, kind } of labeledNames(lists, options)) {
    if (!found.has(name) && isBlocked(name)) found.set(name, kind);
  }
  return [...found].map(([name, kind]) => ({ name, kind }));
}

export type NameListProblem = 'empty-list' | 'blank-entry' | 'duplicate-entry' | 'has-hyphen';
export interface NameListIssue {
  list: keyof NameLists;
  problem: NameListProblem;
  value?: string;
}

const LIST_KEYS = [
  'given',
  'givenCompound',
  'family',
  'short',
  'nicknames',
  'origins',
] as const satisfies readonly (keyof NameLists)[];

/**
 * Structural check of the lists: not empty, no blanks, no repeats after normalization, no hyphens
 * (the blocklist hash does not turn hyphens into spaces, so a hyphenated entry could slip past).
 */
export function checkNameLists(lists: NameLists): NameListIssue[] {
  const issues: NameListIssue[] = [];
  for (const list of LIST_KEYS) {
    if (lists[list].length === 0) issues.push({ list, problem: 'empty-list' });
    const seen = new Set<string>();
    for (const value of lists[list]) {
      const key = normalizeNameKey(value);
      if (key === '') issues.push({ list, problem: 'blank-entry' });
      else if (seen.has(key)) issues.push({ list, problem: 'duplicate-entry', value });
      if (value.includes('-')) issues.push({ list, problem: 'has-hyphen', value });
      seen.add(key);
    }
  }
  return issues;
}
