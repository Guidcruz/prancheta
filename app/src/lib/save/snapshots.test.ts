import { openDB } from 'idb';
import { describe, expect, it, vi } from 'vitest';
import clubsData from '../../data/clubs.serie-a.json';
import brLists from '../../content/names/br.json';
import { newGame, type ClubDef, type GameState } from '../../engine/index.ts';
import { createIdentitySource } from '../generators/identity.ts';
import type { NameLists } from '../generators/names.ts';
import { loadGameParams } from '../params.ts';
import { encodeJson, encodeSave, gzip, sha256Hex } from './codec.ts';
import { SAVE_DB_NAME, saveDbNameFor } from './db.ts';
import { KEPT_SNAPSHOTS, MAX_SAVE_BYTES, type CareerSave, type SnapshotRecord } from './schema.ts';
import { SaveStore } from './store.ts';
import {
  DB,
  base,
  flipByte,
  mustEncodeSnapshot,
  onPut,
  raw,
  season,
  snapshotSeqs,
  store,
  tamper,
  useFreshDatabase,
  variant,
} from './testing/idb.ts';
import { SAMPLE_CAREER_ID, careerIdOf } from './testing/sample.ts';

/*
 * US-032 with fake-indexeddb (docs/03-test-plan.md, 2 and 6): the database and the test database,
 * the safe write with 3 versions (interrupted write, full disk, check by bytes and rollback,
 * another tab), open with fallback (corrupted version, all corrupted, newer build) and ADR-0012
 * (names kept on reopening). The rows of match sheets are in sheets.test.ts; the list of careers
 * (US-034) in careers.test.ts.
 */

useFreshDatabase();

describe('database', () => {
  it('uses prancheta, or prancheta-test only with PRANCHETA_ENV=test', () => {
    expect(saveDbNameFor('test')).toBe('prancheta-test');
    for (const env of [undefined, '', 'prod', 'production', 'TEST', 'dev']) {
      expect(saveDbNameFor(env)).toBe('prancheta');
    }
    // Vitest applies the `define` of app/vite.config.ts with the PRANCHETA_ENV of this run.
    expect(SAVE_DB_NAME).toBe(saveDbNameFor(process.env.PRANCHETA_ENV));
    expect(new SaveStore().dbName).toBe(SAVE_DB_NAME);
  });

  it('creates the stores of 4.2 with their keys', async () => {
    await store().listCareers();
    const db = await raw();
    expect([...db.objectStoreNames].sort()).toEqual([
      'careers',
      'errors',
      'kv',
      'matchSheets',
      'snapshots',
    ]);
    const tx = db.transaction(['careers', 'snapshots', 'matchSheets', 'kv', 'errors']);
    expect(tx.objectStore('careers').keyPath).toBe('id');
    expect(tx.objectStore('snapshots').keyPath).toEqual(['careerId', 'seq']);
    expect(tx.objectStore('matchSheets').keyPath).toEqual(['careerId', 'season', 'round']);
    expect(tx.objectStore('kv').keyPath).toBe('key');
    expect(tx.objectStore('errors').autoIncrement).toBe(true);
    db.close();
  });

  it('keeps the test database apart from the game one', async () => {
    const test = store(saveDbNameFor('test'));
    expect((await test.writeSnapshot(variant(2))).ok).toBe(true);
    const game = store(saveDbNameFor(''));
    expect(await game.listCareers()).toEqual({ ok: true, value: [] });
    const listed = await test.listCareers();
    expect(listed.ok && listed.value.map((c) => c.id)).toEqual([SAMPLE_CAREER_ID]);
  });

  it('never holds back a newer build in another tab, and then says the app is outdated', async () => {
    const s = store();
    await s.writeSnapshot(variant(2));
    // Another tab with a newer structure: it must not stay blocked by this connection.
    const newer = await openDB(DB, 2);
    expect(newer.version).toBe(2);
    newer.close();
    // This (older) build then reads nothing, and says why.
    expect(await s.listCareers()).toEqual({
      ok: false,
      error: 'app-outdated',
      detail: { name: 'VersionError' },
    });
    expect(await s.writeSnapshot(variant(3))).toMatchObject({ ok: false, error: 'app-outdated' });
  });

  it('answers storage-unavailable when IndexedDB cannot open', async () => {
    (globalThis as { indexedDB: unknown }).indexedDB = {
      open: () => {
        throw new DOMException('denied', 'SecurityError');
      },
    };
    const result = await store().writeSnapshot(variant(2));
    expect(result).toEqual({
      ok: false,
      error: 'storage-unavailable',
      detail: { name: 'SecurityError' },
    });
  });

  it.each([
    ['crypto.subtle', 'crypto', {}],
    ['CompressionStream', 'CompressionStream', undefined],
  ])('answers unsupported-browser without %s, writing and opening', async (_label, name, value) => {
    const s = store();
    await s.writeSnapshot(variant(2));
    vi.stubGlobal(name, value);
    expect(await s.writeSnapshot(variant(3))).toEqual({ ok: false, error: 'unsupported-browser' });
    expect(await s.openCareer(SAMPLE_CAREER_ID)).toEqual({
      ok: false,
      error: 'unsupported-browser',
    });
    vi.unstubAllGlobals();
    expect(await snapshotSeqs()).toEqual([1]);
  });
});

describe('safe write with 3 versions (US-032)', () => {
  it('writes, reads back and opens exactly what was saved', async () => {
    const s = store();
    const written = await s.writeSnapshot(base);
    expect(written.ok && written.value.seq).toBe(1);
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.value.save).toEqual(base);
    expect(opened.value).toMatchObject({
      seq: 1,
      headSeq: 1,
      skipped: [],
      roundsLost: 0,
      fromVersion: 1,
      missingSheetRounds: [],
      sheets: { season: 1, rounds: {} },
    });
  });

  it('saves at the end of each round and keeps at most 3 versions', async () => {
    const s = store();
    for (let round = 1; round <= 6; round++) {
      const result = await s.writeSnapshot(variant(round));
      expect(result.ok && result.value.seq).toBe(round);
      expect((await snapshotSeqs()).length).toBeLessThanOrEqual(KEPT_SNAPSHOTS);
    }
    expect(await snapshotSeqs()).toEqual([4, 5, 6]);
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok && opened.value.save.game.round).toBe(6);
    const listed = await s.listCareers();
    expect(listed.ok && listed.value[0]).toMatchObject({ headSeq: 6, round: 6, season: 1 });
  });

  it('changes nothing when the write is interrupted between the snapshot and the pointer', async () => {
    const s = store();
    await s.writeSnapshot(variant(4));
    await s.writeSnapshot(variant(5));
    onPut('careers', () => {
      // The snapshot is already in the transaction; the app "closes" before the pointer moves.
      throw new DOMException('closed', 'InvalidStateError');
    });
    const result = await s.writeSnapshot(variant(6));
    expect(result).toEqual({
      ok: false,
      error: 'write-failed',
      detail: { name: 'InvalidStateError' },
    });
    vi.restoreAllMocks();
    expect(await snapshotSeqs()).toEqual([1, 2]);
    const reopened = await store().openCareer(SAMPLE_CAREER_ID);
    expect(reopened.ok && reopened.value).toMatchObject({ seq: 2, roundsLost: 0 });
    expect(reopened.ok && reopened.value.save.game.round).toBe(5);
    // The next write continues after the last intact one.
    const next = await s.writeSnapshot(variant(6));
    expect(next.ok && next.value.seq).toBe(3);
  });

  it('answers quota-exceeded with the previous snapshot intact (a put refused)', async () => {
    const s = store();
    await s.writeSnapshot(variant(5));
    onPut('snapshots', () => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const result = await s.writeSnapshot(variant(6));
    expect(result.ok === false && result.error).toBe('quota-exceeded');
    vi.restoreAllMocks();
    expect(await snapshotSeqs()).toEqual([1]);
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok && opened.value.save.game.round).toBe(5);
  });

  it('answers quota-exceeded when the commit itself fails for lack of room', async () => {
    const s = store();
    await s.writeSnapshot(variant(5));
    // Every request succeeds; the transaction then aborts with QuotaExceededError at commit, as
    // browsers do when the disk fills up while committing.
    onPut('careers', (put, objectStore, ...args) => {
      const request = put(...args);
      const tx = objectStore.transaction as unknown as { _abort(name: string): void };
      request.addEventListener('success', () => tx._abort('QuotaExceededError'));
      return request;
    });
    const result = await s.writeSnapshot(variant(6));
    expect(result).toEqual({
      ok: false,
      error: 'quota-exceeded',
      detail: { name: 'QuotaExceededError' },
    });
    vi.restoreAllMocks();
    expect(await snapshotSeqs()).toEqual([1]);
    const listed = await s.listCareers();
    expect(listed.ok && listed.value[0]).toMatchObject({ headSeq: 1, round: 5 });
  });

  it('removes a snapshot that does not read back equal and moves the pointer back', async () => {
    const s = store();
    await s.writeSnapshot(variant(5));
    // The disk keeps something else than what was written.
    onPut('snapshots', (put, _store, value) => put(flipByte(value as SnapshotRecord)));
    const result = await s.writeSnapshot(variant(6));
    expect(result).toEqual({
      ok: false,
      error: 'verify-failed',
      detail: { problem: 'mismatch', rolledBack: true },
    });
    vi.restoreAllMocks();
    expect(await snapshotSeqs()).toEqual([1]);
    const listed = await s.listCareers();
    expect(listed.ok && listed.value[0]).toMatchObject({ headSeq: 1, round: 5 });
  });

  it('rolls back too when the snapshot cannot be read back', async () => {
    const s = store();
    await s.writeSnapshot(variant(5));
    const get = IDBObjectStore.prototype.get;
    vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['get']>
    ) {
      if (this.name === 'snapshots') throw new DOMException('gone', 'UnknownError');
      return get.apply(this, args);
    });
    const result = await s.writeSnapshot(variant(6));
    expect(result).toEqual({
      ok: false,
      error: 'verify-failed',
      detail: { problem: 'read-failed', rolledBack: true },
    });
    vi.restoreAllMocks();
    expect(await snapshotSeqs()).toEqual([1]);
  });

  it('says when the rollback failed too, and opening then skips the bad snapshot', async () => {
    const s = store();
    await s.writeSnapshot(variant(4));
    await s.writeSnapshot(variant(5));
    onPut('snapshots', (put, _store, value) => put(flipByte(value as SnapshotRecord)));
    vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(() => {
      throw new DOMException('closed', 'InvalidStateError');
    });
    const result = await s.writeSnapshot(variant(6));
    expect(result).toEqual({
      ok: false,
      error: 'verify-failed',
      detail: { problem: 'mismatch', rolledBack: false },
    });
    vi.restoreAllMocks();
    // The bad snapshot stayed the head...
    expect(await snapshotSeqs()).toEqual([1, 2, 3]);
    // ...and opening falls back past it.
    const opened = await store().openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok && opened.value).toMatchObject({ seq: 2, headSeq: 3, roundsLost: 1 });
    expect(opened.ok && opened.value.skipped.map((x) => x.seq)).toEqual([3]);
  });

  it('prunes on the next write the versions a failed prune left', async () => {
    const s = store();
    for (const round of [1, 2, 3]) await s.writeSnapshot(variant(round));
    vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(() => {
      throw new DOMException('closed', 'InvalidStateError');
    });
    expect((await s.writeSnapshot(variant(4))).ok).toBe(true);
    vi.restoreAllMocks();
    // One version too many, never one too few.
    expect(await snapshotSeqs()).toEqual([1, 2, 3, 4]);
    expect((await s.writeSnapshot(variant(5))).ok).toBe(true);
    expect(await snapshotSeqs()).toEqual([3, 4, 5]);
  });

  it('leaves no trace of a new career whose first snapshot fails the check', async () => {
    const s = store();
    onPut('snapshots', (put, _store, value) => put(flipByte(value as SnapshotRecord)));
    expect((await s.writeSnapshot(variant(1))).ok).toBe(false);
    vi.restoreAllMocks();
    expect(await s.listCareers()).toEqual({ ok: true, value: [] });
    expect(await snapshotSeqs()).toEqual([]);
  });

  it('runs two writes of the same career one after the other', async () => {
    const s = store();
    const [a, b] = await Promise.all([s.writeSnapshot(variant(1)), s.writeSnapshot(variant(2))]);
    expect(a.ok && a.value.seq).toBe(1);
    expect(b.ok && b.value.seq).toBe(2);
  });

  it('refuses what is not a save of the current format, without touching the database', async () => {
    const s = store();
    const wrong = [
      { ...base, schemaVersion: 2 },
      { ...base, careerId: '' },
      { ...base, career: { ...base.career, clubId: 'no-such-club' } },
      { ...base, career: { ...base.career, clubId: '__proto__' } },
    ] as unknown as CareerSave[];
    for (const save of wrong) {
      expect(await s.writeSnapshot(save)).toMatchObject({ ok: false, error: 'invalid-save' });
    }
    expect(await s.listCareers()).toEqual({ ok: true, value: [] });
  });

  it('refuses a snapshot past the size bound, before touching the database', async () => {
    const s = store();
    await s.writeSnapshot(variant(5));
    // Valid in every field (the schema's bounds are per field), over 40 MB in all.
    const vars = Object.fromEntries(
      Array.from({ length: 32 }, (_, i) => [`v${i}`, 'x'.repeat(200)]),
    );
    const news = Array.from({ length: 6_500 }, (_, i) => ({
      factId: `f${i}`,
      templateId: 't',
      variantId: 'v',
      vars,
    }));
    const huge = { ...variant(6), career: { ...base.career, news } };
    const result = await s.writeSnapshot(huge);
    expect(result.ok === false && result.error).toBe('too-large');
    expect(result.ok === false && result.detail).toMatchObject({ maxBytes: MAX_SAVE_BYTES });
    expect(await snapshotSeqs()).toEqual([1]);
  });

  it('stores the snapshot as its UTF-8 JSON, without gzip, in a buffer of its own length (T-072)', async () => {
    const save = variant(5);
    const result = await store().writeSnapshot(save);
    if (!result.ok) throw new Error(result.error);
    const db = await raw();
    const record = (await db.get('snapshots', [SAMPLE_CAREER_ID, 1]))!;
    db.close();
    const json = JSON.stringify({ ...save, career: { ...save.career, matchSheets: {} } });
    expect(new TextDecoder().decode(record.blob)).toBe(json);
    expect(record.blob.byteLength).toBe(record.bytes);
    // The whole buffer is the JSON: no slack of the encoder goes to the disk.
    expect(record.blob.buffer.byteLength).toBe(record.bytes);
    expect(record.sha256).toBe(await sha256Hex(record.blob));
    expect(result.value).toMatchObject({ bytes: record.bytes, storedBytes: record.bytes });
  });

  it('applies the 40 MB bound to the stored bytes when opening, before hashing them', async () => {
    const s = store();
    for (const round of [4, 5]) await s.writeSnapshot(variant(round));
    await tamper(2, (r) => ({ ...r, bytes: MAX_SAVE_BYTES + 1 }));
    const digest = vi.spyOn(crypto.subtle, 'digest');
    expect(await s.openCareer(SAMPLE_CAREER_ID)).toMatchObject({
      ok: true,
      value: { seq: 1, skipped: [{ seq: 2, problem: 'invalid-record' }] },
    });
    // Bytes that are not as many as the record says are refused before the hash.
    await tamper(2, (r) => {
      const longer = new Uint8Array(r.blob.byteLength + 10);
      longer.set(r.blob);
      return { ...r, bytes: r.blob.byteLength, blob: longer };
    });
    digest.mockClear();
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok && opened.value.skipped).toEqual([{ seq: 2, problem: 'size-mismatch' }]);
    // Only snapshot 1 was hashed (it opened), not the one of the wrong size.
    const hashed = digest.mock.calls.map(([, data]) => (data as Uint8Array).byteLength);
    const db = await raw();
    const first = (await db.get('snapshots', [SAMPLE_CAREER_ID, 1]))!;
    const second = (await db.get('snapshots', [SAMPLE_CAREER_ID, 2]))!;
    db.close();
    expect(hashed).toContain(first.bytes);
    expect(hashed).not.toContain(second.blob.byteLength);
    digest.mockRestore();
  });
});

describe('another tab on the same database (two stores)', () => {
  it('refuses with conflict a write whose head moved, inside the transaction', async () => {
    const a = store();
    const b = store();
    expect((await a.writeSnapshot(variant(1), undefined, { expectedHeadSeq: 0 })).ok).toBe(true);
    const openedA = await a.openCareer(SAMPLE_CAREER_ID);
    const openedB = await b.openCareer(SAMPLE_CAREER_ID);
    if (!openedA.ok || !openedB.ok) throw new Error('open');
    const guardA = { expectedHeadSeq: openedA.value.headSeq };
    const guardB = { expectedHeadSeq: openedB.value.headSeq };
    const written = await a.writeSnapshot(variant(2), openedA.value.sheets, guardA);
    expect(written.ok && written.value.seq).toBe(2);
    // The other tab plays from the old head: refused, nothing changes.
    expect(await b.writeSnapshot(variant(9), openedB.value.sheets, guardB)).toEqual({
      ok: false,
      error: 'conflict',
      detail: { expectedHeadSeq: 1, headSeq: 2 },
    });
    expect(await snapshotSeqs()).toEqual([1, 2]);
    const listed = await b.listCareers();
    expect(listed.ok && listed.value[0]).toMatchObject({ headSeq: 2, round: 2 });
    // Without a guard the write goes on as before.
    expect((await b.writeSnapshot(variant(3))).ok).toBe(true);
  });

  it('a new career expects head 0', async () => {
    expect(await store().writeSnapshot(variant(1), undefined, { expectedHeadSeq: 2 })).toEqual({
      ok: false,
      error: 'conflict',
      detail: { expectedHeadSeq: 2, headSeq: 0 },
    });
    expect(await snapshotSeqs()).toEqual([]);
  });

  it('a rollback does not move back a pointer that another tab already moved', async () => {
    const a = store();
    const b = store();
    await a.writeSnapshot(variant(4));
    // Between A's write and A's check, B writes on top of it; then A's check fails.
    const spied = a as unknown as { verify: (...args: unknown[]) => Promise<unknown> };
    vi.spyOn(spied, 'verify').mockImplementation(async () => {
      expect((await b.writeSnapshot(variant(6))).ok).toBe(true);
      return 'mismatch';
    });
    expect(await a.writeSnapshot(variant(5))).toEqual({
      ok: false,
      error: 'verify-failed',
      detail: { problem: 'mismatch', rolledBack: true },
    });
    vi.restoreAllMocks();
    // A's snapshot (2) is gone, B's (3) stays the head.
    expect(await snapshotSeqs()).toEqual([1, 3]);
    const listed = await a.listCareers();
    expect(listed.ok && listed.value[0]).toMatchObject({ headSeq: 3, round: 6 });
    const opened = await a.openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok && opened.value).toMatchObject({ seq: 3, skipped: [] });
  });
});

describe('open with fallback (US-032)', () => {
  async function threeRounds(s: SaveStore) {
    for (const round of [4, 5, 6]) await s.writeSnapshot(variant(round));
  }

  it.each([
    ['a flipped byte', flipByte, 'hash-mismatch'],
    [
      'truncated bytes',
      (r: SnapshotRecord) => ({ ...r, blob: r.blob.slice(0, r.blob.length - 40) }),
      'size-mismatch',
    ],
    [
      'a gzip of the right JSON (the snapshot is stored without gzip)',
      async (r: SnapshotRecord) => ({ ...r, blob: await gzip(r.blob) }),
      'size-mismatch',
    ],
    ['a wrong hash', (r: SnapshotRecord) => ({ ...r, sha256: '0'.repeat(64) }), 'hash-mismatch'],
    ['a wrong size', (r: SnapshotRecord) => ({ ...r, bytes: r.bytes + 1 }), 'size-mismatch'],
    [
      'no blob',
      (r: SnapshotRecord) => ({ ...r, blob: undefined }) as unknown as SnapshotRecord,
      'invalid-record',
    ],
    [
      'no season',
      (r: SnapshotRecord) => ({ ...r, season: undefined }) as unknown as SnapshotRecord,
      'invalid-record',
    ],
    [
      'an index that is a list',
      (r: SnapshotRecord) => ({ ...r, sheets: ['a'] }) as unknown as SnapshotRecord,
      'invalid-record',
    ],
    [
      'an index with round 0',
      (r: SnapshotRecord) => ({ ...r, sheets: { 0: '0'.repeat(64) } }),
      'invalid-record',
    ],
    [
      'an index with round 39',
      (r: SnapshotRecord) => ({ ...r, sheets: { 39: '0'.repeat(64) } }),
      'invalid-record',
    ],
    [
      'an index whose hash is not hex',
      (r: SnapshotRecord) => ({ ...r, sheets: { 3: 'not-a-hash' } }),
      'invalid-record',
    ],
  ])(
    'opens the previous version when the newest has %s, and says what was lost',
    async (_label, change, problem) => {
      const s = store();
      await threeRounds(s);
      await tamper(3, change);
      const opened = await s.openCareer(SAMPLE_CAREER_ID);
      expect(opened.ok).toBe(true);
      if (!opened.ok) return;
      expect(opened.value.seq).toBe(2);
      expect(opened.value.headSeq).toBe(3);
      expect(opened.value.save.game.round).toBe(5);
      expect(opened.value.roundsLost).toBe(1);
      expect(opened.value.skipped.map((x) => x.seq)).toEqual([3]);
      if (problem !== undefined) expect(opened.value.skipped[0]!.problem).toBe(problem);
    },
  );

  it('skips a snapshot whose JSON was truncated before hashing (hash right, JSON broken)', async () => {
    const s = store();
    await threeRounds(s);
    const blob = new TextEncoder().encode(JSON.stringify(variant(6)).slice(0, 5000));
    const sha256 = await sha256Hex(blob);
    await tamper(3, (r) => ({ ...r, blob, sha256, bytes: blob.byteLength }));
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok && opened.value.skipped).toEqual([{ seq: 3, problem: 'corrupt-json' }]);
  });

  it('skips a snapshot that decodes but is not this career', async () => {
    const s = store();
    await threeRounds(s);
    const other = await mustEncodeSnapshot(variant(6, careerIdOf('another-career')));
    await tamper(3, (r) => ({ ...r, blob: other.json, sha256: other.sha256, bytes: other.bytes }));
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok && opened.value.skipped).toEqual([{ seq: 3, problem: 'invalid-save' }]);
  });

  it('falls back two versions and counts the rounds across a season turn', async () => {
    const s = store();
    const v = (season: number, round: number) => ({
      ...variant(round),
      game: { ...base.game, season, round, year: base.game.year + season - 1 },
    });
    await s.writeSnapshot(v(1, 38));
    await s.writeSnapshot(v(1, 39));
    await s.writeSnapshot(v(2, 1));
    await tamper(3, flipByte);
    const one = await s.openCareer(SAMPLE_CAREER_ID);
    // From "season over" to round 1 of the next season no round is played.
    expect(one.ok && one.value).toMatchObject({ seq: 2, roundsLost: 0 });
    await tamper(2, flipByte);
    const two = await s.openCareer(SAMPLE_CAREER_ID);
    expect(two.ok && two.value).toMatchObject({ seq: 1, roundsLost: 1 });
    expect(two.ok && two.value.skipped.map((x) => x.seq)).toEqual([3, 2]);
  });

  it('does not open a career whose 3 versions fail, and keeps it listed', async () => {
    const s = store();
    await threeRounds(s);
    for (const seq of [1, 2, 3]) await tamper(seq, flipByte);
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok === false && opened.error).toBe('all-corrupt');
    const listed = await s.listCareers();
    expect(listed.ok && listed.value.map((c) => c.id)).toEqual([SAMPLE_CAREER_ID]);
    // Opening is read-only: the snapshots are still there, for diagnosis or export.
    expect(await snapshotSeqs()).toEqual([1, 2, 3]);
  });

  it('neither opens nor changes a save written by a newer build', async () => {
    const s = store();
    await threeRounds(s);
    await tamper(3, (r) => ({ ...r, schemaVersion: 2 }));
    const db = await raw();
    const before = await db.getAll('snapshots');
    db.close();
    expect((await s.openCareer(SAMPLE_CAREER_ID)).ok === false).toBe(true);
    expect(await s.openCareer(SAMPLE_CAREER_ID)).toMatchObject({
      ok: false,
      error: 'save-too-new',
    });
    const after = await raw();
    expect(await after.getAll('snapshots')).toEqual(before);
    // And the career pointer written by the newer build is never overwritten.
    await after.put('careers', {
      ...(await after.get('careers', SAMPLE_CAREER_ID))!,
      schemaVersion: 2,
    });
    after.close();
    expect(await s.writeSnapshot(variant(7))).toMatchObject({ ok: false, error: 'save-too-new' });
    expect(await snapshotSeqs()).toEqual([1, 2, 3]);
  });

  it('refuses a newer save also when only the JSON says so', async () => {
    const s = store();
    await s.writeSnapshot(variant(4));
    const newer = await mustEncodeSnapshot({ ...variant(5), schemaVersion: 2 });
    await tamper(1, (r) => ({ ...r, blob: newer.json, sha256: newer.sha256, bytes: newer.bytes }));
    expect(await s.openCareer(SAMPLE_CAREER_ID)).toMatchObject({
      ok: false,
      error: 'save-too-new',
    });
  });

  it('stops at save-too-new before any other check, never falling back past it', async () => {
    const s = store();
    await s.writeSnapshot(variant(4));
    await s.writeSnapshot(variant(5));
    // The newest says (only in the JSON) it is of a newer format, with a key that an older
    // format would refuse: still save-too-new, never the version before it.
    const newer = await mustEncodeSnapshot({ ...variant(6), schemaVersion: 2, toString: 'x' });
    await tamper(2, (r) => ({ ...r, blob: newer.json, sha256: newer.sha256, bytes: newer.bytes }));
    expect(await s.openCareer(SAMPLE_CAREER_ID)).toEqual({
      ok: false,
      error: 'save-too-new',
      detail: { version: 2 },
    });
  });

  it('answers not-found for a career that is not on the device', async () => {
    expect(await store().openCareer('nope')).toEqual({ ok: false, error: 'not-found' });
  });
});

describe('a whole season (T-018 with T-044: ADR-0012 conformance)', () => {
  it('reopens the end-of-season save identical, names and faces included', async () => {
    const s = store();
    const written = await s.writeSnapshot(season);
    expect(written.ok).toBe(true);
    // A new store, as after closing and reopening the app.
    const opened = await store().openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.value.save).toEqual(season);
    expect(JSON.stringify(opened.value.save)).toBe(JSON.stringify(season));
    expect(Object.keys(opened.value.save.career.matchSheets)).toHaveLength(380);
    expect(opened.value.save.career.lastRound?.round).toBe(38);
  });

  it('keeps the stored names when the name lists change (no name is resolved again)', async () => {
    const s = store();
    await s.writeSnapshot(season);
    // The lists change (a reordered copy, as a new yearly batch would): a new game would now
    // name its players differently...
    const lists = brLists as NameLists;
    // Exclusions are by index, so they do not apply to the reordered copy (test-only source).
    const reordered: NameLists = {
      ...lists,
      given: [...lists.given].reverse(),
      family: [...lists.family].reverse(),
      nicknames: [...lists.nicknames].reverse(),
    };
    const clubs = clubsData as unknown as ClubDef[];
    const fresh = newGame(
      { seed: 2026, year: 2026, realism: 'full' },
      clubs,
      loadGameParams(),
      createIdentitySource(reordered),
    );
    expect(fresh.ok).toBe(true);
    const freshState = (fresh as { value: GameState }).value;
    const names = (state: GameState) => Object.values(state.players).map((p) => p.name.full);
    expect(names(freshState)).not.toEqual(names(season.game));
    // ...but the career on the device keeps the names it was created with.
    const opened = await store().openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    for (const [id, player] of Object.entries(season.game.players)) {
      const reopened = opened.value.save.game.players[id]!;
      expect(reopened.name, id).toEqual(player.name);
      expect(reopened.face, id).toBe(player.face);
    }
    expect(opened.value.save.game.retiredNamesRev).toBe(season.game.retiredNamesRev);
  });

  it('keeps the end-of-season snapshot, sheets apart, within 800 KB stored and 300 KB in gzip', async () => {
    const snapshot = { ...season, career: { ...season.career, matchSheets: {} } };
    const stored = await encodeJson(snapshot);
    const exported = await encodeSave(snapshot);
    if (!stored.ok || !exported.ok) throw new Error('encode');
    const kb = (n: number) => Math.round(n / 1024);
    console.info(
      `end-of-season snapshot without sheets: ${kb(stored.value.bytes)} KB JSON stored, ` +
        `${kb(exported.value.gzip.byteLength)} KB gzip in the exported file ` +
        `(matchSheets ${kb(JSON.stringify(season.career.matchSheets).length)} KB JSON, apart)`,
    );
    // The trigger of docs/02-architecture.md, 5 (800 KB of JSON), now also the bytes stored.
    expect(stored.value.json.byteLength).toBeLessThanOrEqual(800 * 1024);
    expect(exported.value.gzip.byteLength).toBeLessThanOrEqual(300 * 1024);
  });
});
