import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ClubDef } from '../engine/index.ts';
import { checkClubData, formatClubIssues } from './check.ts';
import { CLUB_SETS, latestClubSet, type ClubSet } from './club-sets.ts';

/*
 * The sets of club data by base season (US-066, first scenario): each one passes every check of
 * US-001, and no two share a base season. Runs in `npm test` and in `npm run content:check`.
 */

const blocklist: unknown = JSON.parse(
  readFileSync(new URL('./blocklist.sha256.json', import.meta.url), 'utf8'),
);

describe('the sets of club data (US-066)', () => {
  it('has at least one set, and the newest is 2026 for now (D4)', () => {
    expect(CLUB_SETS.length).toBeGreaterThanOrEqual(1);
    expect(latestClubSet()?.baseSeason).toBe(2026);
  });

  it.each(CLUB_SETS.map((set) => [set.baseSeason, set] as const))(
    'the set of base season %i passes every check of US-001',
    (_season, set) => {
      const result = checkClubData(set.clubs, blocklist);
      if (!result.ok) throw new Error(formatClubIssues(result.issues));
      expect(result.clubs).toHaveLength(20);
    },
  );

  it('has no two sets with the same base season, each a whole year', () => {
    const seasons = CLUB_SETS.map((set) => set.baseSeason);
    expect(new Set(seasons).size).toBe(seasons.length);
    for (const season of seasons) expect(Number.isInteger(season) && season >= 2026).toBe(true);
  });

  it('the base season of the 2026 set is the file approved by the CEO', () => {
    const file: unknown = JSON.parse(
      readFileSync(new URL('./clubs.serie-a.json', import.meta.url), 'utf8'),
    );
    expect(CLUB_SETS.find((set) => set.baseSeason === 2026)?.clubs).toEqual(file);
  });

  it('chooses the newest by base season, whatever the order, and nothing from an empty list', () => {
    const clubs: readonly ClubDef[] = [];
    const sets: ClubSet[] = [2027, 2029, 2028].map((baseSeason) => ({ baseSeason, clubs }));
    expect(latestClubSet(sets)?.baseSeason).toBe(2029);
    expect(latestClubSet([])).toBeUndefined();
  });
});
