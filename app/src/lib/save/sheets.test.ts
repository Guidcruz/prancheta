import { describe, expect, it, vi } from 'vitest';
import type { MatchSheet } from '../../engine/index.ts';
import { decodeSave } from './codec.ts';
import { MAX_SAVE_BYTES, type CareerSave, type MatchSheetRecord } from './schema.ts';
import type { WrittenSnapshot } from './store.ts';
import {
  atRound,
  fixturesOf,
  flipByte,
  mustEncode,
  onPut,
  raw,
  season,
  sheetKeys,
  snapshotSeqs,
  store,
  tamper,
  tamperSheet,
  useFreshDatabase,
} from './testing/idb.ts';
import { SAMPLE_CAREER_ID } from './testing/sample.ts';

/*
 * The match sheets out of the snapshot (docs/02-architecture.md, 4.2, "Súmulas fora do
 * snapshot"; ADR-0019): one row per round in the `matchSheets` store, written in the snapshot's
 * transaction, only the rounds the `base` index lacks; reassembled on opening, where a bad row
 * costs only its round; kept while a snapshot of their season is kept.
 */

useFreshDatabase();

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

function written(result: Awaited<ReturnType<ReturnType<typeof store>['writeSnapshot']>>) {
  if (!result.ok) throw new Error(`writeSnapshot: ${result.error}`);
  return result.value;
}

/** The decoded JSON of a stored snapshot, as it is on disk. */
async function storedSnapshot(seq: number): Promise<CareerSave> {
  const db = await raw();
  const record = await db.get('snapshots', [SAMPLE_CAREER_ID, seq]);
  db.close();
  const decoded = await decodeSave(record!.blob, record!.sha256, record!.bytes);
  if (!decoded.ok) throw new Error(decoded.error);
  return decoded.value as CareerSave;
}

/** The save after `played` rounds with the sheets of round `round` changed (a replayed round). */
function replayed(played: number, round: number): CareerSave {
  const save = atRound(played);
  const ids = new Set(fixturesOf(round));
  const matchSheets = Object.fromEntries(
    Object.entries(save.career.matchSheets).map(([id, sheet]) => [
      id,
      ids.has(id) ? ({ ...sheet, replayed: true } as unknown as MatchSheet) : sheet,
    ]),
  );
  return { ...save, career: { ...save.career, matchSheets } };
}

describe('writing the sheets by round', () => {
  it('without a base writes every round, and the snapshot keeps matchSheets empty', async () => {
    const s = store();
    const w = written(await s.writeSnapshot(atRound(5)));
    expect(w.writtenRounds).toEqual(range(1, 5));
    expect(w.sheets.season).toBe(1);
    expect(Object.keys(w.sheets.rounds).map(Number)).toEqual(range(1, 5));
    expect(await sheetKeys()).toEqual(range(1, 5).map((r) => [1, r]));
    const onDisk = await storedSnapshot(1);
    expect(onDisk.career.matchSheets).toEqual({});
    // The rest of the snapshot is the save as given.
    expect({ ...onDisk, career: { ...onDisk.career, matchSheets: undefined } }).toEqual({
      ...atRound(5),
      career: { ...atRound(5).career, matchSheets: undefined },
    });
    // The index of the record is the one returned, and each row hashes to it.
    const db = await raw();
    const record = await db.get('snapshots', [SAMPLE_CAREER_ID, 1]);
    const row = await db.get('matchSheets', [SAMPLE_CAREER_ID, 1, 3]);
    db.close();
    expect(record).toMatchObject({ season: 1, round: 6, sheets: w.sheets.rounds });
    expect(row!.sha256).toBe(w.sheets.rounds[3]);
    const decoded = await decodeSave(row!.blob, row!.sha256, row!.bytes);
    expect(decoded.ok && Object.keys(decoded.value as object).sort()).toEqual(fixturesOf(3).sort());
  });

  it('with the base of the previous snapshot writes only the new round', async () => {
    const s = store();
    const first = written(await s.writeSnapshot(atRound(37)));
    expect(first.writtenRounds).toHaveLength(37);
    const putSheet = vi.spyOn(IDBObjectStore.prototype, 'put');
    const next = written(await s.writeSnapshot(atRound(38), first.sheets));
    const sheetPuts = putSheet.mock.contexts.filter(
      (c) => (c as IDBObjectStore).name === 'matchSheets',
    );
    expect(sheetPuts).toHaveLength(1);
    expect(next.writtenRounds).toEqual([38]);
    expect(Object.keys(next.sheets.rounds)).toHaveLength(38);
    for (const round of range(1, 37)) {
      expect(next.sheets.rounds[round]).toBe(first.sheets.rounds[round]);
    }
    // With nothing new (the snapshot after the last round), nothing is written.
    const after = written(await s.writeSnapshot({ ...atRound(38), updatedAt: 'x' }, next.sheets));
    expect(after.writtenRounds).toEqual([]);
    expect(after.sheets).toEqual(next.sheets);
  });

  it('ignores a base of another season, and writes everything', async () => {
    const s = store();
    const first = written(await s.writeSnapshot(atRound(3)));
    const other = written(await s.writeSnapshot(atRound(3, 2), first.sheets));
    expect(other.writtenRounds).toEqual([1, 2, 3]);
    expect(other.sheets.season).toBe(2);
  });

  it('round-trips the whole season, deeply equal, with the index to pass on', async () => {
    const s = store();
    const first = written(await s.writeSnapshot(atRound(37)));
    const next = written(await s.writeSnapshot(season, first.sheets));
    const opened = await store().openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.value.save).toEqual(season);
    expect(opened.value.sheets).toEqual(next.sheets);
    expect(opened.value.missingSheetRounds).toEqual([]);
    expect(Object.keys(opened.value.save.career.matchSheets)).toHaveLength(380);
  });

  it('refuses a sheet of a match not played, or not in the calendar, as invalid-save', async () => {
    const s = store();
    const save = atRound(5);
    const unplayed = fixturesOf(6)[0]!;
    const some = Object.values(save.career.matchSheets)[0]!;
    for (const fixtureId of [unplayed, 'no-such-fixture']) {
      const wrong = {
        ...save,
        career: { ...save.career, matchSheets: { ...save.career.matchSheets, [fixtureId]: some } },
      };
      expect(await s.writeSnapshot(wrong)).toEqual({
        ok: false,
        error: 'invalid-save',
        detail: { fixtureId },
      });
    }
    expect(await snapshotSeqs()).toEqual([]);
    expect(await sheetKeys()).toEqual([]);
  });

  it('refuses a round of sheets past the size bound, before touching the database', async () => {
    const s = store();
    const save = atRound(2);
    const id = fixturesOf(2)[0]!;
    const huge = { pad: 'x'.repeat(MAX_SAVE_BYTES) } as unknown as MatchSheet;
    const result = await s.writeSnapshot({
      ...save,
      career: { ...save.career, matchSheets: { ...save.career.matchSheets, [id]: huge } },
    });
    expect(result.ok === false && result.error).toBe('too-large');
    expect(result.ok === false && result.detail).toMatchObject({ round: 2 });
    expect(await snapshotSeqs()).toEqual([]);
  });
});

describe('failures while writing the sheets', () => {
  it('changes nothing when the disk is full at the row of sheets', async () => {
    const s = store();
    const first = written(await s.writeSnapshot(atRound(4)));
    const db = await raw();
    const before = [await db.getAll('snapshots'), await db.getAll('matchSheets')];
    db.close();
    onPut('matchSheets', () => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const result = await s.writeSnapshot(atRound(5), first.sheets);
    expect(result.ok === false && result.error).toBe('quota-exceeded');
    vi.restoreAllMocks();
    const after = await raw();
    expect([await after.getAll('snapshots'), await after.getAll('matchSheets')]).toEqual(before);
    after.close();
    const listed = await s.listCareers();
    expect(listed.ok && listed.value[0]).toMatchObject({ headSeq: 1, round: 5 });
  });

  it('rolls back the snapshot when a row of sheets reads back different', async () => {
    const s = store();
    const first = written(await s.writeSnapshot(atRound(4)));
    onPut('matchSheets', (put, _store, value) => put(flipByte(value as MatchSheetRecord)));
    expect(await s.writeSnapshot(atRound(5), first.sheets)).toEqual({
      ok: false,
      error: 'verify-failed',
      detail: { problem: 'mismatch', rolledBack: true },
    });
    vi.restoreAllMocks();
    expect(await snapshotSeqs()).toEqual([1]);
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok && opened.value).toMatchObject({ seq: 1, headSeq: 1, missingSheetRounds: [] });
    // Only the snapshot goes: the row stays, and no index lists it with that content.
    expect(await sheetKeys()).toEqual(range(1, 5).map((r) => [1, r]));
  });
});

describe('opening with the sheets', () => {
  it.each([
    ['a flipped byte', (r: MatchSheetRecord) => flipByte(r)],
    ['a missing row', () => undefined],
    ['a wrong size', (r: MatchSheetRecord) => ({ ...r, bytes: r.bytes + 1 })],
    [
      'no blob',
      (r: MatchSheetRecord) => ({ ...r, blob: undefined }) as unknown as MatchSheetRecord,
    ],
  ])('opens the snapshot without the round whose row has %s', async (_label, change) => {
    const s = store();
    written(await s.writeSnapshot(atRound(6)));
    await tamperSheet(1, 4, change);
    const opened = await store().openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.value).toMatchObject({ seq: 1, skipped: [], missingSheetRounds: [4] });
    expect(Object.keys(opened.value.sheets.rounds).map(Number)).toEqual([1, 2, 3, 5, 6]);
    const ids = Object.keys(opened.value.save.career.matchSheets);
    expect(ids).toHaveLength(50);
    for (const id of fixturesOf(4)) expect(ids).not.toContain(id);
    // The result of the matches stays in the calendar.
    expect(opened.value.save.game.fixtures.filter((f) => f.round === 4 && f.result)).toHaveLength(
      10,
    );
  });

  it('opens without the round whose row another timeline rewrote (hash differs)', async () => {
    const s = store();
    written(await s.writeSnapshot(atRound(6)));
    const other = await mustEncode({ [fixturesOf(2)[0]!]: { other: true } });
    await tamperSheet(1, 2, (r) => ({
      ...r,
      sha256: other.sha256,
      bytes: other.bytes,
      blob: other.gzip,
    }));
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok && opened.value.missingSheetRounds).toEqual([2]);
    expect(opened.ok && opened.value.save.career.matchSheets[fixturesOf(2)[0]!]).toBeUndefined();
  });

  it('opens without the round whose row hashes right but is not a map of sheets', async () => {
    const s = store();
    written(await s.writeSnapshot(atRound(3)));
    const list = await mustEncode(['not', 'a', 'map']);
    await tamperSheet(1, 1, (r) => ({
      ...r,
      sha256: list.sha256,
      bytes: list.bytes,
      blob: list.gzip,
    }));
    await tamper(1, (r) => ({ ...r, sheets: { ...r.sheets, 1: list.sha256 } }));
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok && opened.value.missingSheetRounds).toEqual([1]);
  });

  it('goes back to the previous version and plays the round again', async () => {
    const s = store();
    let last: WrittenSnapshot = written(await s.writeSnapshot(atRound(35)));
    for (const played of [36, 37, 38]) {
      last = written(await s.writeSnapshot(atRound(played), last.sheets));
    }
    expect(await snapshotSeqs()).toEqual([2, 3, 4]);
    // The newest version (round 38 played) is corrupted: the game opens the one before.
    await tamper(4, flipByte);
    const back = await s.openCareer(SAMPLE_CAREER_ID);
    if (!back.ok) throw new Error(back.error);
    expect(back.value).toMatchObject({ seq: 3, headSeq: 4, roundsLost: 1, missingSheetRounds: [] });
    expect(back.value.sheets.rounds[38]).toBeUndefined();
    expect(back.value.save).toEqual(atRound(37));
    // Round 38 again, with another outcome: its row is written again.
    const again = written(
      await s.writeSnapshot(replayed(38, 38), back.value.sheets, {
        expectedHeadSeq: back.value.headSeq,
      }),
    );
    expect(again).toMatchObject({ seq: 5, writtenRounds: [38] });
    const reopened = await store().openCareer(SAMPLE_CAREER_ID);
    if (!reopened.ok) throw new Error(reopened.error);
    expect(reopened.value).toMatchObject({ seq: 5, missingSheetRounds: [] });
    expect(reopened.value.save).toEqual(replayed(38, 38));
    // The corrupted version 4 indexed the first round 38: if it ever opened, that round would be
    // missing (its hash is not the row's any more), never the replayed one by mistake.
    expect(last.sheets.rounds[38]).not.toBe(again.sheets.rounds[38]);
    const db = await raw();
    const row = await db.get('matchSheets', [SAMPLE_CAREER_ID, 1, 38]);
    db.close();
    expect(row!.sha256).toBe(again.sheets.rounds[38]);
  });

  it('keeps the rows of the old season while one of its snapshots is kept', async () => {
    const s = store();
    let w = written(await s.writeSnapshot(atRound(37)));
    w = written(await s.writeSnapshot(atRound(38), w.sheets)); // seq 2, season 1 over
    // The season turn: the sheets were zeroed by the CareerService (ADR-0019).
    w = written(await s.writeSnapshot(atRound(0, 2), w.sheets)); // seq 3, season 2, round 1
    expect(w.sheets).toEqual({ season: 2, rounds: {} });
    const seasonOne = () => sheetKeys().then((keys) => keys.filter(([sn]) => sn === 1).length);
    expect(await seasonOne()).toBe(38);
    w = written(await s.writeSnapshot(atRound(1, 2), w.sheets)); // seq 4; seq 2 (season 1) kept
    expect(await snapshotSeqs()).toEqual([2, 3, 4]);
    expect(await seasonOne()).toBe(38);
    // The last snapshot of season 1 still opens whole, if the newer ones fail.
    await tamper(4, flipByte);
    await tamper(3, flipByte);
    const old = await s.openCareer(SAMPLE_CAREER_ID);
    expect(old.ok && old.value).toMatchObject({ seq: 2, missingSheetRounds: [] });
    expect(old.ok && Object.keys(old.value.save.career.matchSheets)).toHaveLength(380);
    // The third write of season 2 leaves no snapshot of season 1: its rows go.
    w = written(await s.writeSnapshot(atRound(2, 2), w.sheets));
    expect(await snapshotSeqs()).toEqual([3, 4, 5]);
    expect(await seasonOne()).toBe(0);
    expect(await sheetKeys()).toEqual([
      [2, 1],
      [2, 2],
    ]);
  });

  it('keeps the rows of a season that a newer snapshot uses after a fallback', async () => {
    const s = store();
    let w = written(await s.writeSnapshot(atRound(36))); // seq 1, season 1
    const base36 = w.sheets;
    w = written(await s.writeSnapshot(atRound(0, 2), w.sheets)); // seq 2, season 2
    w = written(await s.writeSnapshot(atRound(1, 2), w.sheets)); // seq 3, season 2
    await tamper(2, flipByte);
    await tamper(3, flipByte);
    const back = await s.openCareer(SAMPLE_CAREER_ID);
    if (!back.ok) throw new Error(back.error);
    expect(back.value).toMatchObject({ seq: 1, sheets: base36 });
    // Season 1 goes on from the fallback: seq 4 is of season 1, older than the kept seq 2 and 3.
    w = written(await s.writeSnapshot(atRound(37), back.value.sheets));
    expect(await snapshotSeqs()).toEqual([2, 3, 4]);
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok && opened.value).toMatchObject({ seq: 4, missingSheetRounds: [] });
    expect(opened.ok && opened.value.save).toEqual(atRound(37));
  });
});
