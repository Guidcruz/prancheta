import { describe, expect, it, vi } from 'vitest';
import type { MatchSheet, MatchSheetEvent } from '../../engine/index.ts';
import { MAX_SAVE_BYTES } from './schema.ts';
import {
  atRound,
  fixturesOf,
  sheetKeys,
  snapshotSeqs,
  store,
  useFreshDatabase,
} from './testing/idb.ts';

/*
 * The size bound of a row of match sheets (`too-large`, docs/02-architecture.md, 4.2). With the
 * schema's bounds (10 matches a round, 2,000 events a match, ids of 100 characters) a row that
 * passes the schema stays under about 6 MB, far below the real 40 MB of MAX_SAVE_BYTES, so the
 * bound is lowered to 2 MB in this file only: the row is valid in the schema and past the bound.
 */

vi.mock('./schema.ts', async (original) => ({
  ...(await original<typeof import('./schema.ts')>()),
  MAX_SAVE_BYTES: 2 * 1024 * 1024,
}));

useFreshDatabase();

describe('a row of sheets past the size bound', () => {
  it('is refused as too-large before touching the database, valid as it is in the schema', async () => {
    expect(MAX_SAVE_BYTES).toBe(2 * 1024 * 1024);
    const save = atRound(2);
    const player = `${save.career.clubId}#${'9'.repeat(90)}`;
    const yellow: MatchSheetEvent = {
      minute: 10,
      half: 1,
      importance: 2,
      type: 'yellow',
      side: 'home',
      player,
      triggersSuspension: false,
    };
    const events = Array.from({ length: 2_000 }, () => yellow);
    const matchSheets: Record<string, MatchSheet> = { ...save.career.matchSheets };
    for (const id of fixturesOf(2)) matchSheets[id] = { fixtureId: id, events };
    const result = await store().writeSnapshot({
      ...save,
      career: { ...save.career, matchSheets },
    });
    expect(result).toMatchObject({ ok: false, error: 'too-large', detail: { round: 2 } });
    expect(await snapshotSeqs()).toEqual([]);
    expect(await sheetKeys()).toEqual([]);
  });
});
