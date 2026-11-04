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
  /** First names, e.g. "Nometeste". */
  given: readonly string[];
  /** Surnames. */
  family: readonly string[];
  /** Nicknames ("apelidos de boleiro"), used alone as the display name. */
  nicknames: readonly string[];
}

export interface PlayerName {
  /** Seed that reproduces exactly this name through `nameFromSeed`; store it in `Player.nameSeed`. */
  nameSeed: number;
  /** Name shown in the UI: a nickname, a surname or "First Surname". */
  display: string;
  /** Always "First Surname". */
  full: string;
}

/** True when the name matches a real athlete. Receives the display and the full name separately. */
export type IsBlocked = (name: string) => boolean;

/** Share of players shown by nickname, then by surname; the rest is shown as "First Surname". */
const NICKNAME_SHARE = 0.3;
const SURNAME_SHARE = 0.75;
const MAX_ATTEMPTS = 100;

/**
 * Same rule as `normalizeName` in data/blocklist.ts (kept in sync by a test), repeated here because
 * that file imports node:crypto and cannot go to the browser.
 */
export function normalizeNameKey(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** The name for a seed. Pure; does not look at any blocklist. Always consumes the same draws. */
export function nameFromSeed(nameSeed: number, lists: NameLists): PlayerName {
  const rng = new Rng(nameSeed);
  const given = rng.pick(lists.given) ?? '';
  const family = rng.pick(lists.family) ?? '';
  const nickname = rng.pick(lists.nicknames);
  const roll = rng.next();
  const full = `${given} ${family}`.trim();
  let display = full;
  if (roll < NICKNAME_SHARE && nickname !== undefined) display = nickname;
  else if (roll < SURNAME_SHARE && family !== '') display = family;
  return { nameSeed: nameSeed >>> 0, display, full };
}

/**
 * Names for a whole squad, no two with the same display name (accents and case ignored) and none
 * blocked (display or full name). Candidate seeds come from `seed` in order, so a blocked or
 * repeated name is skipped deterministically; each result carries the seed that reproduces it
 * alone through `nameFromSeed`. Never throws: with degenerate lists (fewer names than players) it
 * gives up after 100 tries and numbers the display ("Nome 2"), which only happens in tests.
 */
export function namesForSquad(
  seed: number,
  count: number,
  lists: NameLists,
  isBlocked?: IsBlocked,
): PlayerName[] {
  const rng = new Rng(seed);
  const taken = new Set<string>();
  const result: PlayerName[] = [];
  for (let i = 0; i < count; i++) {
    let chosen: PlayerName | undefined;
    let last: PlayerName | undefined;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && chosen === undefined; attempt++) {
      const candidate = nameFromSeed(rng.int(0, 0xffffffff), lists);
      last = candidate;
      const clash = taken.has(normalizeNameKey(candidate.display));
      const blocked = isBlocked?.(candidate.display) || isBlocked?.(candidate.full);
      if (!clash && !blocked) chosen = candidate;
    }
    if (chosen === undefined) {
      let n = 2;
      const base = last ?? nameFromSeed(0, lists);
      while (taken.has(normalizeNameKey(`${base.display} ${n}`))) n++;
      chosen = { ...base, display: `${base.display} ${n}` };
    }
    taken.add(normalizeNameKey(chosen.display));
    result.push(chosen);
  }
  return result;
}

/**
 * Every string the lists can ever show as a display or full name: nicknames, surnames and
 * "First Surname". Its size is |nicknames| + |family| + |given|*|family|, small enough to hash
 * in CI (a few hundred thousand at most).
 */
export function* allPossibleNames(lists: NameLists): Generator<string> {
  yield* lists.nicknames;
  yield* lists.family;
  for (const g of lists.given) for (const f of lists.family) yield `${g} ${f}`.trim();
}

/** Names the lists can produce that the predicate blocks. Empty means the lists are clean. */
export function findBlockedNames(lists: NameLists, isBlocked: IsBlocked): string[] {
  const found = new Set<string>();
  for (const name of allPossibleNames(lists)) if (isBlocked(name)) found.add(name);
  return [...found];
}

export type NameListProblem = 'empty-list' | 'blank-entry' | 'duplicate-entry';
export interface NameListIssue {
  list: keyof NameLists;
  problem: NameListProblem;
  value?: string;
}

/** Structural check of the lists (not empty, no blanks, no repeats after normalization). */
export function checkNameLists(lists: NameLists): NameListIssue[] {
  const issues: NameListIssue[] = [];
  for (const list of ['given', 'family', 'nicknames'] as const) {
    if (lists[list].length === 0) issues.push({ list, problem: 'empty-list' });
    const seen = new Set<string>();
    for (const value of lists[list]) {
      const key = normalizeNameKey(value);
      if (key === '') issues.push({ list, problem: 'blank-entry' });
      else if (seen.has(key)) issues.push({ list, problem: 'duplicate-entry', value });
      seen.add(key);
    }
  }
  return issues;
}
