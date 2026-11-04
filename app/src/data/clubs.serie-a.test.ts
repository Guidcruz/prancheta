import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AiProfile, ClubSize } from '../engine/index.ts';
import { parseBlocklist } from './blocklist.ts';
import { checkClubData, formatClubIssues } from './check.ts';

/*
 * The real files of app/src/data/ (US-001). The club list and the blocklist are still being
 * prepared (stadium names by the content-writer, then approval by the CEO), so this suite runs
 * as soon as clubs.serie-a.json exists, with no edit needed to switch it on. Until then Vitest
 * reports it as skipped. Once the list is in, the blocklist becomes mandatory: a club list
 * without it fails.
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
});
