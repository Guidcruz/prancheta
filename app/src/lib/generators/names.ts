import { Rng } from '@engine/rng';

/**
 * Fictional player names (US-003). The engine keeps only `Player.nameSeed`; the name is produced
 * here, outside the engine, and is a pure function of (nameSeed, lists, exclusions): same inputs,
 * same name, forever.
 *
 * Browser-safe on purpose (no node:crypto, no hashes in the bundle). Combinations that would match
 * a real athlete are listed BY INDEX in app/src/content/names/br.exclusions.json, generated in
 * Node by `npm run names:exclusions` (app/src/data/name-exclusions.ts) from the hashed blocklist.
 * The generator skips them deterministically; a test keeps the file in sync with the lists.
 */

/** Content lists, one set per nationality (Etapa 1: only Brazilian). All entries are fictional. */
export interface NameLists {
  /** Simple first names. */
  given: readonly string[];
  /** Compound first names ("João Pedro"), used in about 4% of the first names. */
  givenCompound: readonly string[];
  /** Surnames. */
  family: readonly string[];
  /** Short forms of first names (diminutives); never shown alone. The union of the two below. */
  short: readonly string[];
  /** Short form -> first names it belongs to ("Betinho": ["Alberto", "Roberto"]). For a compound
   * first name the first word counts. Absent together with `shortGeneric`: every short form fits. */
  shortOf?: Readonly<Record<string, readonly string[]>>;
  /** Short forms that fit any first name. */
  shortGeneric?: readonly string[];
  /** Base nicknames ("apelidos de boleiro"). */
  nicknames: readonly string[];
  /** Invented places, one word ("Vilacometa"); shown as "<first or short> de <origin>". */
  origins: readonly string[];
  /** Surnames (also in `family`) that never appear alone as a display name. */
  familyNoSolo?: readonly string[];
}

/**
 * Forbidden combinations as indices, no text. `first` indexes `given`, then `givenCompound`, then
 * `short` (concatenated, in this order). Triples use only the `given` and `givenCompound` part.
 */
export interface NameExclusionsFile {
  /** [first, family]: "First Surname" (display or full name) matches a real athlete. */
  firstFamily: [number, number][];
  /** [first, nickname]. */
  firstNickname: [number, number][];
  /** [first, origin]: "First de Origin". */
  firstOrigin: [number, number][];
  /** Nickname alone matches. */
  nickname: number[];
  /** Surname alone matches (beyond `familyNoSolo`). */
  family: number[];
  /** [first, family, family2]: full name with a second surname matches. */
  triples: [number, number, number][];
}

export interface NameExclusions {
  firstFamily: ReadonlySet<string>;
  firstNickname: ReadonlySet<string>;
  firstOrigin: ReadonlySet<string>;
  nickname: ReadonlySet<number>;
  family: ReadonlySet<number>;
  triples: ReadonlySet<string>;
}

export function compileExclusions(file: NameExclusionsFile): NameExclusions {
  const key = (t: readonly number[]) => t.join(',');
  return {
    firstFamily: new Set(file.firstFamily.map(key)),
    firstNickname: new Set(file.firstNickname.map(key)),
    firstOrigin: new Set(file.firstOrigin.map(key)),
    nickname: new Set(file.nickname),
    family: new Set(file.family),
    triples: new Set(file.triples.map(key)),
  };
}

export interface PlayerName {
  /** Seed that reproduces exactly this name through `nameFromSeed` (same lists and exclusions). */
  nameSeed: number;
  /** Name shown in the UI (one of the seven forms of `DISPLAY_FORMS`). */
  display: string;
  /** "First Surname" or "First Surname Surname2". */
  full: string;
  /** First surname, used by the squad rule of at most 3 per surname. */
  family: string;
  /**
   * Set only when the rules could not be met and a fallback was used: the exclusions kept
   * rejecting for 50 reseeds (`nameFromSeed`), or the squad rules for 200 candidates
   * (`namesForSquad`, which then numbers the display). Never happens with the real lists.
   */
  degraded?: true;
}

/** Cumulative weights of the seven display forms (30/25/15/10/8/7/5, docs/content/lotes). */
const FORM_LIMITS = [0.3, 0.55, 0.7, 0.8, 0.88, 0.95, 1] as const;
const COMPOUND_SHARE = 0.04;
const SECOND_FAMILY_SHARE = 0.35;
const MIN_SURNAME_ONLY_LETTERS = 4;
const MAX_PER_FAMILY = 3;
const MAX_ATTEMPTS = 200;
const MAX_RESEEDS = 50;
/** Share of the origin form shown with the first name; the rest uses a short form. */
const ORIGIN_WITH_FIRST_SHARE = 0.5;

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
 * Short forms that fit a first name (coherent short form): those whose `shortOf` lists the first
 * word of the name, plus `shortGeneric`. Indices into `lists.short`. Without `shortOf` and
 * `shortGeneric` every short form fits. An empty result means no short form: the caller shows the
 * first name instead ("Heitor Tavares" rather than an unrelated diminutive).
 */
const shortCache = new WeakMap<NameLists, Map<string, number[]>>();
function shortsFor(lists: NameLists, given: string): number[] {
  let byGiven = shortCache.get(lists);
  if (byGiven === undefined) shortCache.set(lists, (byGiven = new Map()));
  const word = normalizeNameKey(given.split(' ')[0] ?? '');
  let found = byGiven.get(word);
  if (found === undefined) {
    const generic = new Set((lists.shortGeneric ?? []).map(normalizeNameKey));
    const mapped = lists.shortOf;
    found = [];
    lists.short.forEach((short, i) => {
      const key = normalizeNameKey(short);
      const fits =
        (mapped === undefined && lists.shortGeneric === undefined) ||
        generic.has(key) ||
        (mapped?.[short] ?? []).some((g) => normalizeNameKey(g) === word);
      if (fits) found?.push(i);
    });
    byGiven.set(word, found);
  }
  return found;
}

interface Drawn {
  name: PlayerName;
  excluded: boolean;
}

/** One draw from a seed: always the same number of random draws, even with empty lists. */
function draw(nameSeed: number, lists: NameLists, ex: NameExclusions | undefined): Drawn {
  const rng = new Rng(nameSeed);
  const index = (length: number) => {
    const u = rng.next(); // drawn even for an empty list, to keep the draws fixed
    return length > 0 ? Math.floor(u * length) : -1;
  };
  const nGiven = lists.given.length;
  const nCompound = lists.givenCompound.length;
  const nFamily = lists.family.length;

  const useCompound = rng.next() < COMPOUND_SHARE && nCompound > 0;
  const compoundIdx = index(nCompound);
  const simpleIdx = index(nGiven);
  const firstIdx = useCompound ? nGiven + compoundIdx : simpleIdx;
  const given = (useCompound ? lists.givenCompound[compoundIdx] : lists.given[simpleIdx]) ?? '';
  const i1 = index(nFamily);
  const i2 = rng.int(0, Math.max(0, nFamily - 2));
  const family = lists.family[i1] ?? '';
  const hasSecond = rng.next() < SECOND_FAMILY_SHARE && nFamily > 1;
  const familyIdx2 = i2 >= i1 ? i2 + 1 : i2;
  const family2 = hasSecond ? (lists.family[familyIdx2] ?? '') : '';
  const fitting = shortsFor(lists, given);
  const shortDraw = rng.next();
  const shortIdx =
    fitting.length > 0 ? (fitting[Math.floor(shortDraw * fitting.length)] ?? -1) : -1;
  const short = lists.short[shortIdx] ?? given;
  const shortFirst = shortIdx >= 0 ? nGiven + nCompound + shortIdx : firstIdx;
  const nickIdx = index(lists.nicknames.length);
  const nickname = lists.nicknames[nickIdx];
  const originIdx = index(lists.origins.length);
  const origin = lists.origins[originIdx];
  const useShort = rng.next() >= ORIGIN_WITH_FIRST_SHARE; // origin form: first name or short
  const roll = rng.next();

  const form = DISPLAY_FORMS[FORM_LIMITS.findIndex((limit) => roll < limit)] ?? 'given-family';
  const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' ');
  const noSolo = new Set((lists.familyNoSolo ?? []).map(normalizeNameKey));
  const soloOk =
    letterCount(family) >= MIN_SURNAME_ONLY_LETTERS &&
    !noSolo.has(normalizeNameKey(family)) &&
    !ex?.family.has(i1);

  // Default display: "First Surname" (also the fallback when a form cannot be shown).
  let display = join(given, family);
  let defaultDisplay = true;
  let excluded = hasSecond
    ? (ex?.triples.has(`${firstIdx},${i1},${familyIdx2}`) ?? false)
    : (ex?.firstFamily.has(`${firstIdx},${i1}`) ?? false);
  if (form === 'family' && soloOk) {
    display = family;
    defaultDisplay = false;
  } else if (form === 'short-family') {
    display = join(short, family);
    defaultDisplay = false;
    excluded ||= ex?.firstFamily.has(`${shortFirst},${i1}`) ?? false;
  } else if (form === 'nickname' && nickname !== undefined) {
    display = nickname;
    defaultDisplay = false;
    excluded ||= ex?.nickname.has(nickIdx) ?? false;
  } else if (form === 'name-origin' && origin !== undefined) {
    display = join(useShort ? short : given, 'de', origin);
    defaultDisplay = false;
    const first = useShort ? shortFirst : firstIdx;
    excluded ||= ex?.firstOrigin.has(`${first},${originIdx}`) ?? false;
  } else if (form === 'given-nickname' && nickname !== undefined) {
    display = join(given, nickname);
    defaultDisplay = false;
    excluded ||= ex?.firstNickname.has(`${firstIdx},${nickIdx}`) ?? false;
  } else if (form === 'short-nickname' && nickname !== undefined) {
    display = join(short, nickname);
    defaultDisplay = false;
    excluded ||= ex?.firstNickname.has(`${shortFirst},${nickIdx}`) ?? false;
  }
  if (defaultDisplay) excluded ||= ex?.firstFamily.has(`${firstIdx},${i1}`) ?? false;
  return {
    name: { nameSeed: nameSeed >>> 0, display, full: join(given, family, family2), family },
    excluded,
  };
}

/**
 * The name for a seed. Pure. When the drawn combination is in `exclusions`, it is replaced by the
 * next draw of a generator seeded with `nameSeed` itself (deterministic; at most 50 times), and the
 * result still carries the original `nameSeed`, so storing it reproduces the name.
 */
export function nameFromSeed(
  nameSeed: number,
  lists: NameLists,
  exclusions?: NameExclusions,
): PlayerName {
  let current = draw(nameSeed, lists, exclusions);
  const reseed = new Rng(nameSeed ^ 0x9e3779b9);
  for (let i = 0; i < MAX_RESEEDS && current.excluded; i++) {
    current = draw(reseed.int(0, 0xffffffff), lists, exclusions);
  }
  // Still excluded after 50 reseeds (absurd exclusions): keep the last draw and say so.
  const degraded = current.excluded ? ({ degraded: true } as const) : {};
  return { ...current.name, nameSeed: nameSeed >>> 0, ...degraded };
}

/**
 * Names for a whole squad. Rules, all deterministic: no two with the same display name (accents,
 * case and hyphens ignored); a bare surname display ("Tavares") does not share the squad with
 * another player of that surname, and vice versa; at most 3 players per first surname; and no
 * excluded (real-athlete) combination. Candidate seeds come from `seed` in order, so a rejected
 * name is skipped the same way every time, and each result carries the seed that reproduces it
 * alone through `nameFromSeed`. Never throws: with degenerate lists it gives up after 200 tries,
 * numbers the display ("Nome 2") and marks the name `degraded`; only happens in tests.
 */
export function namesForSquad(
  seed: number,
  count: number,
  lists: NameLists,
  exclusions?: NameExclusions,
): PlayerName[] {
  const rng = new Rng(seed);
  const displays = new Set<string>();
  const perFamily = new Map<string, { count: number; bare: boolean }>();
  const result: PlayerName[] = [];
  for (let i = 0; i < count; i++) {
    let chosen: PlayerName | undefined;
    let last: PlayerName | undefined;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && chosen === undefined; attempt++) {
      const candidate = nameFromSeed(rng.int(0, 0xffffffff), lists, exclusions);
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
      if (!clash) chosen = candidate;
    }
    if (chosen === undefined) {
      let n = 2;
      const base = last ?? nameFromSeed(0, lists, exclusions);
      while (displays.has(normalizeNameKey(`${base.display} ${n}`))) n++;
      chosen = { ...base, display: `${base.display} ${n}`, degraded: true };
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

export type NameListProblem =
  | 'empty-list'
  | 'blank-entry'
  | 'duplicate-entry'
  | 'has-hyphen'
  | 'not-in-family'
  | 'not-in-short'
  | 'unmapped-short';
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
 * (the blocklist hash does not turn hyphens into spaces, so a hyphenated entry could slip past),
 * and every `familyNoSolo` entry is also a surname.
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
  const families = new Set(lists.family.map(normalizeNameKey));
  for (const value of lists.familyNoSolo ?? []) {
    if (!families.has(normalizeNameKey(value))) {
      issues.push({ list: 'familyNoSolo', problem: 'not-in-family', value });
    }
  }
  if (lists.shortOf !== undefined || lists.shortGeneric !== undefined) {
    const shorts = new Set(lists.short.map(normalizeNameKey));
    const declared = [...Object.keys(lists.shortOf ?? {}), ...(lists.shortGeneric ?? [])];
    for (const value of declared) {
      if (!shorts.has(normalizeNameKey(value))) {
        issues.push({ list: 'short', problem: 'not-in-short', value });
      }
    }
    const mapped = new Set(declared.map(normalizeNameKey));
    for (const value of lists.short) {
      if (!mapped.has(normalizeNameKey(value))) {
        issues.push({ list: 'short', problem: 'unmapped-short', value });
      }
    }
  }
  return issues;
}
