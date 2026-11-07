import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CareerRecord, MatchSheetRecord, SnapshotRecord } from './schema.ts';

/*
 * The IndexedDB of the saves (docs/02-architecture.md, 4.2; ADR-0006). Only app/src/lib/save/
 * opens it: any other direct access is a BLOCKER in review. The structure version of the
 * database (`SAVE_DB_VERSION`) is independent of the save format (`SAVE_SCHEMA_VERSION`).
 */

/**
 * Structure version: 1 has `careers`, `snapshots` (with the index `bySeason`), `matchSheets`, `kv`
 * and `errors` (the `matchSheets` store came with T-018 and the index with T-072, still in version
 * 1: no database existed outside the tests before them). The coach's sheet between rounds (T-075,
 * ADR-0021) is an optional field of the `careers` row, without an index: still version 1. Etapa 1b
 * adds `leagueCache` in version 2.
 */
export const SAVE_DB_VERSION = 1;

/** A row of the `kv` store. */
export interface KvRecord {
  readonly key: string;
  readonly value: unknown;
}

/**
 * A row of the `errors` store: lib/errors builds it without personal data and
 * `SaveStore.appendError` keeps the ring of 50 of US-045 (T-023).
 */
export interface ErrorRecord {
  readonly id?: number;
  readonly [field: string]: unknown;
}

export interface SaveDbSchema extends DBSchema {
  /** The summary of each career and, between rounds, the coach's sheet (ADR-0021). */
  careers: { key: string; value: CareerRecord };
  snapshots: {
    key: [string, number];
    value: SnapshotRecord;
    /**
     * `[careerId, season]` of each snapshot (not unique): the prune finds the lowest season kept
     * by the keys alone, never reading a snapshot (T-072). A record without a valid key there
     * (no `season`, say) is not in the index.
     */
    indexes: { bySeason: [string, number] };
  };
  matchSheets: { key: [string, number, number]; value: MatchSheetRecord };
  kv: { key: string; value: KvRecord };
  errors: { key: number; value: ErrorRecord };
}

export type SaveDb = IDBPDatabase<SaveDbSchema>;

/**
 * The database of this build: `prancheta`, or `prancheta-test` in the build made with
 * `PRANCHETA_ENV=test` (docs/03-test-plan.md, 3). Written as one inline comparison on purpose: in
 * the game build `__PRANCHETA_ENV__` becomes `''`, the minifier folds the expression and the test
 * name never reaches the bundle (the production check of the test plan, item 3, looks for it).
 * Where nothing replaced the constant (Node scripts) it is the game name.
 */
export const SAVE_DB_NAME: string =
  typeof __PRANCHETA_ENV__ === 'string' && __PRANCHETA_ENV__ === 'test'
    ? 'prancheta-test'
    : 'prancheta';

/**
 * The same choice for any environment, for tests and tools only: the game reads
 * {@link SAVE_DB_NAME}, so this function (and its literals) stays out of the game bundle.
 */
export function saveDbNameFor(env: string | undefined): 'prancheta' | 'prancheta-test' {
  return env === 'test' ? 'prancheta-test' : 'prancheta';
}

/**
 * Opens (creating or upgrading) the database. Throws what IndexedDB throws when it is not
 * available (private mode of some browsers, storage disabled); the store turns it into
 * `storage-unavailable` (or `app-outdated` for a newer structure). `onClosed` runs when this
 * connection closes because another tab opens a newer structure, or because the browser ended it:
 * the caller opens again on its next access, and drops only the connection that closed (the
 * argument), never a newer one opened in the meantime.
 */
export function openSaveDb(
  name: string = SAVE_DB_NAME,
  onClosed: (closed: Promise<SaveDb>) => void = () => undefined,
): Promise<SaveDb> {
  let db: SaveDb | undefined;
  const opening = openDB<SaveDbSchema>(name, SAVE_DB_VERSION, {
    upgrade(upgrading, oldVersion) {
      if (oldVersion < 1) {
        upgrading.createObjectStore('careers', { keyPath: 'id' });
        const snapshots = upgrading.createObjectStore('snapshots', {
          keyPath: ['careerId', 'seq'],
        });
        snapshots.createIndex('bySeason', ['careerId', 'season'], { unique: false });
        upgrading.createObjectStore('matchSheets', { keyPath: ['careerId', 'season', 'round'] });
        upgrading.createObjectStore('kv', { keyPath: 'key' });
        upgrading.createObjectStore('errors', { keyPath: 'id', autoIncrement: true });
      }
    },
    blocking() {
      // Never hold back the upgrade of another tab (a newer build): close and reopen later.
      db?.close();
      onClosed(connection);
    },
    terminated: () => onClosed(connection),
  });
  const connection = opening.then((opened) => (db = opened));
  return connection;
}
