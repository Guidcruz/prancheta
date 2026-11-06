import type { IDBPTransaction } from 'idb';
import { SEASON_ROUNDS, type Fixture } from '../../engine/index.ts';
import { isCareerSave } from './check.ts';
import {
  codecSupported,
  decodeSave,
  encodeSave,
  equalBytes,
  type Bytes,
  type DecodeError,
} from './codec.ts';
import { SAVE_DB_NAME, openSaveDb, type SaveDb, type SaveDbSchema } from './db.ts';
import { migrateSave, type MigrationError } from './migrations/index.ts';
import { fail, ok, type SaveResult } from './result.ts';
import {
  KEPT_SNAPSHOTS,
  MAX_CAREERS,
  MAX_SAVE_BYTES,
  SAVE_SCHEMA_VERSION,
  type CareerSave,
  type CareerSummary,
  type MatchSheetRecord,
  type SheetIndex,
  type SnapshotRecord,
} from './schema.ts';

/*
 * Careers on the device (docs/02-architecture.md, 4.2; ADR-0006, ADR-0019; US-032, US-034).
 *
 * Safe write: (1) before any transaction, serialise, hash and gzip the save with
 * `career.matchSheets: {}`, and each round of match sheets that the `base` index does not have
 * (normally only the round just played); (2) in one transaction over `careers`, `snapshots` and
 * `matchSheets`, store `seq = headSeq + 1`, the new rows of sheets, and move `headSeq` (atomic: if
 * the app closes halfway, nothing changes); (3) read the snapshot and the new rows back and compare
 * `sha256`, `bytes` and the gzip byte by byte with what was in memory, without decompressing. Only
 * then the snapshots past the 3 newest go, and after them the rows of the seasons that no kept
 * snapshot uses; if the check fails, the new snapshot goes instead and `headSeq` returns (the rows
 * stay: each snapshot only accepts the rows its index lists, by hash).
 *
 * Open with fallback: the snapshots from the newest to the oldest; the first that passes size,
 * hash and parse has its rows of sheets put back in `career.matchSheets`, then goes through the
 * migration and the coherence check. A bad or missing row never skips the snapshot: the round is
 * reported in `missingSheetRounds`. The result says how many rounds were lost. A save written by a
 * newer build is never opened nor changed. When every snapshot fails the career stays listed and
 * the error says so (the game offers to import, US-036).
 *
 * Every operation of one store runs in order, one at a time, so a double tap never interleaves two
 * writes of the same career; another tab (another store on the same database) is caught by the
 * `expectedHeadSeq` guard of the write. Nothing here throws for a storage situation: it returns a
 * code. Recording the error (the ring of US-045, without personal data) is the caller's job: the
 * `CareerService` of T-023 logs what comes back here; this layer keeps no log of its own.
 */

/** IndexedDB could not be opened, or a read failed. */
export type StorageError =
  | 'storage-unavailable'
  /** Another tab opened the database with a newer structure: this build must reload. */
  | 'app-outdated'
  | 'read-failed';

export type WriteError =
  | StorageError
  /** The device has no room: nothing changed, the previous snapshot is intact. */
  | 'quota-exceeded'
  /** The transaction failed for another reason: nothing changed. */
  | 'write-failed'
  /**
   * The new snapshot or a new row of sheets did not read back equal, or could not be read back.
   * With `detail.rolledBack: true` the new snapshot was removed and the pointer returned to the
   * previous one (unless another tab already wrote past it). With `rolledBack: false` the removal
   * failed too: the new snapshot stays the head, and opening skips it if it is really bad.
   */
  | 'verify-failed'
  /** The head is no longer `expectedHeadSeq` (another tab wrote): nothing changed. */
  | 'conflict'
  /** A new career beyond {@link MAX_CAREERS}. */
  | 'career-limit'
  /** The career was last written by a newer build: never overwritten (US-033). */
  | 'save-too-new'
  /** The JSON of the snapshot or of a round of sheets passes {@link MAX_SAVE_BYTES}. */
  | 'too-large'
  /** No `crypto.subtle` (not a secure context) or no compression streams (Safari < 16.4). */
  | 'unsupported-browser'
  /** Not a save of the current format, or a sheet of a match not played (caller's bug). */
  | 'invalid-save';

export type OpenError =
  | StorageError
  | 'unsupported-browser'
  | 'not-found'
  /** Written by a newer build of the game: not opened and not changed (US-033). */
  | 'save-too-new'
  /** No snapshot passed the checks; the career stays listed (US-032). */
  | 'all-corrupt';

/** Why one snapshot was skipped when opening (diagnostics, no content). */
export type SnapshotProblem = DecodeError | MigrationError | 'invalid-record' | 'incoherent';

/** Optional guard of a write against another tab. */
export interface WriteGuard {
  /**
   * The `headSeq` the caller's save comes from (`OpenedCareer.headSeq`, then
   * `WrittenSnapshot.seq`; 0 for a career not yet stored). Checked inside the transaction.
   */
  readonly expectedHeadSeq: number;
}

export interface WrittenSnapshot {
  readonly seq: number;
  readonly sha256: string;
  /** JSON bytes and stored (gzip) bytes of the snapshot, sheets apart. */
  readonly bytes: number;
  readonly storedBytes: number;
  /** The index of this snapshot: the `base` of the next write. */
  readonly sheets: SheetIndex;
  /** Rounds whose row of sheets this write stored (the others were inherited from `base`). */
  readonly writtenRounds: readonly number[];
}

export interface OpenedCareer {
  readonly save: CareerSave;
  /** `seq` of the snapshot that opened. */
  readonly seq: number;
  /** `headSeq` of the career when it opened: the `expectedHeadSeq` of the next write. */
  readonly headSeq: number;
  /** Newer snapshots that failed the checks and were skipped. */
  readonly skipped: readonly { readonly seq: number; readonly problem: SnapshotProblem }[];
  /** Rounds played after the opened snapshot that were lost with the skipped ones (US-032). */
  readonly roundsLost: number;
  /**
   * The `schemaVersion` the snapshot had before migration. When it is older than the current one,
   * the caller writes the migrated save as a new snapshot (T-019), which keeps the original until
   * the new one is checked.
   */
  readonly fromVersion: number;
  /** The rows of sheets put back in `career.matchSheets`: the `base` of the next write. */
  readonly sheets: SheetIndex;
  /**
   * Rounds in the snapshot's index whose row was missing or failed its checks: their matches show
   * only `Fixture.result` (T-030 shows the notice).
   */
  readonly missingSheetRounds: readonly number[];
}

export interface SaveStoreOptions {
  /** Database name; by default `prancheta`, or `prancheta-test` in the test build. */
  readonly dbName?: string;
  /** Clock of `savedAt` (the engine has none; this layer may read one). */
  readonly now?: () => Date;
}

const HEX64 = /^[0-9a-f]{64}$/;
const ROUND_KEY = /^[1-9][0-9]*$/;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isWhole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

/** Position of a (season, round) on the career's timeline: one step per round played. */
function roundIndex(season: number, round: number): number {
  return (season - 1) * SEASON_ROUNDS + (Math.min(round, SEASON_ROUNDS + 1) - 1);
}

function errorName(error: unknown): string {
  return error instanceof Error || error instanceof DOMException ? error.name : typeof error;
}

function writeErrorOf(error: unknown): 'quota-exceeded' | 'write-failed' {
  return errorName(error) === 'QuotaExceededError' ? 'quota-exceeded' : 'write-failed';
}

/** A round → SHA-256 index: rounds 1..38 as keys, lowercase hex hashes as values. */
function isSheetIndex(value: unknown): value is Readonly<Record<number, string>> {
  if (!isObject(value)) return false;
  return Object.entries(value).every(
    ([round, hash]) =>
      ROUND_KEY.test(round) &&
      Number(round) <= SEASON_ROUNDS &&
      typeof hash === 'string' &&
      HEX64.test(hash),
  );
}

/** The fields a stored gzip needs before it is decoded. */
function isStoredBlob(
  value: unknown,
): value is Record<string, unknown> & { sha256: string; bytes: number; blob: Bytes } {
  if (!isObject(value)) return false;
  return (
    value.blob instanceof Uint8Array &&
    typeof value.sha256 === 'string' &&
    isWhole(value.bytes) &&
    value.bytes >= 0 &&
    value.bytes <= MAX_SAVE_BYTES
  );
}

function isRecord(value: unknown): value is SnapshotRecord {
  return (
    isStoredBlob(value) &&
    typeof value.schemaVersion === 'number' &&
    isWhole(value.season) &&
    value.season >= 1 &&
    isWhole(value.round) &&
    value.round >= 1 &&
    isSheetIndex(value.sheets)
  );
}

function sameIndex(a: Readonly<Record<number, string>>, b: Readonly<Record<number, string>>) {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((k) => (b as Record<string, string>)[k] === (a as Record<string, string>)[k])
  );
}

/** What was read back is what was meant to be written (the check of step 3, by bytes). */
function sameStored(stored: unknown, meant: { sha256: string; bytes: number; blob: Bytes }) {
  return (
    isStoredBlob(stored) &&
    stored.sha256 === meant.sha256 &&
    stored.bytes === meant.bytes &&
    equalBytes(stored.blob, meant.blob)
  );
}

function summaryOf(save: CareerSave, headSeq: number): CareerSummary {
  return {
    id: save.careerId,
    club: save.game.clubs[save.career.clubId]!.def,
    season: save.game.season,
    round: save.game.round,
    updatedAt: save.updatedAt,
    headSeq,
    schemaVersion: save.schemaVersion,
  };
}

/**
 * The match sheets of `save` by round, through `game.fixtures`; the offending fixture id when a
 * sheet is not of a played match of this season's calendar (a bug of the caller).
 */
function sheetsByRound(
  save: CareerSave,
): Map<number, [string, unknown][]> | { readonly fixtureId: string } {
  const fixtures = new Map<string, Fixture>();
  for (const fixture of save.game.fixtures) fixtures.set(fixture.id, fixture);
  const rounds = new Map<number, [string, unknown][]>();
  for (const [id, sheet] of Object.entries(save.career.matchSheets)) {
    const fixture = fixtures.get(id);
    if (fixture?.result === undefined) return { fixtureId: id };
    const round = rounds.get(fixture.round) ?? [];
    round.push([id, sheet]);
    rounds.set(fixture.round, round);
  }
  return rounds;
}

type WriteTx = IDBPTransaction<
  SaveDbSchema,
  ('careers' | 'snapshots' | 'matchSheets')[],
  'readwrite'
>;

/**
 * A read-write transaction over `careers`, `snapshots` and `matchSheets`, or the error name when
 * the connection cannot start one (closing because another tab upgrades it). Its `done` is always
 * observed.
 */
function begin(db: SaveDb): WriteTx | string {
  try {
    const tx = db.transaction(['careers', 'snapshots', 'matchSheets'], 'readwrite');
    tx.done.catch(() => undefined);
    return tx;
  } catch (error) {
    return errorName(error);
  }
}

function abort(tx: WriteTx): void {
  try {
    tx.abort();
  } catch {
    // Already finished or aborted.
  }
}

/**
 * Issues requests of one transaction and waits for all. A request that throws when issued (the
 * transaction ended) rethrows, and the ones issued before it stay observed: their rejection when
 * the transaction aborts is never unhandled.
 */
function requests(issue: readonly (() => Promise<unknown>)[]): Promise<unknown[]> {
  const pending: Promise<unknown>[] = [];
  for (const request of issue) {
    const promise = request();
    promise.catch(() => undefined);
    pending.push(promise);
  }
  return Promise.all(pending);
}

/** All the snapshots of a career, `[careerId, 0]` to `[careerId, upTo]`. */
function careerRange(careerId: string, upTo = Number.POSITIVE_INFINITY): IDBKeyRange {
  return IDBKeyRange.bound([careerId, 0], [careerId, upTo]);
}

/** The rows of sheets of a career with `season` below `below` (all of them by default). */
function sheetRange(careerId: string, below?: number): IDBKeyRange {
  return below === undefined
    ? IDBKeyRange.bound([careerId], [careerId, Infinity, Infinity])
    : IDBKeyRange.bound([careerId], [careerId, below], false, true);
}

/** The rows of sheets of one season of a career. */
function seasonRange(careerId: string, season: number): IDBKeyRange {
  return IDBKeyRange.bound([careerId, season], [careerId, season, Infinity]);
}

export class SaveStore {
  readonly dbName: string;
  private readonly now: () => Date;
  private db: Promise<SaveDb> | undefined;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(options: SaveStoreOptions = {}) {
    this.dbName = options.dbName ?? SAVE_DB_NAME;
    this.now = options.now ?? (() => new Date());
  }

  /** The careers on the device, the most recently played first (US-034). */
  listCareers(): Promise<SaveResult<CareerSummary[], StorageError>> {
    return this.serial(async () => {
      const db = await this.open();
      if (!db.ok) return db;
      try {
        const all = await db.value.getAll('careers');
        all.sort((a, b) =>
          a.updatedAt === b.updatedAt ? (a.id < b.id ? -1 : 1) : a.updatedAt < b.updatedAt ? 1 : -1,
        );
        return ok(all);
      } catch (error) {
        return fail('read-failed', { name: errorName(error) });
      }
    });
  }

  /**
   * Stores `save` as the newest snapshot of its career, checked, keeping the 3 newest.
   *
   * `base` is the index of the snapshot the save in memory came from (`OpenedCareer.sheets` or
   * `WrittenSnapshot.sheets`): its rounds of the same season are inherited, not written again.
   * Without it (a new career, an import, a migrated save) every round is written. Contract: the
   * sheets of a round already played never change; whoever replaces them writes without `base`.
   */
  writeSnapshot(
    save: CareerSave,
    base?: SheetIndex,
    guard?: WriteGuard,
  ): Promise<SaveResult<WrittenSnapshot, WriteError>> {
    return this.serial(async () => {
      if (
        typeof save.careerId !== 'string' ||
        save.careerId === '' ||
        save.schemaVersion !== SAVE_SCHEMA_VERSION ||
        !isCareerSave(save, save.careerId)
      ) {
        return fail('invalid-save');
      }
      const byRound = sheetsByRound(save);
      if (!(byRound instanceof Map)) return fail('invalid-save', byRound);
      if (!codecSupported()) return fail('unsupported-browser');
      const id = save.careerId;
      const season = save.game.season;

      // (1) Everything encoded before the transaction: IndexedDB ends a transaction that waits
      // on a promise that is not its own.
      const inherited = base !== undefined && base.season === season ? base.rounds : {};
      const index: Record<number, string> = {};
      const missing: number[] = [];
      for (const round of [...byRound.keys()].sort((a, b) => a - b)) {
        const hash = Object.hasOwn(inherited, round) ? inherited[round] : undefined;
        if (typeof hash === 'string' && HEX64.test(hash)) index[round] = hash;
        else missing.push(round);
      }
      // The rounds to write (all 38 without a base) and the snapshot, encoded side by side.
      const [encoded, ...encodedRows] = await Promise.all([
        encodeSave({ ...save, career: { ...save.career, matchSheets: {} } }),
        ...missing.map((round) => encodeSave(Object.fromEntries(byRound.get(round)!))),
      ]);
      if (!encoded.ok) return fail(encoded.error, encoded.detail);
      const rows: MatchSheetRecord[] = [];
      for (const [i, round] of missing.entries()) {
        const row = encodedRows[i]!;
        if (!row.ok) return fail(row.error, { round, ...(row.detail as object) });
        index[round] = row.value.sha256;
        rows.push({
          careerId: id,
          season,
          round,
          sha256: row.value.sha256,
          bytes: row.value.bytes,
          blob: row.value.gzip,
        });
      }

      const db = await this.open();
      if (!db.ok) return db;

      // (2) The snapshot, the new rows and the pointer in one transaction.
      const tx = begin(db.value);
      if (typeof tx === 'string') return fail('write-failed', { name: tx });
      const done = tx.done;
      let previous: CareerSummary | undefined;
      let record: SnapshotRecord | undefined;
      let refused: SaveResult<never, WriteError> | undefined;
      try {
        const careers = tx.objectStore('careers');
        previous = await careers.get(id);
        const headSeq = previous?.headSeq ?? 0;
        if (previous !== undefined && previous.schemaVersion > SAVE_SCHEMA_VERSION) {
          refused = fail('save-too-new', { version: previous.schemaVersion });
        } else if (guard !== undefined && headSeq !== guard.expectedHeadSeq) {
          refused = fail('conflict', { expectedHeadSeq: guard.expectedHeadSeq, headSeq });
        } else if (previous === undefined && (await careers.count()) >= MAX_CAREERS) {
          refused = fail('career-limit', { max: MAX_CAREERS });
        }
        if (refused !== undefined) {
          tx.abort();
        } else {
          record = {
            careerId: id,
            seq: headSeq + 1,
            schemaVersion: save.schemaVersion,
            savedAt: this.now().toISOString(),
            season,
            round: save.game.round,
            sheets: index,
            sha256: encoded.value.sha256,
            bytes: encoded.value.bytes,
            blob: encoded.value.gzip,
          };
          const snapshots = tx.objectStore('snapshots');
          const sheets = tx.objectStore('matchSheets');
          const stored = record;
          await requests([
            () => snapshots.put(stored),
            ...rows.map((row) => () => sheets.put(row)),
          ]);
          await careers.put(summaryOf(save, record.seq));
        }
        await done;
      } catch (error) {
        abort(tx);
        return refused ?? fail(writeErrorOf(error), { name: errorName(error) });
      }
      if (record === undefined) return refused ?? fail('write-failed');
      const seq = record.seq;

      // (3) Read back and compare with what was meant to be written.
      const problem = await this.verify(db.value, record, rows);
      if (problem !== undefined) {
        const rolledBack = await this.rollback(db.value, id, seq, previous);
        return fail('verify-failed', { problem, rolledBack });
      }

      // Only now the older versions go.
      await this.prune(db.value, id, seq, season);
      return ok({
        seq,
        sha256: encoded.value.sha256,
        bytes: encoded.value.bytes,
        storedBytes: encoded.value.gzip.byteLength,
        sheets: { season, rounds: index },
        writtenRounds: rows.map((row) => row.round),
      });
    });
  }

  /** Opens the newest snapshot of `careerId` that passes every check (US-032). */
  openCareer(careerId: string): Promise<SaveResult<OpenedCareer, OpenError>> {
    return this.serial(async () => {
      if (!codecSupported()) return fail('unsupported-browser');
      const db = await this.open();
      if (!db.ok) return db;
      let summary: CareerSummary | undefined;
      let records: unknown[];
      try {
        summary = await db.value.get('careers', careerId);
        records =
          summary === undefined ? [] : await db.value.getAll('snapshots', careerRange(careerId));
      } catch (error) {
        return fail('read-failed', { name: errorName(error) });
      }
      if (summary === undefined) return fail('not-found');

      const skipped: { seq: number; problem: SnapshotProblem }[] = [];
      for (const record of records.reverse()) {
        const seq = (record as { seq?: unknown }).seq;
        const at = typeof seq === 'number' ? seq : -1;
        if (!isRecord(record)) {
          skipped.push({ seq: at, problem: 'invalid-record' });
          continue;
        }
        // Never fall back past a version this build does not know: the newer build owns it.
        if (record.schemaVersion > SAVE_SCHEMA_VERSION) {
          return fail('save-too-new', { version: record.schemaVersion });
        }
        const decoded = await decodeSave(record.blob, record.sha256, record.bytes);
        if (!decoded.ok) {
          if (decoded.error === 'unsupported-browser') return fail(decoded.error);
          skipped.push({ seq: at, problem: decoded.error });
          continue;
        }
        // The sheets go back in before the migration: migrations see the whole save.
        const sheets = await this.readSheets(db.value, careerId, record);
        if (!sheets.ok) return sheets;
        const migrated = migrateSave(withSheets(decoded.value, sheets.value.entries));
        if (!migrated.ok) {
          if (migrated.error === 'save-too-new') return fail('save-too-new', migrated.detail);
          skipped.push({ seq: at, problem: migrated.error });
          continue;
        }
        // (T-044 renames the retired names here, between the migration and the validation.)
        if (!isCareerSave(migrated.value, careerId)) {
          skipped.push({ seq: at, problem: 'incoherent' });
          continue;
        }
        const game = migrated.value.game;
        const lost =
          roundIndex(summary.season, summary.round) - roundIndex(game.season, game.round);
        return ok({
          save: migrated.value,
          seq: at,
          headSeq: summary.headSeq,
          skipped,
          roundsLost: Math.max(0, lost),
          fromVersion: record.schemaVersion,
          sheets: { season: record.season, rounds: sheets.value.rounds },
          missingSheetRounds: sheets.value.missing,
        });
      }
      return fail('all-corrupt', { snapshots: records.length, skipped });
    });
  }

  /**
   * Removes a career, all its snapshots and its rows of sheets, in one transaction (US-034; the
   * double confirmation is the screen's).
   */
  deleteCareer(careerId: string): Promise<SaveResult<void, StorageError | 'write-failed'>> {
    return this.serial(async () => {
      const db = await this.open();
      if (!db.ok) return db;
      const tx = begin(db.value);
      if (typeof tx === 'string') return fail('write-failed', { name: tx });
      const done = tx.done;
      try {
        await requests([
          () => tx.objectStore('careers').delete(careerId),
          () => tx.objectStore('snapshots').delete(careerRange(careerId)),
          () => tx.objectStore('matchSheets').delete(sheetRange(careerId)),
        ]);
        await done;
        return ok(undefined);
      } catch (error) {
        abort(tx);
        return fail('write-failed', { name: errorName(error) });
      }
    });
  }

  /** A value of the `kv` store (preferences, last new-game setup...), or `undefined`. */
  readKv(key: string): Promise<SaveResult<unknown, StorageError>> {
    return this.serial(async () => {
      const db = await this.open();
      if (!db.ok) return db;
      try {
        return ok((await db.value.get('kv', key))?.value);
      } catch (error) {
        return fail('read-failed', { name: errorName(error) });
      }
    });
  }

  writeKv(
    key: string,
    value: unknown,
  ): Promise<SaveResult<void, StorageError | 'quota-exceeded' | 'write-failed'>> {
    return this.serial(async () => {
      const db = await this.open();
      if (!db.ok) return db;
      try {
        await db.value.put('kv', { key, value });
        return ok(undefined);
      } catch (error) {
        return fail(writeErrorOf(error), { name: errorName(error) });
      }
    });
  }

  /** Closes the connection; the next operation opens it again. */
  async close(): Promise<void> {
    const db = this.db;
    this.db = undefined;
    if (db !== undefined) (await db.catch(() => undefined))?.close();
  }

  /**
   * Step 3 of the safe write: the snapshot and the new rows read back, in one read-only
   * transaction, and compared with what was in memory. `undefined` when everything matches.
   */
  private async verify(
    db: SaveDb,
    record: SnapshotRecord,
    rows: readonly MatchSheetRecord[],
  ): Promise<'mismatch' | 'read-failed' | undefined> {
    let stored: unknown;
    let storedRows: unknown[];
    try {
      const tx = db.transaction(['snapshots', 'matchSheets']);
      tx.done.catch(() => undefined);
      const sheets = tx.objectStore('matchSheets');
      [stored, ...storedRows] = await requests([
        () => tx.objectStore('snapshots').get([record.careerId, record.seq]),
        ...rows.map((row) => () => sheets.get([row.careerId, row.season, row.round])),
      ]);
    } catch {
      return 'read-failed';
    }
    const snapshotOk =
      isRecord(stored) &&
      sameStored(stored, record) &&
      stored.season === record.season &&
      stored.round === record.round &&
      sameIndex(stored.sheets, record.sheets);
    return snapshotOk && rows.every((row, i) => sameStored(storedRows[i], row))
      ? undefined
      : 'mismatch';
  }

  /**
   * Undoes a write whose check failed: the new snapshot goes and, if it is still the head (no other
   * tab wrote after it), the pointer returns. `false` when the removal itself failed.
   */
  private async rollback(
    db: SaveDb,
    id: string,
    seq: number,
    previous: CareerSummary | undefined,
  ): Promise<boolean> {
    const tx = begin(db);
    if (typeof tx === 'string') return false;
    const done = tx.done;
    try {
      const careers = tx.objectStore('careers');
      await tx.objectStore('snapshots').delete([id, seq]);
      const current = await careers.get(id);
      if (current?.headSeq === seq) {
        if (previous === undefined) await careers.delete(id);
        else await careers.put(previous);
      }
      await done;
      return true;
    } catch {
      abort(tx);
      // The head stays the bad snapshot; opening skips it and falls back (US-032).
      return false;
    }
  }

  /**
   * After the check: the snapshots past the 3 newest, then the rows of the seasons older than every
   * kept snapshot. A failure leaves extra data, never less: the next write prunes again.
   */
  private async prune(db: SaveDb, id: string, seq: number, season: number): Promise<void> {
    if (seq > KEPT_SNAPSHOTS) {
      try {
        await db.delete('snapshots', careerRange(id, seq - KEPT_SNAPSHOTS));
      } catch {
        // Kept for the next write.
      }
    }
    try {
      // Mid-season there is nothing older: a key count, and no snapshot is read.
      if ((await db.count('matchSheets', sheetRange(id, season))) === 0) return;
      // The lowest season among the kept snapshots (after a fallback, a newer `seq` may be of an
      // older season than the oldest kept one).
      let lowest = season;
      for (const kept of await db.getAll('snapshots', careerRange(id))) {
        if (!isRecord(kept)) return;
        lowest = Math.min(lowest, kept.season);
      }
      await db.delete('matchSheets', sheetRange(id, lowest));
    } catch {
      // Kept for the next write.
    }
  }

  /**
   * The rows of sheets listed by a snapshot's index, each checked (hash of the index, size, hash
   * of the JSON, parse). A bad or missing row is reported, never fatal.
   */
  private async readSheets(
    db: SaveDb,
    careerId: string,
    record: SnapshotRecord,
  ): Promise<
    SaveResult<
      { entries: [string, unknown][]; rounds: Record<number, string>; missing: number[] },
      'read-failed'
    >
  > {
    const listed = Object.keys(record.sheets)
      .map(Number)
      .sort((a, b) => a - b);
    const found = new Map<number, unknown>();
    if (listed.length > 0) {
      try {
        for (const row of await db.getAll('matchSheets', seasonRange(careerId, record.season))) {
          found.set((row as { round?: unknown }).round as number, row);
        }
      } catch (error) {
        return fail('read-failed', { name: errorName(error) });
      }
    }
    const decoded = await Promise.all(
      listed.map(async (round) => {
        const row = found.get(round);
        const hash = record.sheets[round];
        if (!isStoredBlob(row) || row.sha256 !== hash) return undefined;
        const value = await decodeSave(row.blob, row.sha256, row.bytes);
        return value.ok && isObject(value.value) ? value.value : undefined;
      }),
    );
    const entries: [string, unknown][] = [];
    const rounds: Record<number, string> = {};
    const missing: number[] = [];
    listed.forEach((round, i) => {
      const sheets = decoded[i];
      if (sheets === undefined) {
        missing.push(round);
        return;
      }
      entries.push(...Object.entries(sheets));
      rounds[round] = record.sheets[round]!;
    });
    return ok({ entries, rounds, missing });
  }

  private async open(): Promise<SaveResult<SaveDb, 'storage-unavailable' | 'app-outdated'>> {
    try {
      // `indexedDB.open` may also throw at once (no IndexedDB, storage disabled).
      this.db ??= openSaveDb(this.dbName, (closed) => {
        // Only the connection that closed: a newer one may already be in use.
        if (this.db === closed) this.db = undefined;
      });
      return ok(await this.db);
    } catch (error) {
      this.db = undefined;
      const name = errorName(error);
      return fail(name === 'VersionError' ? 'app-outdated' : 'storage-unavailable', { name });
    }
  }

  private serial<T>(run: () => Promise<T>): Promise<T> {
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }
}

/** The decoded snapshot with the rows of sheets back in `career.matchSheets`. */
function withSheets(value: unknown, entries: readonly [string, unknown][]): unknown {
  if (!isObject(value) || !isObject(value.career)) return value;
  const own = isObject(value.career.matchSheets) ? Object.entries(value.career.matchSheets) : [];
  // `Object.fromEntries` defines own properties: an id such as "__proto__" stays a plain key.
  return {
    ...value,
    career: { ...value.career, matchSheets: Object.fromEntries([...own, ...entries]) },
  };
}
