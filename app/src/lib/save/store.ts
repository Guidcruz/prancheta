import { SEASON_ROUNDS } from '../../engine/index.ts';
import { isCareerSave } from './check.ts';
import { decodeSave, encodeSave, type DecodeError } from './codec.ts';
import type { IDBPTransaction } from 'idb';
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
  type SnapshotRecord,
} from './schema.ts';

/*
 * Careers on the device (docs/02-architecture.md, 4.2; ADR-0006; US-032, US-034).
 *
 * Safe write: (1) serialise, hash and gzip; (2) in one transaction over `snapshots` and `careers`,
 * store `seq = headSeq + 1` and move `headSeq` (atomic: if the app closes halfway, nothing
 * changes); (3) read the snapshot back, decompress it and check the hash. Only then the snapshots
 * past the 3 newest go; if the check fails, the new one goes instead and `headSeq` returns.
 *
 * Open with fallback: the snapshots from the newest to the oldest; the first that passes size,
 * hash, parse, migration and the coherence check wins, and the result says how many rounds were
 * lost. A save written by a newer build is never opened nor changed. When every snapshot fails the
 * career stays listed and the error says so (the game offers to import, US-036).
 *
 * Every operation of one store runs in order, one at a time, so a double tap never interleaves two
 * writes of the same career. Nothing here throws for a storage situation: it returns a code.
 */

/** IndexedDB could not be opened, or a read failed. */
export type StorageError = 'storage-unavailable' | 'read-failed';

export type WriteError =
  | StorageError
  /** The device has no room: nothing changed, the previous snapshot is intact. */
  | 'quota-exceeded'
  /** The transaction failed for another reason: nothing changed. */
  | 'write-failed'
  /** The stored snapshot did not read back equal: it was removed, the previous one is the head. */
  | 'verify-failed'
  /** A new career beyond {@link MAX_CAREERS}. */
  | 'career-limit'
  /** The career was last written by a newer build: never overwritten (US-033). */
  | 'save-too-new'
  /** Not a save of the current format (a programming error of the caller). */
  | 'invalid-save';

export type OpenError =
  | StorageError
  | 'not-found'
  /** Written by a newer build of the game: not opened and not changed (US-033). */
  | 'save-too-new'
  /** No snapshot passed the checks; the career stays listed (US-032). */
  | 'all-corrupt';

/** Why one snapshot was skipped when opening (diagnostics, no content). */
export type SnapshotProblem = DecodeError | MigrationError | 'invalid-record' | 'incoherent';

export interface WrittenSnapshot {
  readonly seq: number;
  readonly sha256: string;
  /** JSON bytes and stored (gzip) bytes. */
  readonly bytes: number;
  readonly storedBytes: number;
}

export interface OpenedCareer {
  readonly save: CareerSave;
  /** `seq` of the snapshot that opened. */
  readonly seq: number;
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
}

export interface SaveStoreOptions {
  /** Database name; by default `prancheta`, or `prancheta-test` in the test build. */
  readonly dbName?: string;
  /** Clock of `savedAt` (the engine has none; this layer may read one). */
  readonly now?: () => Date;
}

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

function isRecord(value: unknown): value is SnapshotRecord {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Partial<SnapshotRecord>;
  return (
    r.blob instanceof Uint8Array &&
    typeof r.sha256 === 'string' &&
    typeof r.schemaVersion === 'number' &&
    Number.isInteger(r.bytes) &&
    r.bytes! >= 0 &&
    r.bytes! <= MAX_SAVE_BYTES
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

type WriteTx = IDBPTransaction<SaveDbSchema, ('careers' | 'snapshots')[], 'readwrite'>;

/**
 * A read-write transaction over `careers` and `snapshots`, or the error name when the connection
 * cannot start one (closing because another tab upgrades it). Its `done` is always observed.
 */
function begin(db: SaveDb): WriteTx | string {
  try {
    const tx = db.transaction(['careers', 'snapshots'], 'readwrite');
    tx.done.catch(() => undefined);
    return tx;
  } catch (error) {
    return errorName(error);
  }
}

/** All the snapshots of a career, `[careerId, 0]` to `[careerId, +∞]`. */
function careerRange(careerId: string, upTo = Number.POSITIVE_INFINITY): IDBKeyRange {
  return IDBKeyRange.bound([careerId, 0], [careerId, upTo]);
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

  /** Stores `save` as the newest snapshot of its career, checked, keeping the 3 newest. */
  writeSnapshot(save: CareerSave): Promise<SaveResult<WrittenSnapshot, WriteError>> {
    return this.serial(async () => {
      if (
        typeof save.careerId !== 'string' ||
        save.careerId === '' ||
        save.schemaVersion !== SAVE_SCHEMA_VERSION ||
        !isCareerSave(save, save.careerId)
      ) {
        return fail('invalid-save');
      }
      const db = await this.open();
      if (!db.ok) return db;
      const id = save.careerId;
      const encoded = await encodeSave(save);

      // (2) The snapshot and the pointer in one transaction.
      const tx = begin(db.value);
      if (typeof tx === 'string') return fail('write-failed', { name: tx });
      const done = tx.done;
      let previous: CareerSummary | undefined;
      let seq = 0;
      let refused: 'career-limit' | 'save-too-new' | undefined;
      try {
        const careers = tx.objectStore('careers');
        previous = await careers.get(id);
        if (previous !== undefined && previous.schemaVersion > SAVE_SCHEMA_VERSION) {
          refused = 'save-too-new';
          tx.abort();
        } else if (previous === undefined && (await careers.count()) >= MAX_CAREERS) {
          refused = 'career-limit';
          tx.abort();
        } else {
          seq = (previous?.headSeq ?? 0) + 1;
          await tx.objectStore('snapshots').put({
            careerId: id,
            seq,
            schemaVersion: save.schemaVersion,
            savedAt: this.now().toISOString(),
            sha256: encoded.sha256,
            bytes: encoded.bytes,
            blob: encoded.gzip,
          });
          await careers.put(summaryOf(save, seq));
        }
        await done;
      } catch (error) {
        try {
          tx.abort();
        } catch {
          // Already finished or aborted.
        }
        if (refused === 'career-limit') return fail(refused, { max: MAX_CAREERS });
        if (refused === 'save-too-new') return fail(refused, { version: previous?.schemaVersion });
        return fail(writeErrorOf(error), { name: errorName(error) });
      }

      // (3) Read back and check against what was meant to be written.
      let check: SaveResult<unknown, DecodeError | 'read-failed'>;
      try {
        const stored = await db.value.get('snapshots', [id, seq]);
        check =
          stored !== undefined && isRecord(stored) && stored.sha256 === encoded.sha256
            ? await decodeSave(stored.blob, encoded.sha256, encoded.bytes)
            : fail('hash-mismatch');
      } catch (error) {
        check = fail('read-failed', { name: errorName(error) });
      }
      if (!check.ok) {
        await this.rollback(db.value, id, seq, previous);
        return fail('verify-failed', { problem: check.error });
      }

      // Only now the older versions go. A failure here leaves extra versions, never fewer: the
      // next write prunes them.
      if (seq > KEPT_SNAPSHOTS) {
        try {
          await db.value.delete('snapshots', careerRange(id, seq - KEPT_SNAPSHOTS));
        } catch {
          // Kept for the next write.
        }
      }
      return ok({
        seq,
        sha256: encoded.sha256,
        bytes: encoded.bytes,
        storedBytes: encoded.gzip.byteLength,
      });
    });
  }

  /** Opens the newest snapshot of `careerId` that passes every check (US-032). */
  openCareer(careerId: string): Promise<SaveResult<OpenedCareer, OpenError>> {
    return this.serial(async () => {
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
          skipped.push({ seq: at, problem: decoded.error });
          continue;
        }
        const migrated = migrateSave(decoded.value);
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
          skipped,
          roundsLost: Math.max(0, lost),
          fromVersion: record.schemaVersion,
        });
      }
      return fail('all-corrupt', { snapshots: records.length, skipped });
    });
  }

  /** Removes a career and all its snapshots (US-034; the double confirmation is the screen's). */
  deleteCareer(careerId: string): Promise<SaveResult<void, StorageError | 'write-failed'>> {
    return this.serial(async () => {
      const db = await this.open();
      if (!db.ok) return db;
      const tx = begin(db.value);
      if (typeof tx === 'string') return fail('write-failed', { name: tx });
      const done = tx.done;
      try {
        await tx.objectStore('careers').delete(careerId);
        await tx.objectStore('snapshots').delete(careerRange(careerId));
        await done;
        return ok(undefined);
      } catch (error) {
        try {
          tx.abort();
        } catch {
          // Already finished or aborted.
        }
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

  /** Undoes a write whose check failed: the new snapshot goes, the pointer returns. */
  private async rollback(
    db: SaveDb,
    id: string,
    seq: number,
    previous: CareerSummary | undefined,
  ): Promise<void> {
    const tx = begin(db);
    if (typeof tx === 'string') return;
    const done = tx.done;
    try {
      await tx.objectStore('snapshots').delete([id, seq]);
      const careers = tx.objectStore('careers');
      if (previous === undefined) await careers.delete(id);
      else await careers.put(previous);
      await done;
    } catch {
      // The head stays the bad snapshot; opening skips it and falls back (US-032).
    }
  }

  private async open(): Promise<SaveResult<SaveDb, 'storage-unavailable'>> {
    try {
      // `indexedDB.open` may also throw at once (no IndexedDB, storage disabled).
      this.db ??= openSaveDb(this.dbName, () => {
        this.db = undefined;
      });
      return ok(await this.db);
    } catch (error) {
      this.db = undefined;
      return fail('storage-unavailable', { name: errorName(error) });
    }
  }

  private serial<T>(run: () => Promise<T>): Promise<T> {
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }
}
