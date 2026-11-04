import { createHash } from 'node:crypto';
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
  givenCompound: ['Nomeum Nomedois', 'Nomeum Nometres'],
  family: Array.from({ length: 50 }, (_, i) => `Sobrenometeste${i + 1}`),
  short: Array.from({ length: 20 }, (_, i) => `Curtoteste${i + 1}`),
  nicknames: Array.from({ length: 30 }, (_, i) => `Apelidoteste${i + 1}`),
  origins: Array.from({ length: 10 }, (_, i) => `Vale Origemteste${i + 1}`),
};

/* Blocked names that the lists CAN produce, so the skipping is really exercised. */
const blocklist = buildBlocklist([
  'Nometeste1 Sobrenometeste1',
  'Nometeste2 Sobrenometeste2',
  'Sobrenometeste3',
  'Apelidoteste4',
  'Curtoteste1 Apelidoteste1',
  'Nometeste5 Sobrenometeste5 Sobrenometeste6',
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
    const accented: NameLists = {
      ...lists,
      given: ['Jose'],
      family: ['Álvaro', 'alvaro', 'Beta', 'Gama'],
    };
    const squad = namesForSquad(3, 6, accented).map((n) => normalizeNameKey(n.display));
    expect(new Set(squad).size).toBe(6);
  });

  it('never throws with degenerate lists', () => {
    const tiny: NameLists = { ...lists, given: ['A'], family: ['B'], nicknames: [] };
    const squad = namesForSquad(1, 5, tiny);
    expect(new Set(squad.map((n) => n.display)).size).toBe(5);
    const empty: NameLists = {
      given: [],
      givenCompound: [],
      family: [],
      short: [],
      nicknames: [],
      origins: [],
    };
    expect(namesForSquad(1, 3, empty)).toHaveLength(3);
  });

  it('uses all seven display forms, with the weights of the batch', () => {
    const counts = new Map<string, number>();
    const n = 20_000;
    for (let i = 0; i < n; i++) {
      const { display } = nameFromSeed(i * 2654435761, lists);
      const form = display.startsWith('Apelidoteste')
        ? 'nickname'
        : /^Sobrenometeste\d+$/.test(display)
          ? 'family'
          : /^Curtoteste\d+ Sobrenometeste/.test(display)
            ? 'short-family'
            : /^Curtoteste\d+ Apelido/.test(display)
              ? 'short-nickname'
              : /Origemteste/.test(display)
                ? 'origin'
                : /^Nome\w+( Nome\w+)? Apelido/.test(display)
                  ? 'given-nickname'
                  : 'given-family';
      counts.set(form, (counts.get(form) ?? 0) + 1);
    }
    const share = (f: string) => (counts.get(f) ?? 0) / n;
    expect(share('given-family')).toBeCloseTo(0.3, 1);
    expect(share('family')).toBeCloseTo(0.25, 1);
    expect(share('short-family')).toBeCloseTo(0.15, 1);
    expect(share('nickname')).toBeCloseTo(0.1, 1);
    expect(share('origin')).toBeCloseTo(0.08, 1);
    expect(share('given-nickname')).toBeCloseTo(0.07, 1);
    expect(share('short-nickname')).toBeCloseTo(0.05, 1);
  });

  it('never shows a first name or short form alone, and the second surname only in the full name', () => {
    const firsts = new Set([...lists.given, ...lists.givenCompound, ...lists.short]);
    let withSecond = 0;
    const n = 5000;
    for (let i = 0; i < n; i++) {
      const { display, full, family } = nameFromSeed(i + 11, lists);
      expect(firsts.has(display)).toBe(false);
      expect(display.split(' ').filter((w) => w.startsWith('Sobrenometeste')).length).toBeLessThan(
        2,
      );
      if (full.split(' ').filter((w) => w.startsWith('Sobrenometeste')).length === 2) withSecond++;
      expect(full).toContain(family);
    }
    expect(withSecond / n).toBeCloseTo(0.35, 1);
  });

  it('shows a bare surname only when it has 4 letters or more', () => {
    const shortSurnames: NameLists = { ...lists, family: ['Li', 'Xu', 'Abc'] };
    for (let i = 0; i < 2000; i++) {
      const { display, family } = nameFromSeed(i, shortSurnames);
      expect(display).not.toBe(family);
    }
  });

  it('keeps at most 3 per surname and never pairs a bare surname with its namesake', () => {
    const few: NameLists = {
      ...lists,
      family: ['Tavares', 'Barbosa', 'Cardoso', 'Pereira', 'Moreira'],
    };
    for (let seed = 1; seed <= 200; seed++) {
      const squad = namesForSquad(seed, 5, few);
      const byFamily = new Map<string, typeof squad>();
      for (const n of squad) byFamily.set(n.family, [...(byFamily.get(n.family) ?? []), n]);
      for (const group of byFamily.values()) {
        expect(group.length).toBeLessThanOrEqual(3);
        if (group.some((n) => n.display === n.family)) expect(group).toHaveLength(1);
      }
    }
  });
});

describe('list checks', () => {
  it('finds blocked names anywhere in the space the lists can produce', () => {
    const found = findBlockedNames(lists, isBlocked).map((b) => b.name);
    expect(found).toContain('Sobrenometeste3');
    expect(found).toContain('Apelidoteste4');
    expect(found).toContain('Nometeste1 Sobrenometeste1');
    expect(found).toContain('Curtoteste1 Apelidoteste1');
    expect(found).toContain('Nometeste5 Sobrenometeste5 Sobrenometeste6');
    const noSecond = findBlockedNames(lists, isBlocked, { withSecondFamily: false });
    expect(noSecond.map((b) => b.name)).not.toContain('Nometeste5 Sobrenometeste5 Sobrenometeste6');
    expect(findBlockedNames(lists, () => false)).toEqual([]);
    expect(findBlockedNames(lists, isBlocked).find((b) => b.name === 'Apelidoteste4')?.kind).toBe(
      'nickname',
    );
  });

  it('flags empty lists, blanks, repeats and hyphens', () => {
    expect(checkNameLists(lists)).toEqual([]);
    const bad = { ...lists, given: [], family: ['A', 'á', ' ', 'B-C'] };
    expect(checkNameLists(bad).map((i) => i.problem)).toEqual([
      'empty-list',
      'duplicate-entry',
      'blank-entry',
      'has-hyphen',
    ]);
  });

  it('normalizes like the blocklist (plus hyphen)', () => {
    for (const s of ['  São   PAULO ', 'Ágata Çelik', 'ÀÉÎ õü', 'plain']) {
      expect(normalizeNameKey(s)).toBe(normalizeName(s));
    }
    // The only difference: hyphens count as spaces when comparing names inside a squad.
    expect(normalizeNameKey('Jean-Pierre')).toBe('jean pierre');
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

  /* Counts by kind, never the names: they are real people. */
  function collisionsByKind(withSecondFamily: boolean, hashes: ReadonlySet<string>) {
    const lists = real();
    // Normalize each entry once; the join of normalized pieces equals the normalized join.
    const norm = (items: readonly string[]) => items.map(normalizeName);
    const normalized: NameLists = {
      given: norm(lists.given),
      givenCompound: norm(lists.givenCompound),
      family: norm(lists.family),
      short: norm(lists.short),
      nicknames: norm(lists.nicknames),
      origins: norm(lists.origins),
    };
    const isReal: IsBlocked = (name) =>
      hashes.has(createHash('sha256').update(name, 'utf8').digest('hex'));
    const byKind: Record<string, number> = {};
    for (const { kind } of findBlockedNames(normalized, isReal, { withSecondFamily })) {
      byKind[kind] = (byKind[kind] ?? 0) + 1;
    }
    return byKind;
  }
  const athleteHashes = () => {
    const parsed = parseBlocklist(JSON.parse(readFileSync(athletesPath, 'utf8')));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    return parsed.hashes;
  };

  it('cannot produce a real athlete name as display or as "First Surname" (~270k names)', () => {
    expect(collisionsByKind(false, athleteHashes())).toEqual({});
  });

  /*
   * "First Surname Surname2" is ~74M strings (about 1 to 4 minutes of SHA-256), too slow for every
   * run: opt in with NAMES_FULL_CHECK=1 (release gate / scheduled job).
   */
  it.skipIf(process.env.NAMES_FULL_CHECK !== '1')(
    'cannot produce a real athlete name with a second surname (~74M names)',
    () => {
      expect(collisionsByKind(true, athleteHashes())).toEqual({});
    },
    1_800_000,
  );
});
