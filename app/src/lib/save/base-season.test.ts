import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLUB_SETS, type ClubSet } from '../../data/club-sets.ts';
import type { ClubDef } from '../../engine/index.ts';
import { gameIdentitySource } from '../generators/identity.ts';
import { loadGameParams } from '../params.ts';
import { newCareerGame } from './new-career.ts';
import type { CareerSave } from './schema.ts';
import { store, useFreshDatabase } from './testing/idb.ts';

/*
 * US-066 (docs/02-architecture.md, 4.2, "Dados de referência dos clubes no save"; T-019): a new
 * career takes the newest set of club data and plays season 1 in its year (D4), and a career that
 * exists keeps the clubs it was created with (`ClubState.def` frozen in the save, ADR-0006), even
 * in a build that brings a newer set. The checks of each set (US-001) are in
 * app/src/data/club-sets.test.ts.
 */

useFreshDatabase();

const params = loadGameParams();
const identities = gameIdentitySource();
const set2026 = CLUB_SETS.find((set) => set.baseSeason === 2026)!;

/** A 2027 set as the yearly batch would bring it (US-067): other capacities, titles, strengths. */
const set2027: ClubSet = {
  baseSeason: 2027,
  clubs: set2026.clubs.map((club, i): ClubDef => ({
    ...club,
    stadium: { ...club.stadium, capacity: club.stadium.capacity + 1_000 },
    titles: { ...club.titles, league: club.titles.league + (i === 0 ? 1 : 0) },
    strength: set2026.clubs[set2026.clubs.length - 1 - i]!.strength!,
  })),
};

describe('new career (US-066, D4)', () => {
  it('uses the newest set and plays season 1 in its year', () => {
    const created = newCareerGame({ seed: 7, realism: 'full' }, params, identities, [
      set2026,
      set2027,
    ]);
    if (!created.ok) throw new Error(created.error);
    const { baseSeason, game } = created.value;
    expect(baseSeason).toBe(2027);
    expect([game.year, game.season, game.round]).toEqual([2027, 1, 1]);
    expect(game.fixtures.every((f) => f.date.startsWith('2027-'))).toBe(true);
    // Clubs, stadiums, capacities, titles and strengths are those of the 2027 set.
    expect(Object.values(game.clubs).map((c) => c.def)).toEqual(set2027.clubs);
  });

  it('with the sets of this build, is the 2026 set, in 2026', () => {
    const created = newCareerGame({ seed: 7, realism: 'simplified' }, params, identities);
    if (!created.ok) throw new Error(created.error);
    expect(created.value.baseSeason).toBe(2026);
    expect(created.value.game.year).toBe(2026);
    expect(Object.values(created.value.game.clubs).map((c) => c.def)).toEqual(set2026.clubs);
  });

  it('answers no-club-set for a build without sets, and the engine errors as they are', () => {
    expect(newCareerGame({ seed: 7, realism: 'full' }, params, identities, [])).toEqual({
      ok: false,
      error: 'no-club-set',
    });
    const broken: ClubSet = { baseSeason: 2028, clubs: set2026.clubs.slice(1) };
    expect(newCareerGame({ seed: 7, realism: 'full' }, params, identities, [broken])).toMatchObject(
      { ok: false, error: 'invalid-clubs' },
    );
  });
});

describe('an existing career does not change (US-066, third scenario)', () => {
  it('the v1 fixture, made with the 2026 set, reopens identical in a build that has the 2027 one', async () => {
    const fixture = JSON.parse(
      readFileSync(new URL('./__fixtures__/v1.json', import.meta.url), 'utf8'),
    ) as CareerSave;
    expect(fixture.career.baseSeason).toBe(2026);
    // A new career of this build would get the 2027 clubs...
    const created = newCareerGame({ seed: 1, realism: 'full' }, params, identities, [
      set2026,
      set2027,
    ]);
    if (!created.ok) throw new Error(created.error);
    const newDefs = Object.values(created.value.game.clubs).map((c) => c.def);
    expect(newDefs).not.toEqual(Object.values(fixture.game.clubs).map((c) => c.def));
    // ...and the existing one keeps its own, written and opened through the store.
    const s = store();
    const written = await s.writeSnapshot(fixture);
    if (!written.ok) throw new Error(written.error);
    const opened = await store().openCareer(fixture.careerId);
    if (!opened.ok) throw new Error(opened.error);
    expect(opened.value.save).toEqual(fixture);
    expect(opened.value.save.career.baseSeason).toBe(2026);
    for (const [id, club] of Object.entries(opened.value.save.game.clubs)) {
      expect(club.def, id).toEqual(fixture.game.clubs[id]!.def);
    }
  });
});
