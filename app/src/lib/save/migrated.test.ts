import { describe, expect, it, vi } from 'vitest';
import type { MatchSheet } from '../../engine/index.ts';
import { encodeSave } from './codec.ts';
import type { Migration } from './migrations/index.ts';
import type { CareerSave, MatchSheetRecord, SnapshotRecord } from './schema.ts';
import {
  atRound,
  flipByte,
  onPut,
  raw,
  snapshotSeqs,
  store,
  tamper,
  useFreshDatabase,
} from './testing/idb.ts';
import { SAMPLE_CAREER_ID } from './testing/sample.ts';

/*
 * The migration through the store (US-033; docs/02-architecture.md, 4.2, "Migração" and "Gravação
 * sem `base` numa carreira que já existe"; T-019). The real chain is empty while the format is
 * v1, so these tests use a synthetic version 0 that no build ever wrote: the coach's nickname is
 * `coach` instead of `coachName` and, in the variant that changes the sheets, the rating of the
 * best on the pitch is `bestRating` instead of `motmRating`. The step 0 → 1 is given to the store
 * as its chain (`SaveStoreOptions.migrations`).
 *
 * The three cases of 4.2: a migration that does not change the sheets keeps them in the older
 * snapshots; one that changes them and fails the check gives the old rows back; one that changes
 * them and is checked leaves the older snapshots openable, only without those rounds. And the
 * original is never changed when the migration itself fails.
 */

useFreshDatabase();

type Raw = Record<string, unknown>;

function toV0(save: CareerSave, changesSheets: boolean): Raw {
  const { coachName, ...career } = save.career;
  const matchSheets = Object.fromEntries(
    Object.entries(save.career.matchSheets).map(([id, sheet]) => {
      if (!changesSheets || sheet.motmRating === undefined) return [id, sheet];
      const { motmRating, ...rest } = sheet;
      return [id, { ...rest, bestRating: motmRating }];
    }),
  );
  return { ...save, schemaVersion: 0, career: { ...career, coach: coachName, matchSheets } };
}

function stepFrom0(changesSheets: boolean, run = vi.fn()): Migration {
  return {
    from: 0,
    migrate: (save) => {
      run();
      const { coach, ...career } = save.career as Raw;
      const sheets = career.matchSheets as Record<string, Raw>;
      const matchSheets = changesSheets
        ? Object.fromEntries(
            Object.entries(sheets).map(([id, sheet]) => {
              const { bestRating, ...rest } = sheet;
              return [id, bestRating === undefined ? rest : { ...rest, motmRating: bestRating }];
            }),
          )
        : sheets;
      return { ...save, career: { ...career, coachName: coach, matchSheets } };
    },
  };
}

async function encoded(value: unknown) {
  const result = await encodeSave(value);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

/**
 * Stores a career as an older build would have: the v0 forms of `saves` as snapshots 1..n (each
 * with the index of its rows) and the rows of match sheets by round.
 */
async function storeV0(saves: readonly CareerSave[], changesSheets: boolean): Promise<void> {
  const last = saves.at(-1)!;
  const fixtures = new Map(last.game.fixtures.map((f) => [f.id, f.round]));
  const byRound = new Map<number, [string, unknown][]>();
  const v0 = toV0(last, changesSheets);
  for (const [id, sheet] of Object.entries((v0.career as Raw).matchSheets as Raw)) {
    const round = fixtures.get(id)!;
    byRound.set(round, [...(byRound.get(round) ?? []), [id, sheet]]);
  }
  const rows: MatchSheetRecord[] = [];
  for (const [round, entries] of byRound) {
    const row = await encoded(Object.fromEntries(entries));
    rows.push({
      careerId: last.careerId,
      season: last.game.season,
      round,
      sha256: row.sha256,
      bytes: row.bytes,
      blob: row.gzip,
    });
  }
  const db = await raw();
  for (const row of rows) await db.put('matchSheets', row);
  for (const [i, save] of saves.entries()) {
    const old = toV0(save, changesSheets);
    const snapshot = await encoded({ ...old, career: { ...(old.career as Raw), matchSheets: {} } });
    const played = new Set(save.game.fixtures.filter((f) => f.result).map((f) => f.round));
    const record: SnapshotRecord = {
      careerId: save.careerId,
      seq: i + 1,
      schemaVersion: 0,
      savedAt: '2026-11-01T12:00:00.000Z',
      season: save.game.season,
      round: save.game.round,
      sheets: Object.fromEntries(
        rows.filter((r) => played.has(r.round)).map((r) => [r.round, r.sha256]),
      ),
      sha256: snapshot.sha256,
      bytes: snapshot.bytes,
      blob: snapshot.gzip,
    };
    await db.put('snapshots', record);
  }
  await db.put('careers', {
    id: last.careerId,
    club: last.game.clubs[last.career.clubId]!.def,
    season: last.game.season,
    round: last.game.round,
    updatedAt: last.updatedAt,
    headSeq: saves.length,
    schemaVersion: 0,
  });
  db.close();
}

async function rows(): Promise<MatchSheetRecord[]> {
  const db = await raw();
  const all = await db.getAll('matchSheets');
  db.close();
  return all;
}

/** Opens with the synthetic chain, writes the migrated save as the game does, returns both. */
async function openAndMigrate(changesSheets: boolean) {
  const s = store(undefined, { migrations: [stepFrom0(changesSheets)] });
  const opened = await s.openCareer(SAMPLE_CAREER_ID);
  if (!opened.ok) throw new Error(opened.error);
  const write = () =>
    s.writeSnapshot(opened.value.save, opened.value.sheets, {
      expectedHeadSeq: opened.value.headSeq,
    });
  return { s, opened: opened.value, write };
}

const saves = [3, 4, 5].map((played) => atRound(played));

describe('opening a save of an older format (US-033)', () => {
  it('migrates it in memory, checks it in full and hands an empty base, without writing', async () => {
    await storeV0(saves, true);
    const before = await rows();
    const { opened } = await openAndMigrate(true);
    expect(opened).toMatchObject({ seq: 3, headSeq: 3, fromVersion: 0, missingSheetRounds: [] });
    // The same career, round, club and table as the original (US-033, first scenario).
    expect(opened.save).toEqual(atRound(5));
    // The next write stores every round again, in the current format.
    expect(opened.sheets).toEqual({ season: 1, rounds: {} });
    expect(await rows()).toEqual(before);
    expect(await snapshotSeqs()).toEqual([1, 2, 3]);
  });

  it('the migrated save written as a new snapshot reopens as the current format', async () => {
    await storeV0(saves, true);
    const { write } = await openAndMigrate(true);
    const written = await write();
    if (!written.ok) throw new Error(written.error);
    expect(written.value.writtenRounds).toEqual([1, 2, 3, 4, 5]);
    // A build with the real (empty) chain opens it without migrating.
    const reopened = await store().openCareer(SAMPLE_CAREER_ID);
    if (!reopened.ok) throw new Error(reopened.error);
    expect(reopened.value).toMatchObject({ seq: 4, fromVersion: 1, missingSheetRounds: [] });
    expect(reopened.value.save).toEqual(atRound(5));
    expect(reopened.value.sheets).toEqual(written.value.sheets);
  });

  it('a migration that does not change the sheets keeps them in the older snapshots', async () => {
    await storeV0(saves, false);
    const before = await rows();
    const { write } = await openAndMigrate(false);
    expect((await write()).ok).toBe(true);
    // Same JSON, same hash: the older snapshots still accept the rows rewritten.
    expect((await rows()).map((r) => [r.round, r.sha256])).toEqual(
      before.map((r) => [r.round, r.sha256]),
    );
    await tamper(4, flipByte);
    const back = await store(undefined, { migrations: [stepFrom0(false)] }).openCareer(
      SAMPLE_CAREER_ID,
    );
    if (!back.ok) throw new Error(back.error);
    expect(back.value).toMatchObject({ seq: 3, fromVersion: 0, missingSheetRounds: [] });
    expect(back.value.save).toEqual(atRound(5));
  });

  it('a migration that changes the sheets and fails the check gives the old rows back', async () => {
    await storeV0(saves, true);
    const before = await rows();
    const { write } = await openAndMigrate(true);
    // The disk keeps something else than the new snapshot: the check fails.
    onPut('snapshots', (put, _store, value) => put(flipByte(value as SnapshotRecord)));
    expect(await write()).toEqual({
      ok: false,
      error: 'verify-failed',
      detail: { problem: 'mismatch', rolledBack: true },
    });
    vi.restoreAllMocks();
    // Every row is the old one again, byte for byte, and the original opens whole.
    expect(await rows()).toEqual(before);
    expect(await snapshotSeqs()).toEqual([1, 2, 3]);
    const again = await store(undefined, { migrations: [stepFrom0(true)] }).openCareer(
      SAMPLE_CAREER_ID,
    );
    if (!again.ok) throw new Error(again.error);
    expect(again.value).toMatchObject({ seq: 3, headSeq: 3, missingSheetRounds: [] });
    expect(again.value.save).toEqual(atRound(5));
  });

  it('a migration that changes the sheets and is checked leaves the older snapshots openable, without those rounds', async () => {
    await storeV0(saves, true);
    const { write } = await openAndMigrate(true);
    const written = await write();
    if (!written.ok) throw new Error(written.error);
    // The accepted limit of 4.2: if the migrated snapshot breaks later, the older one opens, and
    // the rounds whose sheets the migration changed are reported as missing.
    await tamper(4, flipByte);
    const back = await store(undefined, { migrations: [stepFrom0(true)] }).openCareer(
      SAMPLE_CAREER_ID,
    );
    if (!back.ok) throw new Error(back.error);
    expect(back.value.seq).toBe(3);
    expect(back.value.missingSheetRounds).toEqual([1, 2, 3, 4, 5]);
    expect(back.value.save.career.matchSheets).toEqual({});
    expect(back.value.save.game).toEqual(atRound(5).game);
  });

  it('a migration that fails leaves the original intact and does not open it', async () => {
    await storeV0(saves, true);
    const db = await raw();
    const before = {
      snapshots: await db.getAll('snapshots'),
      sheets: await db.getAll('matchSheets'),
    };
    db.close();
    const failing: Migration = {
      from: 0,
      migrate: () => {
        throw new Error('broken step');
      },
    };
    const s = store(undefined, { migrations: [failing] });
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    expect(opened).toEqual({
      ok: false,
      error: 'all-corrupt',
      detail: {
        snapshots: 3,
        skipped: [3, 2, 1].map((seq) => ({ seq, problem: 'migration-failed' })),
      },
    });
    // What the caller records has no content of the save (US-033, US-045).
    expect(JSON.stringify(opened)).not.toContain('Treinador');
    const after = await raw();
    expect({
      snapshots: await after.getAll('snapshots'),
      sheets: await after.getAll('matchSheets'),
    }).toEqual(before);
    after.close();
  });

  it('without the step (the real chain) a version 0 is not opened either, and nothing changes', async () => {
    await storeV0(saves, false);
    const opened = await store().openCareer(SAMPLE_CAREER_ID);
    expect(opened).toMatchObject({ ok: false, error: 'all-corrupt' });
    expect(await snapshotSeqs()).toEqual([1, 2, 3]);
  });

  it('a migrated save that does not pass the strict schema is skipped, not opened', async () => {
    await storeV0(saves, true);
    // A step that forgets to rename the sheets' field: the result is not the v1 format.
    const sloppy = stepFrom0(false);
    const opened = await store(undefined, { migrations: [sloppy] }).openCareer(SAMPLE_CAREER_ID);
    expect(opened).toMatchObject({ ok: false, error: 'all-corrupt' });
    expect(opened.ok === false && opened.detail).toMatchObject({
      skipped: [3, 2, 1].map((seq) => ({ seq, problem: 'invalid-save' })),
    });
  });
});

describe('the step of a sheet that changes (the synthetic format itself)', () => {
  it('turns bestRating into motmRating and back', () => {
    const save = atRound(2);
    const v0 = toV0(save, true);
    const sheets = Object.values((v0.career as Raw).matchSheets as Record<string, Raw>);
    expect(sheets.some((sheet) => 'bestRating' in sheet)).toBe(true);
    const back = stepFrom0(true).migrate(v0);
    expect({ ...back, schemaVersion: 1 }).toEqual(save);
    const sheet = Object.values(save.career.matchSheets)[0] as MatchSheet;
    expect(sheet.motmRating).toBeDefined();
  });
});
