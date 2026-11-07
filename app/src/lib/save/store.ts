import type { IDBPTransaction } from 'idb';
import { SEASON_ROUNDS, type Fixture } from '../../engine/index.ts';
import {
  codecSupported,
  decodeJson,
  decodeSave,
  encodeJson,
  encodeSave,
  equalBytes,
  type Bytes,
  type DecodeError,
} from './codec.ts';
import {
  SAVE_DB_NAME,
  openSaveDb,
  type ErrorRecord,
  type SaveDb,
  type SaveDbSchema,
} from './db.ts';
import {
  MIGRATIONS,
  migrateSave,
  schemaVersionOf,
  type Migration,
  type MigrationError,
} from './migrations/index.ts';
import { stageEnd, stageStart } from './probe.ts';
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
import {
  errorPath,
  hasForbiddenKey,
  parseCareerSave,
  parseRoundSheets,
  type SaveIssue,
} from './validate.ts';

/*
 * Careers on the device (docs/02-architecture.md, 4.2; ADR-0006, ADR-0019; US-032, US-034).
 *
 * Safe write: (1) before any transaction, serialise and hash the save with `career.matchSheets:
 * {}` (stored as its UTF-8 JSON, without gzip: ADR-0006, note of T-072), and serialise, hash and
 * gzip each round of match sheets that the `base` index does not have (normally only the round
 * just played); (2) in one transaction over `careers`, `snapshots` and `matchSheets`, store
 * `seq = headSeq + 1`, the new rows of sheets, and move `headSeq` (atomic: if the app closes
 * halfway, nothing changes); (3) read the snapshot and the new rows back and compare `sha256`,
 * `bytes` and the stored bytes one by one with what was in memory, without decompressing. Only
 * then the snapshots past the 3 newest go, and after them the rows of the seasons that no kept
 * snapshot uses; if the check fails, the new snapshot goes instead, `headSeq` returns and every
 * row this write replaced with other content gets its old one back (T-019). A row is keyed
 * `[careerId, season, round]` and each snapshot only accepts the rows its index lists, by hash, so
 * a wrong sheet never opens. With `base` nothing is lost: only rounds the previous snapshot does
 * not list get a row. Without `base` on a career already stored (the migrated save of T-019),
 * every round's row is rewritten, also the ones the older snapshots list: where the content
 * changed and the write is checked, those snapshots no longer accept the row, and the sheets of
 * those rounds become unavailable in them (`missingSheetRounds` if they ever open). This accepted
 * limit is in docs/02-architecture.md, 4.2, "Gravação sem `base` numa carreira que já existe".
 *
 * Open with fallback: the snapshots from the newest to the oldest; the first that passes size,
 * hash and parse has its rows of sheets put back in `career.matchSheets`, then goes through the
 * migration and the strict schema (validate.ts: `open` for the current format, whose rows were
 * checked when written; `full` for a migrated save). A bad or missing row never skips the
 * snapshot: the round is reported in `missingSheetRounds`. The result says how many rounds were
 * lost. A save written by a newer build is never opened nor changed. When every snapshot fails
 * the career stays listed and the error says so (the game offers to import, US-036).
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
  /**
   * Not a save of the current format (validate.ts, `write` check, and every new row of sheets in
   * full), or a sheet of a match not played: a bug of the caller. `detail` has the path, never
   * the value.
   */
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
export type SnapshotProblem = DecodeError | MigrationError | 'invalid-record' | 'invalid-save';

/**
 * A snapshot skipped when opening. An `invalid-save` one also says which format it had before the
 * migration (`fromVersion`) and the path and kind of its first problem (`issue`, never the value):
 * a snapshot of the current format that fails the schema is a bug of the build that wrote it, and
 * the `CareerService` records it as a programming error (4.2, "Níveis de conferência do esquema",
 * condition 2).
 */
export type SkippedSnapshot =
  | { readonly seq: number; readonly problem: Exclude<SnapshotProblem, 'invalid-save'> }
  | {
      readonly seq: number;
      readonly problem: 'invalid-save';
      readonly fromVersion: number;
      readonly issue: SaveIssue;
    };

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
  /** JSON bytes and stored bytes of the snapshot, sheets apart (the same: no gzip, T-072). */
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
  readonly skipped: readonly SkippedSnapshot[];
  /** Rounds played after the opened snapshot that were lost with the skipped ones (US-032). */
  readonly roundsLost: number;
  /**
   * The `schemaVersion` the snapshot had before migration. When it is older than the current one,
   * the caller writes the migrated save as a new snapshot (`writeSnapshot` with `sheets` below as
   * `base` and the `headSeq` guard), which keeps the original until the new one is checked.
   */
  readonly fromVersion: number;
  /**
   * The rows of sheets put back in `career.matchSheets`: the `base` of the next write. Empty after
   * a migration, so that write stores every round again in the current format (4.2, "Migração").
   */
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
  /** The migration chain; tests replace it with a synthetic one (T-019). */
  readonly migrations?: readonly Migration[];
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

/** The path and kind of a `parseCareerSave` failure (its `detail`), never a value. */
function issueIn(detail: unknown): SaveIssue {
  return isObject(detail) && typeof detail.path === 'string' && typeof detail.problem === 'string'
    ? { path: detail.path, problem: detail.problem }
    : { path: '', problem: 'unknown' };
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

/** The fields stored bytes (a snapshot's JSON, a row's gzip) need before they are decoded. */
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
function sheetsByRound(save: CareerSave): Map<number, [string, unknown][]> | SaveIssue {
  const fixtures = new Map<string, Fixture>();
  for (const fixture of save.game.fixtures) fixtures.set(fixture.id, fixture);
  const rounds = new Map<number, [string, unknown][]>();
  for (const [id, sheet] of Object.entries(save.career.matchSheets)) {
    const fixture = fixtures.get(id);
    if (fixture?.result === undefined) {
      return { path: errorPath(['career', 'matchSheets', id]), problem: 'unknown-fixture' };
    }
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

/** The `bySeason` keys of a career's snapshots with a numeric season. */
function seasonKeys(careerId: string): IDBKeyRange {
  return IDBKeyRange.bound([careerId, -Infinity], [careerId, Infinity]);
}

/**
 * The lowest season among the kept snapshots of a career, when it has rows of sheets of a season
 * older than `season` (the new snapshot's) to prune; `undefined` when there is nothing to prune
 * now. Read from keys only, in one read-only transaction: no snapshot value is read (T-072; 4.2,
 * "Virada e poda"). The lowest, not the season of the lowest `seq`: after a fallback a newer `seq`
 * may be of an older season. When a kept record is not in the index (no valid `season`) or its
 * season is not whole, the prune of the rows waits for a later write; an invalid record with a
 * valid season counts, which only prunes less.
 */
async function lowestKeptSeason(
  db: SaveDb,
  careerId: string,
  season: number,
): Promise<number | undefined> {
  const tx = db.transaction(['snapshots', 'matchSheets']);
  tx.done.catch(() => undefined);
  // Mid-season there is nothing older: a key count, and the prune ends here.
  if ((await tx.objectStore('matchSheets').count(sheetRange(careerId, season))) === 0) return;
  const snapshots = tx.objectStore('snapshots');
  const bySeason = snapshots.index('bySeason');
  const [inStore, inIndex, first] = (await requests([
    () => snapshots.count(careerRange(careerId)),
    () => bySeason.count(seasonKeys(careerId)),
    () => bySeason.openKeyCursor(seasonKeys(careerId)),
  ])) as [number, number, { key: [string, number] } | null];
  if (inStore !== inIndex || first === null) return;
  const lowest = first.key[1];
  return Number.isInteger(lowest) ? Math.min(lowest, season) : undefined;
}

/** The rows of sheets of one season of a career. */
function seasonRange(careerId: string, season: number): IDBKeyRange {
  return IDBKeyRange.bound([careerId, season], [careerId, season, Infinity]);
}

export class SaveStore {
  readonly dbName: string;
  private readonly now: () => Date;
  private readonly migrations: readonly Migration[];
  private db: Promise<SaveDb> | undefined;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(options: SaveStoreOptions = {}) {
    this.dbName = options.dbName ?? SAVE_DB_NAME;
    this.now = options.now ?? (() => new Date());
    this.migrations = options.migrations ?? MIGRATIONS;
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
   * A row replaced with other content is kept in memory and put back if the check fails.
   */
  writeSnapshot(
    save: CareerSave,
    base?: SheetIndex,
    guard?: WriteGuard,
  ): Promise<SaveResult<WrittenSnapshot, WriteError>> {
    return this.serial(async () => {
      let start = stageStart();
      const checked = parseCareerSave(save, { check: 'write' });
      if (!checked.ok) return checked;
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
      // Every row written is checked in full: opening trusts a row by its hash (validate.ts).
      for (const round of missing) {
        const sheets = parseRoundSheets(Object.fromEntries(byRound.get(round)!));
        if (!sheets.ok) return fail('invalid-save', { round, ...(sheets.detail as object) });
      }
      stageEnd('schema', start);
      // The rounds to write (every round played without a base) and the snapshot, encoded side by
      // side. Without a base on a stored career the rows of the older snapshots are overwritten:
      // their changed rounds lose the sheets (see the top of this file; 4.2, T-019, T-020).
      start = stageStart();
      const [encoded, ...encodedRows] = await Promise.all([
        encodeJson({ ...save, career: { ...save.career, matchSheets: {} } }),
        ...missing.map((round) => encodeSave(Object.fromEntries(byRound.get(round)!))),
      ]);
      stageEnd('encode', start);
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
      start = stageStart();
      const tx = begin(db.value);
      if (typeof tx === 'string') return fail('write-failed', { name: tx });
      const done = tx.done;
      let previous: CareerSummary | undefined;
      let record: SnapshotRecord | undefined;
      // The rows this write replaces with other content, to put back if the check fails.
      let replaced: MatchSheetRecord[] = [];
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
            blob: encoded.value.json,
          };
          const snapshots = tx.objectStore('snapshots');
          const sheets = tx.objectStore('matchSheets');
          const stored = record;
          // Only a write that inherits nothing (no `base`, an empty one as after a migration, or
          // one of another season) rewrites rows that older snapshots may list; otherwise the
          // rows written are rounds the previous snapshot does not have.
          if (Object.keys(inherited).length === 0) {
            const existing = await requests(
              rows.map((row) => () => sheets.get([row.careerId, row.season, row.round])),
            );
            replaced = existing.filter(
              (old, i): old is MatchSheetRecord =>
                isStoredBlob(old) && old.sha256 !== rows[i]!.sha256,
            );
          }
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
      stageEnd('transaction', start);
      const seq = record.seq;

      // (3) Read back and compare with what was meant to be written.
      start = stageStart();
      const problem = await this.verify(db.value, record, rows);
      stageEnd('verify', start);
      if (problem !== undefined) {
        const rolledBack = await this.rollback(db.value, id, seq, previous, rows, replaced);
        return fail('verify-failed', { problem, rolledBack });
      }

      // Only now the older versions go.
      start = stageStart();
      await this.prune(db.value, id, seq, season);
      stageEnd('prune', start);
      return ok({
        seq,
        sha256: encoded.value.sha256,
        bytes: encoded.value.bytes,
        storedBytes: encoded.value.json.byteLength,
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

      const skipped: SkippedSnapshot[] = [];
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
        const decoded = await decodeJson(record.blob, record.sha256, record.bytes);
        if (!decoded.ok) {
          if (decoded.error === 'unsupported-browser') return fail(decoded.error);
          skipped.push({ seq: at, problem: decoded.error });
          continue;
        }
        // The sheets go back in before the migration: migrations see the whole save.
        const sheets = await this.readSheets(db.value, careerId, record);
        if (!sheets.ok) return sheets;
        const whole = withSheets(decoded.value, sheets.value.entries);
        const fromVersion = schemaVersionOf(decoded.value) ?? record.schemaVersion;
        // Newer than this build (the JSON may say so even when the record does not): never fall
        // back past it, before any other check.
        if (fromVersion > SAVE_SCHEMA_VERSION) {
          return fail('save-too-new', { version: fromVersion });
        }
        const current = fromVersion === SAVE_SCHEMA_VERSION;
        // An older save is read in full; its prototype keys are refused before the steps run
        // (they copy with spread, but a key never reaches them; security review L4).
        if (!current && hasForbiddenKey(whole)) {
          const issue: SaveIssue = { path: '', problem: 'forbidden-key' };
          skipped.push({ seq: at, problem: 'invalid-save', fromVersion, issue });
          continue;
        }
        const migrated = migrateSave(whole, this.migrations);
        if (!migrated.ok) {
          if (migrated.error === 'save-too-new') return fail('save-too-new', migrated.detail);
          skipped.push({ seq: at, problem: migrated.error });
          continue;
        }
        // (T-044 renames the retired names here, between the migration and the validation.)
        // A save of the current format trusts its rows of sheets by their hashes (they were
        // checked when written); a migrated one is checked in full.
        const valid = parseCareerSave(migrated.value, {
          careerId,
          check: current ? 'open' : 'full',
        });
        if (!valid.ok) {
          skipped.push({
            seq: at,
            problem: 'invalid-save',
            fromVersion,
            issue: issueIn(valid.detail),
          });
          continue;
        }
        const game = valid.value.game;
        const lost =
          roundIndex(summary.season, summary.round) - roundIndex(game.season, game.round);
        return ok({
          save: valid.value,
          seq: at,
          headSeq: summary.headSeq,
          skipped,
          roundsLost: Math.max(0, lost),
          fromVersion,
          sheets: { season: record.season, rounds: current ? sheets.value.rounds : {} },
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

  /**
   * Appends a row to the `errors` store and drops the oldest past `keep`, in one transaction (the
   * ring of US-045). What goes in is the caller's: lib/errors builds rows without personal data.
   */
  appendError(
    entry: Omit<ErrorRecord, 'id'>,
    keep: number,
  ): Promise<SaveResult<void, StorageError | 'quota-exceeded' | 'write-failed'>> {
    return this.serial(async () => {
      const db = await this.open();
      if (!db.ok) return db;
      try {
        const tx = db.value.transaction('errors', 'readwrite');
        tx.done.catch(() => undefined);
        const errors = tx.objectStore('errors');
        await errors.add(entry as ErrorRecord);
        const excess = (await errors.count()) - Math.max(0, keep);
        if (excess > 0) {
          const oldest = await errors.getAllKeys(undefined, excess);
          const last = oldest[oldest.length - 1];
          if (last !== undefined) await errors.delete(IDBKeyRange.upperBound(last));
        }
        await tx.done;
        return ok(undefined);
      } catch (error) {
        return fail(writeErrorOf(error), { name: errorName(error) });
      }
    });
  }

  /** The rows of the `errors` store, the oldest first. */
  listErrors(): Promise<SaveResult<ErrorRecord[], StorageError>> {
    return this.serial(async () => {
      const db = await this.open();
      if (!db.ok) return db;
      try {
        return ok(await db.value.getAll('errors'));
      } catch (error) {
        return fail('read-failed', { name: errorName(error) });
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
   * Undoes a write whose check failed, in one transaction: the new snapshot goes; if it is still
   * the head (no other tab wrote after it), the pointer returns; and each row it replaced with
   * other content gets the old one back, if the key still holds the new row (by its SHA-256:
   * another tab may have written after). `false` when the undo itself failed.
   */
  private async rollback(
    db: SaveDb,
    id: string,
    seq: number,
    previous: CareerSummary | undefined,
    rows: readonly MatchSheetRecord[],
    replaced: readonly MatchSheetRecord[],
  ): Promise<boolean> {
    const tx = begin(db);
    if (typeof tx === 'string') return false;
    const done = tx.done;
    try {
      const careers = tx.objectStore('careers');
      const sheets = tx.objectStore('matchSheets');
      await tx.objectStore('snapshots').delete([id, seq]);
      const current = await careers.get(id);
      if (current?.headSeq === seq) {
        if (previous === undefined) await careers.delete(id);
        else await careers.put(previous);
      }
      const written = new Map(rows.map((row) => [row.round, row.sha256]));
      const now = await requests(
        replaced.map((old) => () => sheets.get([old.careerId, old.season, old.round])),
      );
      await requests(
        replaced
          .filter((old, i) => isStoredBlob(now[i]) && now[i].sha256 === written.get(old.round))
          .map((old) => () => sheets.put(old)),
      );
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
      const lowest = await lowestKeptSeason(db, id, season);
      if (lowest !== undefined) await db.delete('matchSheets', sheetRange(id, lowest));
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
