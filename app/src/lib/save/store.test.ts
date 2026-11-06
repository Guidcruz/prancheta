import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import clubsData from '../../data/clubs.serie-a.json';
import brLists from '../../content/names/br.json';
import { newGame, type ClubDef, type GameState } from '../../engine/index.ts';
import { createIdentitySource } from '../generators/identity.ts';
import type { NameLists } from '../generators/names.ts';
import { loadGameParams } from '../params.ts';
import { encodeSave, gzip, sha256Hex } from './codec.ts';
import { SAVE_DB_NAME, SAVE_DB_VERSION, saveDbNameFor, type SaveDbSchema } from './db.ts';
import { KEPT_SNAPSHOTS, MAX_CAREERS, type CareerSave, type SnapshotRecord } from './schema.ts';
import { SaveStore } from './store.ts';
import { SAMPLE_CAREER_ID, sampleCareerSave } from './testing/sample.ts';

/*
 * Integration of the save layer with fake-indexeddb (docs/03-test-plan.md, 2 and 6): US-032 (3
 * versions, interrupted write, corrupted version, all corrupted), US-034 (list, independent
 * careers, delete, limit of 10), the test database and ADR-0012 (names kept on reopening).
 */

const DB = 'prancheta-unit';
const stores: SaveStore[] = [];

function store(dbName = DB): SaveStore {
  const created = new SaveStore({ dbName, now: () => new Date('2026-11-06T12:00:00.000Z') });
  stores.push(created);
  return created;
}

beforeEach(() => {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(stores.splice(0).map((s) => s.close()));
});

/** A new game (round 1), built once; variants copy it with another id, round or date. */
const base = sampleCareerSave({ rounds: 0 });

function variant(
  round: number,
  careerId = SAMPLE_CAREER_ID,
  updatedAt = `2026-11-06T12:${String(round).padStart(2, '0')}:00.000Z`,
): CareerSave {
  return { ...base, careerId, updatedAt, game: { ...base.game, round } };
}

async function raw() {
  return openDB<SaveDbSchema>(DB, SAVE_DB_VERSION);
}

async function snapshotSeqs(careerId = SAMPLE_CAREER_ID): Promise<number[]> {
  const db = await raw();
  const keys = await db.getAllKeys(
    'snapshots',
    IDBKeyRange.bound([careerId, 0], [careerId, Infinity]),
  );
  db.close();
  return keys.map((k) => k[1]);
}

async function tamper(seq: number, change: (r: SnapshotRecord) => SnapshotRecord) {
  const db = await raw();
  const record = await db.get('snapshots', [SAMPLE_CAREER_ID, seq]);
  await db.put('snapshots', change(record!));
  db.close();
}

const flipByte = (r: SnapshotRecord): SnapshotRecord => {
  const blob = r.blob.slice();
  const at = blob.length >> 1;
  blob[at] = blob[at]! ^ 0xff;
  return { ...r, blob };
};

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
    expect([...db.objectStoreNames].sort()).toEqual(['careers', 'errors', 'kv', 'snapshots']);
    const tx = db.transaction(['careers', 'snapshots', 'kv', 'errors']);
    expect(tx.objectStore('careers').keyPath).toBe('id');
    expect(tx.objectStore('snapshots').keyPath).toEqual(['careerId', 'seq']);
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

  it('never holds back a newer build opening the database in another tab', async () => {
    const s = store();
    await s.writeSnapshot(variant(2));
    // Another tab with a newer structure: it must not stay blocked by this connection.
    const newer = await openDB(DB, SAVE_DB_VERSION + 1);
    expect(newer.version).toBe(SAVE_DB_VERSION + 1);
    newer.close();
    // This (older) build then reads nothing, and says why.
    const result = await s.listCareers();
    expect(result).toEqual({
      ok: false,
      error: 'storage-unavailable',
      detail: { name: 'VersionError' },
    });
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
    expect(opened.value).toMatchObject({ seq: 1, skipped: [], roundsLost: 0, fromVersion: 1 });
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
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['put']>
    ) {
      // The snapshot is already in the transaction; the app "closes" before the pointer moves.
      if (this.name === 'careers') throw new DOMException('closed', 'InvalidStateError');
      return put.apply(this, args);
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

  it('answers quota-exceeded with the previous snapshot intact', async () => {
    const s = store();
    await s.writeSnapshot(variant(5));
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['put']>
    ) {
      if (this.name === 'snapshots') throw new DOMException('full', 'QuotaExceededError');
      return put.apply(this, args);
    });
    const result = await s.writeSnapshot(variant(6));
    expect(result.ok === false && result.error).toBe('quota-exceeded');
    vi.restoreAllMocks();
    expect(await snapshotSeqs()).toEqual([1]);
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok && opened.value.save.game.round).toBe(5);
  });

  it('removes a snapshot that does not read back equal and moves the pointer back', async () => {
    const s = store();
    await s.writeSnapshot(variant(5));
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['put']>
    ) {
      // The disk keeps something else than what was written.
      const [value] = args;
      if (this.name === 'snapshots') return put.call(this, flipByte(value as SnapshotRecord));
      return put.apply(this, args);
    });
    const result = await s.writeSnapshot(variant(6));
    expect(result.ok === false && result.error).toBe('verify-failed');
    vi.restoreAllMocks();
    expect(await snapshotSeqs()).toEqual([1]);
    const listed = await s.listCareers();
    expect(listed.ok && listed.value[0]).toMatchObject({ headSeq: 1, round: 5 });
  });

  it('leaves no trace of a new career whose first snapshot fails the check', async () => {
    const s = store();
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['put']>
    ) {
      const [value] = args;
      if (this.name === 'snapshots') return put.call(this, flipByte(value as SnapshotRecord));
      return put.apply(this, args);
    });
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
    for (const save of wrong)
      expect(await s.writeSnapshot(save)).toEqual({ ok: false, error: 'invalid-save' });
    expect(await s.listCareers()).toEqual({ ok: true, value: [] });
  });
});

describe('open with fallback (US-032)', () => {
  async function threeRounds(s: SaveStore) {
    for (const round of [4, 5, 6]) await s.writeSnapshot(variant(round));
  }

  it.each([
    ['a flipped byte', flipByte, 'corrupt-gzip'],
    [
      'a truncated gzip',
      (r: SnapshotRecord) => ({ ...r, blob: r.blob.slice(0, r.blob.length - 40) }),
      undefined,
    ],
    ['a wrong hash', (r: SnapshotRecord) => ({ ...r, sha256: '0'.repeat(64) }), 'hash-mismatch'],
    ['a wrong size', (r: SnapshotRecord) => ({ ...r, bytes: r.bytes + 1 }), 'size-mismatch'],
    [
      'no blob',
      (r: SnapshotRecord) => ({ ...r, blob: undefined }) as unknown as SnapshotRecord,
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
      expect(opened.value.save.game.round).toBe(5);
      expect(opened.value.roundsLost).toBe(1);
      expect(opened.value.skipped.map((x) => x.seq)).toEqual([3]);
      if (problem !== undefined) expect(opened.value.skipped[0]!.problem).toBe(problem);
    },
  );

  it('skips a snapshot whose JSON was truncated before hashing (hash right, JSON broken)', async () => {
    const s = store();
    await threeRounds(s);
    const text = new TextEncoder().encode(JSON.stringify(variant(6)).slice(0, 5000));
    const blob = await gzip(text);
    const sha256 = await sha256Hex(text);
    await tamper(3, (r) => ({ ...r, blob, sha256, bytes: text.byteLength }));
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok && opened.value.skipped).toEqual([{ seq: 3, problem: 'corrupt-json' }]);
  });

  it('skips a snapshot that decodes but is not this career', async () => {
    const s = store();
    await threeRounds(s);
    const other = await encodeSave(variant(6, 'another-career'));
    await tamper(3, (r) => ({ ...r, blob: other.gzip, sha256: other.sha256, bytes: other.bytes }));
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok && opened.value.skipped).toEqual([{ seq: 3, problem: 'incoherent' }]);
  });

  it('falls back two versions and counts the rounds across a season turn', async () => {
    const s = store();
    const v = (season: number, round: number) => ({
      ...variant(round),
      game: { ...base.game, season, round },
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
    const newer = await encodeSave({ ...variant(5), schemaVersion: 2 });
    await tamper(1, (r) => ({ ...r, blob: newer.gzip, sha256: newer.sha256, bytes: newer.bytes }));
    expect(await s.openCareer(SAMPLE_CAREER_ID)).toMatchObject({
      ok: false,
      error: 'save-too-new',
    });
  });

  it('answers not-found for a career that is not on the device', async () => {
    expect(await store().openCareer('nope')).toEqual({ ok: false, error: 'not-found' });
  });
});

describe('several careers (US-034)', () => {
  it('lists the careers with club, season and round, the most recent first', async () => {
    const s = store();
    await s.writeSnapshot(variant(3, 'a', '2026-11-01T10:00:00.000Z'));
    await s.writeSnapshot(variant(9, 'b', '2026-11-05T10:00:00.000Z'));
    await s.writeSnapshot(variant(1, 'c', '2026-11-03T10:00:00.000Z'));
    const listed = await s.listCareers();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.map((c) => c.id)).toEqual(['b', 'c', 'a']);
    const club = base.game.clubs[base.career.clubId]!.def;
    expect(listed.value[0]).toEqual({
      id: 'b',
      club,
      season: 1,
      round: 9,
      updatedAt: '2026-11-05T10:00:00.000Z',
      headSeq: 1,
      schemaVersion: 1,
    });
  });

  it('keeps careers independent', async () => {
    const s = store();
    await s.writeSnapshot(variant(3, 'a'));
    await s.writeSnapshot(variant(3, 'b'));
    const before = await s.openCareer('b');
    await s.writeSnapshot(variant(4, 'a'));
    await s.writeSnapshot(variant(5, 'a'));
    expect(await s.openCareer('b')).toEqual(before);
    const a = await s.openCareer('a');
    expect(a.ok && a.value.save.game.round).toBe(5);
  });

  it('deletes a career and its versions, and nothing else', async () => {
    const s = store();
    for (const round of [1, 2, 3, 4]) await s.writeSnapshot(variant(round, SAMPLE_CAREER_ID));
    await s.writeSnapshot(variant(1, 'other'));
    expect(await s.deleteCareer(SAMPLE_CAREER_ID)).toEqual({ ok: true, value: undefined });
    expect(await snapshotSeqs()).toEqual([]);
    expect(await s.openCareer(SAMPLE_CAREER_ID)).toEqual({ ok: false, error: 'not-found' });
    const listed = await s.listCareers();
    expect(listed.ok && listed.value.map((c) => c.id)).toEqual(['other']);
    expect(await snapshotSeqs('other')).toEqual([1]);
  });

  it('holds 10 careers, refuses the 11th and makes room after a delete', async () => {
    const s = store();
    for (let i = 0; i < MAX_CAREERS; i++) {
      expect((await s.writeSnapshot(variant(1, `career-${i}`))).ok).toBe(true);
    }
    expect(await s.writeSnapshot(variant(1, 'career-10'))).toEqual({
      ok: false,
      error: 'career-limit',
      detail: { max: 10 },
    });
    // The careers already there keep saving.
    expect((await s.writeSnapshot(variant(2, 'career-3'))).ok).toBe(true);
    const listed = await s.listCareers();
    expect(listed.ok && listed.value).toHaveLength(MAX_CAREERS);
    await s.deleteCareer('career-0');
    expect((await s.writeSnapshot(variant(1, 'career-10'))).ok).toBe(true);
  });
});

describe('kv store', () => {
  it('reads back what was written, and undefined for an unknown key', async () => {
    const s = store();
    expect(await s.readKv('lang')).toEqual({ ok: true, value: undefined });
    await s.writeKv('lang', 'es');
    await s.writeKv('newGame', { club: 3, realism: 'full' });
    expect(await s.readKv('lang')).toEqual({ ok: true, value: 'es' });
    expect(await store().readKv('newGame')).toEqual({
      ok: true,
      value: { club: 3, realism: 'full' },
    });
  });
});

describe('a whole season (T-018 with T-044: ADR-0012 conformance)', () => {
  const season = sampleCareerSave({ rounds: 38 });

  it('reopens the end-of-season save identical, names and faces included', async () => {
    const s = store();
    const written = await s.writeSnapshot(season);
    expect(written.ok).toBe(true);
    // A new store, as after closing and reopening the app.
    const opened = await store().openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
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

  it('fits the end-of-season snapshot in the 100 to 300 KB of gzip of 4.2', async () => {
    const encoded = await encodeSave(season);
    const kb = (n: number) => Math.round(n / 1024);
    console.info(
      `end-of-season save: ${kb(encoded.bytes)} KB JSON, ${kb(encoded.gzip.byteLength)} KB gzip ` +
        `(matchSheets ${kb(JSON.stringify(season.career.matchSheets).length)} KB JSON)`,
    );
    expect(encoded.gzip.byteLength).toBeLessThanOrEqual(300 * 1024);
  });
});
