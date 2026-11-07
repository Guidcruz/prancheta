import { describe, expect, it, vi } from 'vitest';
import { ErrorLog } from '../errors/index.ts';
import { SAVE_FIELD_NAMES } from '../save/index.ts';
import { onPut, raw, store, useFreshDatabase } from '../save/testing/idb.ts';
import { CLUB_SETS } from '../../data/club-sets.ts';
import type { ClubDef } from '../../engine/index.ts';
import { LAST_SETUP_KEY, parseLastSetup } from './new-game.ts';
import { CareerService, type CareerSetup } from './service.ts';

/*
 * What the new-game screen needs from the career layer (T-025): the "última configuração" in the
 * `kv` store, which never carries the club nor the nickname (CEO decision 2), and the clubs with
 * the strength the engine plays them with, also for a club without `strength` in the data.
 */

useFreshDatabase();

const COACH = 'Professor Zeca';
/** Every row of the `kv` store, as text: the nickname must be in none of them. */
async function allKv(): Promise<string> {
  const db = await raw();
  const rows = await db.getAll('kv');
  db.close();
  return JSON.stringify(rows);
}

const VERSIONS = { appVersion: '0.0.1', schemaVersion: 1, engineVersion: 1 };

function made(clubSets = CLUB_SETS) {
  const s = store();
  const log = new ErrorLog(VERSIONS, s, { fields: SAVE_FIELD_NAMES });
  const service = new CareerService({
    store: s,
    log,
    appVersion: '0.0.1',
    clubSets,
    newSeed: () => 2026,
  });
  return { service, store: s, log };
}

describe('the last new-game setup in kv (US-014)', () => {
  it('is absent the first time', async () => {
    expect(await made().service.lastSetup()).toBeUndefined();
  });

  it('keeps only the realism and the match mode, never the nickname nor the club', async () => {
    const { service, store: s } = made();
    const setup: CareerSetup = {
      coachName: COACH,
      clubId: 'flamingo',
      realism: 'simplified',
      matchMode: 'result',
    };
    // Even handed the whole setup, only the two fields are written.
    await service.rememberSetup(setup);
    const stored = await s.readKv(LAST_SETUP_KEY);
    expect(stored).toEqual({ ok: true, value: { realism: 'simplified', matchMode: 'result' } });
    expect(JSON.stringify(stored)).not.toContain(COACH);
    expect(JSON.stringify(stored)).not.toContain('flamingo');
    // Another service on the same database (the next new game) reads it back.
    expect(await made().service.lastSetup()).toEqual({
      realism: 'simplified',
      matchMode: 'result',
    });
  });

  it('a career created and remembered leaves no copy of the nickname in kv', async () => {
    const { service, store: s } = made();
    const created = await service.create({
      coachName: COACH,
      clubId: 'flamingo',
      realism: 'full',
      matchMode: 'result',
    });
    expect(created.ok).toBe(true);
    await service.rememberSetup({ realism: 'full', matchMode: 'result' });
    const kv = await s.readKv(LAST_SETUP_KEY);
    expect(kv).toEqual({ ok: true, value: { realism: 'full', matchMode: 'result' } });
    // No row of kv, under any key, has the nickname: the save is its only copy.
    expect(await allKv()).toContain('newGame.last');
    expect(await allKv()).not.toContain(COACH);
    const careerId = service.snapshot.save!.careerId;
    await service.remove(careerId);
    expect(await allKv()).not.toContain(COACH);
  });

  it('an invalid stored value counts as absent', async () => {
    const { service, store: s } = made();
    for (const value of [
      'full',
      null,
      [],
      { realism: 'hard', matchMode: 'result' },
      { realism: 'full', matchMode: 'live' },
      { realism: 'full' },
    ]) {
      await s.writeKv(LAST_SETUP_KEY, value);
      expect(await service.lastSetup(), JSON.stringify(value)).toBeUndefined();
    }
  });

  it('parses only the two known fields', () => {
    expect(parseLastSetup({ realism: 'full', matchMode: 'highlights', coachName: COACH })).toEqual({
      realism: 'full',
      matchMode: 'highlights',
    });
  });

  it('a failed write is only logged, without the setup', async () => {
    const { service, log } = made();
    onPut('kv', () => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    await expect(
      service.rememberSetup({ realism: 'full', matchMode: 'result' }),
    ).resolves.toBeUndefined();
    vi.restoreAllMocks();
    const entries = await log.list();
    expect(entries.map((e) => [e.code, e.screen])).toContainEqual([
      'quota-exceeded',
      'newGame.last',
    ]);
    expect(JSON.stringify(entries)).not.toContain('simplified');
  });
});

describe('the clubs of the new game', () => {
  it('are the 20 of the latest set, each with its strength', () => {
    const clubs = made().service.newGameClubs();
    expect(clubs).toHaveLength(20);
    const flamingo = clubs.find((c) => c.club.id === 'flamingo')!;
    expect(flamingo.strength).toBe(CLUB_SETS[0]!.clubs.find((c) => c.id === 'flamingo')!.strength);
  });

  it('a club without strength in the data shows the strength the engine gives it', () => {
    const raw = CLUB_SETS[0]!.clubs.map((club) => {
      if (club.id !== 'flamingo') return club;
      const { strength: _omit, ...rest } = club;
      void _omit;
      return rest as ClubDef;
    });
    const clubs = made([{ baseSeason: 2026, clubs: raw }]).service.newGameClubs();
    expect(clubs).toHaveLength(20);
    const flamingo = clubs.find((c) => c.club.id === 'flamingo')!;
    // The engine's default (DEFAULT_STRENGTH, engine/clubs.ts), the same number it plays with.
    expect(flamingo.strength).toBe(70);
    expect(flamingo.club.strength).toBe(70);
  });

  it('data that does not pass the check gives no clubs (create would refuse it too)', async () => {
    const broken = [{ baseSeason: 2026, clubs: CLUB_SETS[0]!.clubs.slice(0, 5) }];
    const { service, log } = made(broken);
    expect(service.newGameClubs()).toEqual([]);
    await vi.waitFor(async () =>
      expect((await log.list()).map((e) => e.code)).toContain('invalid-clubs'),
    );
  });
});
