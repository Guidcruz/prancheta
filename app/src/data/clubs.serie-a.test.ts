import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  STRENGTH_RANGE_BY_SIZE,
  type AiProfile,
  type ClubDef,
  type ClubSize,
} from '../engine/index.ts';
import { parseBlocklist } from './blocklist.ts';
import { checkClubData, formatClubIssues } from './check.ts';

/*
 * The real files of app/src/data/ (US-001), approved by the CEO on 2026-11-04. The suites are
 * guarded by the existence of the files, so they switched on by themselves when the data
 * arrived; the club list requires the blocklist next to it. The expected values are read from
 * the design table and the approved batch, so a drift in either side fails here.
 */
const clubsUrl = new URL('./clubs.serie-a.json', import.meta.url);
const blocklistUrl = new URL('./blocklist.sha256.json', import.meta.url);
const hasClubs = existsSync(clubsUrl);
const readJson = (url: URL): unknown => JSON.parse(readFileSync(url, 'utf8'));

describe.skipIf(!existsSync(blocklistUrl))('app/src/data/blocklist.sha256.json', () => {
  it('is a valid blocklist', () => {
    expect(parseBlocklist(readJson(blocklistUrl))).toMatchObject({ ok: true });
  });
});

describe.skipIf(!hasClubs)('app/src/data/clubs.serie-a.json', () => {
  it('ships with the blocklist', () => {
    expect(existsSync(blocklistUrl)).toBe(true);
  });

  it('passes the full check: 20 clubs, fields, derbies, shields, no real name', () => {
    const result = checkClubData(readJson(clubsUrl), readJson(blocklistUrl));
    if (!result.ok) throw new Error(formatClubIssues(result.issues));
    expect(result.clubs).toHaveLength(20);
  });

  // docs/design/clubes-serie-a.md, "Distribuição de perfis" and the approved list (6/8/6).
  it('has the sizes and the AI profile split of the design document', () => {
    const clubs = readJson(clubsUrl) as { size: ClubSize; aiProfile?: AiProfile }[];
    const count = (size: ClubSize) => {
      const of = clubs.filter((c) => c.size === size);
      const by = (p: AiProfile) => of.filter((c) => c.aiProfile === p).length;
      return [
        of.length,
        by('ambitious'),
        by('traditional'),
        by('academy'),
        by('seller'),
        by('chaotic'),
      ];
    };
    expect(count('big')).toEqual([6, 4, 2, 0, 0, 0]);
    expect(count('medium')).toEqual([8, 0, 3, 3, 2, 0]);
    expect(count('small')).toEqual([6, 0, 1, 2, 2, 1]);
  });

  const clubs = () => readJson(clubsUrl) as ClubDef[];
  const doc = (path: string) =>
    readFileSync(new URL(`../../../docs/${path}`, import.meta.url), 'utf8');
  /** A club by the name the documents use: the short name or the start of the full name. */
  const byName = (label: string): ClubDef => {
    const club = clubs().find((c) => c.shortName === label || c.name.startsWith(`${label} `));
    if (!club) throw new Error(`no club named "${label}"`);
    return club;
  };
  const tableRows = (text: string, first: RegExp) =>
    text
      .split('\n')
      .map((line) => line.split('|').map((cell) => cell.trim()))
      .filter((cells) => first.test(cells[1] ?? ''));

  it('keeps every strength inside the range of its size', () => {
    for (const club of clubs()) {
      const range = STRENGTH_RANGE_BY_SIZE[club.size];
      expect(club.strength, club.id).toBeGreaterThanOrEqual(range.min);
      expect(club.strength, club.id).toBeLessThanOrEqual(range.max);
    }
  });

  it('gives Flamingo and Fluminário the same stadium and capacity', () => {
    const [a, b] = [byName('Flamingo'), byName('Fluminário')];
    expect(a.stadium).toEqual(b.stadium);
    expect(clubs().filter((c) => c.stadium.name === a.stadium.name)).toHaveLength(2);
  });

  it('has titles as integers of at least 0 for every club', () => {
    for (const { id, titles } of clubs()) {
      expect(Number.isInteger(titles.league) && titles.league >= 0, id).toBe(true);
      expect(Number.isInteger(titles.cup) && titles.cup >= 0, id).toBe(true);
    }
  });

  // docs/design/clubes-serie-a.md, "Tabela": size, strength, profile, capacity and titles.
  const sizes: Record<string, ClubSize> = { grande: 'big', médio: 'medium', pequeno: 'small' };
  const designRows = tableRows(doc('design/clubes-serie-a.md'), /^\d+$/).filter(
    (cells) => cells.length >= 10,
  );
  it('reads the 20 rows of the design table', () => {
    expect(designRows).toHaveLength(20);
  });
  it.each(designRows.map((cells) => [cells[2]!, cells]))(
    '%s matches the design table',
    (_, cells) => {
      const club = byName(cells[2]!);
      const n = (cell: string) => Number(cell.replace(/\./g, ''));
      expect({
        size: club.size,
        strength: club.strength,
        aiProfile: club.aiProfile,
        capacity: club.stadium.capacity,
        titles: club.titles,
      }).toEqual({
        size: sizes[cells[3]!],
        strength: n(cells[4]!),
        aiProfile: cells[5]!.replace(/`/g, ''),
        capacity: n(cells[6]!),
        titles: { league: n(cells[7]!), cup: n(cells[8]!) },
      });
    },
  );

  // docs/content/lotes/2026-11-04-nomes-serie-a.md, "Clássicos": every pair, both ways, no more.
  it('has exactly the derbies of the approved batch, both ways', () => {
    const pairs = tableRows(doc('content/lotes/2026-11-04-nomes-serie-a.md'), / x /).map((cells) =>
      cells[1]!
        .split(' x ')
        .map((label) => byName(label).id)
        .sort()
        .join('|'),
    );
    expect(pairs).toHaveLength(17);
    const fromData = new Set<string>();
    for (const club of clubs()) {
      for (const rival of club.rivals) fromData.add([club.id, rival].sort().join('|'));
    }
    expect([...fromData].sort()).toEqual([...new Set(pairs)].sort());
    const loners = clubs()
      .filter((c) => c.rivals.length === 0)
      .map((c) => c.shortName);
    expect(loners.sort()).toEqual(['Bragantão', 'Chapecão', 'Miragol', 'Remador']);
  });
});
