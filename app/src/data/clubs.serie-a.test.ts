import { readFileSync } from 'node:fs';
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
 * The real files of app/src/data/ (US-001), approved by the CEO on 2026-11-04. Both files are
 * mandatory: deleting either one fails `npm test` and `npm run content:check`. The expected values are read from
 * the design table and the approved batch, so a drift in either side fails here.
 */
const clubsUrl = new URL('./clubs.serie-a.json', import.meta.url);
const blocklistUrl = new URL('./blocklist.sha256.json', import.meta.url);
const readJson = (url: URL): unknown => JSON.parse(readFileSync(url, 'utf8'));

describe('app/src/data/blocklist.sha256.json', () => {
  it('is a valid blocklist', () => {
    expect(parseBlocklist(readJson(blocklistUrl))).toMatchObject({ ok: true });
  });
});

describe('app/src/data/clubs.serie-a.json', () => {
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
      expect(Object.keys(titles).sort(), id).toEqual([
        'cup',
        'league',
        'libertadores',
        'sudamericana',
      ]);
      for (const count of Object.values(titles)) {
        expect(Number.isInteger(count) && count >= 0, id).toBe(true);
      }
    }
  });

  /** Rows of the markdown table whose header has `column`, keyed by the header cells. */
  const table = (text: string, column: string): Record<string, string>[] => {
    const lines = text.split('\n').map((line) => line.split('|').map((cell) => cell.trim()));
    const start = lines.findIndex((cells) => cells.includes(column));
    if (start < 0) throw new Error(`no table with a "${column}" column`);
    const header = lines[start]!;
    const rows: Record<string, string>[] = [];
    for (const cells of lines.slice(start + 2)) {
      if (cells.length !== header.length) break;
      rows.push(Object.fromEntries(header.map((name, i) => [name.replace(/`/g, ''), cells[i]!])));
    }
    return rows;
  };
  const n = (cell: string) => Number(cell.replace(/\./g, ''));

  // docs/design/clubes-serie-a.md, "Tabela": size, strength, profile, capacity and titles.
  const sizes: Record<string, ClubSize> = { grande: 'big', médio: 'medium', pequeno: 'small' };
  const designRows = table(doc('design/clubes-serie-a.md'), 'Ref. 2026');
  it('reads the 20 rows of the design table', () => {
    expect(designRows).toHaveLength(20);
  });
  it.each(designRows.map((row) => [row.Clube!, row]))('%s matches the design table', (_, row) => {
    const club = byName(row.Clube!);
    expect({
      size: club.size,
      strength: club.strength,
      aiProfile: club.aiProfile,
      capacity: club.stadium.capacity,
      titles: club.titles,
    }).toEqual({
      size: sizes[row.Porte!],
      strength: n(row.strength!),
      aiProfile: row.aiProfile!.replace(/`/g, ''),
      capacity: n(row['stadium.capacity']!),
      titles: {
        league: n(row.Brasileiro!),
        cup: n(row['Copa do Brasil']!),
        libertadores: n(row.Libertadores!),
        sudamericana: n(row['Sul-Americana']!),
      },
    });
  });

  // docs/content/lotes/2026-11-04-nomes-serie-a.md, "Os 20 clubes": names, colours, nickname.
  const batchRows = table(doc('content/lotes/2026-11-04-nomes-serie-a.md'), 'Apelido da torcida');
  it('reads the 20 rows of the names batch', () => {
    expect(batchRows).toHaveLength(20);
  });
  it.each(batchRows.map((row) => [row['Nome curto']!, row]))(
    '%s matches the names batch',
    (_, row) => {
      const club = byName(row['Nome curto']!);
      const [city, state] = row['Cidade / UF']!.split(', ');
      const colors = [
        ...row['Cores (principal, secundária)']!.matchAll(/`(#[0-9A-Fa-f]{6})`/g),
      ].map((m) => m[1]);
      expect({
        name: club.name,
        shortName: club.shortName,
        abbreviation: club.abbreviation,
        city: club.city,
        state: club.state,
        colors: club.colors,
        nickname: club.nickname,
        size: club.size,
      }).toEqual({
        name: row['Nome completo'],
        shortName: row['Nome curto'],
        abbreviation: row.Sigla,
        city,
        state,
        colors,
        nickname: row['Apelido da torcida'],
        size: sizes[row.Porte!],
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
