import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildBlocklist, hashName, normalizeName, parseBlocklist } from '../../data/blocklist.ts';
import {
  checkNameLists,
  findBlockedNames,
  nameFromSeed,
  namesForSquad,
  normalizeNameKey,
  type IsBlocked,
  type NameLists,
} from './names';

/* Synthetic lists: invented names only, never a real athlete (not even as a test fixture). */
const lists: NameLists = {
  given: Array.from({ length: 40 }, (_, i) => `Nometeste${i + 1}`),
  family: Array.from({ length: 50 }, (_, i) => `Sobrenometeste${i + 1}`),
  nicknames: Array.from({ length: 30 }, (_, i) => `Apelidoteste${i + 1}`),
};

/* Blocked names that the lists CAN produce, so the skipping is really exercised. */
const blocklist = buildBlocklist([
  'Nometeste1 Sobrenometeste1',
  'Nometeste2 Sobrenometeste2',
  'Sobrenometeste3',
  'Apelidoteste4',
  ...Array.from({ length: 10 }, (_, i) => `Nometeste${i + 3} Sobrenometeste${i + 3}`),
]);
const blockedHashes = new Set(blocklist.hashes);
const isBlocked: IsBlocked = (name) => blockedHashes.has(hashName(name));

describe('name generator (US-003)', () => {
  it('is deterministic: 500 names twice are identical', () => {
    const run = () => namesForSquad(2026, 500, lists, isBlocked);
    expect(run()).toEqual(run());
    expect(run()).toHaveLength(500);
  });

  it('reproduces any squad name alone from its nameSeed', () => {
    for (const n of namesForSquad(7, 50, lists, isBlocked)) {
      expect(nameFromSeed(n.nameSeed, lists)).toEqual(n);
    }
  });

  it('varies with the seed', () => {
    expect(namesForSquad(1, 20, lists)).not.toEqual(namesForSquad(2, 20, lists));
  });

  it('never produces a blocked display or full name in 10,000 names', () => {
    let total = 0;
    for (let seed = 1; seed <= 500; seed++) {
      for (const n of namesForSquad(seed * 7919, 20, lists, isBlocked)) {
        total++;
        expect(blockedHashes.has(hashName(n.display))).toBe(false);
        expect(blockedHashes.has(hashName(n.full))).toBe(false);
      }
    }
    expect(total).toBe(10_000);
  });

  it('really skips blocked candidates (the unfiltered run would hit them)', () => {
    let hits = 0;
    for (let seed = 1; seed <= 500; seed++) {
      for (const n of namesForSquad(seed * 7919, 20, lists)) {
        if (isBlocked(n.display) || isBlocked(n.full)) hits++;
      }
    }
    expect(hits).toBeGreaterThan(0);
  });

  it('has no duplicate display name inside a squad, accents and case ignored', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const names = namesForSquad(seed, 28, lists, isBlocked).map((n) =>
        normalizeNameKey(n.display),
      );
      expect(new Set(names).size).toBe(28);
    }
    const accented: NameLists = { given: ['Jose'], family: ['Álvaro', 'alvaro'], nicknames: ['x'] };
    const squad = namesForSquad(3, 6, accented).map((n) => normalizeNameKey(n.display));
    expect(new Set(squad).size).toBe(6);
  });

  it('never throws with degenerate lists', () => {
    const tiny: NameLists = { given: ['A'], family: ['B'], nicknames: [] };
    const squad = namesForSquad(1, 5, tiny);
    expect(new Set(squad.map((n) => n.display)).size).toBe(5);
    expect(namesForSquad(1, 3, { given: [], family: [], nicknames: [] })).toHaveLength(3);
  });

  it('uses the three display styles', () => {
    const names = namesForSquad(9, 300, lists);
    expect(names.some((n) => n.display.startsWith('Apelidoteste'))).toBe(true);
    expect(names.some((n) => n.display.startsWith('Sobrenometeste'))).toBe(true);
    expect(names.some((n) => n.display === n.full)).toBe(true);
  });
});

describe('list checks', () => {
  it('finds blocked names anywhere in the space the lists can produce', () => {
    const found = findBlockedNames(lists, isBlocked);
    expect(found).toContain('Sobrenometeste3');
    expect(found).toContain('Apelidoteste4');
    expect(found).toContain('Nometeste1 Sobrenometeste1');
    expect(findBlockedNames(lists, () => false)).toEqual([]);
  });

  it('flags empty lists, blanks and repeats', () => {
    expect(checkNameLists(lists)).toEqual([]);
    expect(
      checkNameLists({ given: [], family: ['A', 'á', ' '], nicknames: ['X'] }).map(
        (i) => i.problem,
      ),
    ).toEqual(['empty-list', 'duplicate-entry', 'blank-entry']);
  });

  it('normalizes exactly like the blocklist', () => {
    for (const s of ['  São   PAULO ', 'Ágata Çelik', 'ÀÉÎ õü', 'plain']) {
      expect(normalizeNameKey(s)).toBe(normalizeName(s));
    }
  });
});

/*
 * Real lists (content-writer batch, approved by the CEO) against the real hashed list of athletes.
 * Skipped while either file is missing. This is the CI guarantee that lets the browser skip the
 * check: no name the lists can produce is on the blocklist.
 */
const listsPath = new URL('../../content/names/br.json', import.meta.url);
const athletesPath = new URL('../../data/athletes-blocklist.sha256.json', import.meta.url);

describe.skipIf(!existsSync(listsPath) || !existsSync(athletesPath))('real name lists', () => {
  const real = () => JSON.parse(readFileSync(listsPath, 'utf8')) as NameLists;

  it('are well formed', () => {
    expect(checkNameLists(real())).toEqual([]);
  });

  it('cannot produce any real athlete name', () => {
    const parsed = parseBlocklist(JSON.parse(readFileSync(athletesPath, 'utf8')));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    const blocked = findBlockedNames(real(), (name) => parsed.hashes.has(hashName(name)));
    // Report positions, not the names: they are real people.
    expect(blocked.length).toBe(0);
  });
});
