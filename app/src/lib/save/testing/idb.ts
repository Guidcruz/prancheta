import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, vi } from 'vitest';
import { encodeSave, type EncodedSave } from '../codec.ts';
import { openSaveDb } from '../db.ts';
import type { CareerSave, MatchSheetRecord, SnapshotRecord } from '../schema.ts';
import { SaveStore, type SaveStoreOptions } from '../store.ts';
import { SAMPLE_CAREER_ID, sampleAtRound, sampleCareerSave } from './sample.ts';

/*
 * Helpers of the integration tests of the save layer with fake-indexeddb (snapshots.test.ts,
 * sheets.test.ts, careers.test.ts): a fresh database per test, stores closed after it, direct
 * access to the rows to tamper with them, and saves at any round of a played season. Test-only:
 * the game never imports this folder.
 */

export const DB = 'prancheta-unit';
const stores: SaveStore[] = [];

/** A fresh in-memory IndexedDB for every test of the file that calls it. */
export function useFreshDatabase(): void {
  beforeEach(() => {
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    await Promise.all(stores.splice(0).map((s) => s.close()));
  });
}

/** A store on the test database with a fixed clock; closed after the test. */
export function store(
  dbName = DB,
  options: Omit<SaveStoreOptions, 'dbName' | 'now'> = {},
): SaveStore {
  const created = new SaveStore({
    ...options,
    dbName,
    now: () => new Date('2026-11-06T12:00:00.000Z'),
  });
  stores.push(created);
  return created;
}

/** A new game (round 1, no sheets), built once; variants copy it with another id, round or date. */
export const base = sampleCareerSave({ rounds: 0 });

export function variant(
  round: number,
  careerId = SAMPLE_CAREER_ID,
  updatedAt = `2026-11-06T12:${String(round).padStart(2, '0')}:00.000Z`,
): CareerSave {
  return { ...base, careerId, updatedAt, game: { ...base.game, round } };
}

/** A whole season played (380 sheets), built once. */
export const season = sampleCareerSave({ rounds: 38 });

/**
 * The season save as it was after `played` rounds (see {@link sampleAtRound}); `inSeason`
 * relabels it as another season (for the season turn).
 */
export function atRound(played: number, inSeason = 1, careerId = SAMPLE_CAREER_ID): CareerSave {
  return sampleAtRound(season, played, inSeason, careerId);
}

/** The ids of the fixtures of one round of the season. */
export function fixturesOf(round: number): string[] {
  return season.game.fixtures.filter((f) => f.round === round).map((f) => f.id);
}

export async function mustEncode(value: unknown): Promise<EncodedSave> {
  const encoded = await encodeSave(value);
  if (!encoded.ok) throw new Error(encoded.error);
  return encoded.value;
}

/** A direct connection to the test database (created with the stores if no store opened it). */
export async function raw() {
  return openSaveDb(DB);
}

export async function snapshotSeqs(careerId = SAMPLE_CAREER_ID): Promise<number[]> {
  const db = await raw();
  const keys = await db.getAllKeys(
    'snapshots',
    IDBKeyRange.bound([careerId, 0], [careerId, Infinity]),
  );
  db.close();
  return keys.map((k) => k[1]);
}

/** `[season, round]` of every row of sheets of a career. */
export async function sheetKeys(careerId = SAMPLE_CAREER_ID): Promise<[number, number][]> {
  const db = await raw();
  const keys = await db.getAllKeys(
    'matchSheets',
    IDBKeyRange.bound([careerId], [careerId, Infinity, Infinity]),
  );
  db.close();
  return keys.map((k) => [k[1], k[2]]);
}

export async function tamper(
  seq: number,
  change: (r: SnapshotRecord) => SnapshotRecord,
  careerId = SAMPLE_CAREER_ID,
) {
  const db = await raw();
  const record = await db.get('snapshots', [careerId, seq]);
  await db.put('snapshots', change(record!));
  db.close();
}

export async function tamperSheet(
  season: number,
  round: number,
  change: (r: MatchSheetRecord) => MatchSheetRecord | undefined,
  careerId = SAMPLE_CAREER_ID,
) {
  const db = await raw();
  const row = await db.get('matchSheets', [careerId, season, round]);
  const changed = change(row!);
  if (changed === undefined) await db.delete('matchSheets', [careerId, season, round]);
  else await db.put('matchSheets', changed);
  db.close();
}

export function flipByte<T extends { readonly blob: Uint8Array<ArrayBuffer> }>(r: T): T {
  const blob = r.blob.slice();
  const at = blob.length >> 1;
  blob[at] = blob[at]! ^ 0xff;
  return { ...r, blob };
}

type PutArgs = Parameters<IDBObjectStore['put']>;

/**
 * Replaces `IDBObjectStore.prototype.put` for the store named `name` (the others pass through).
 * `run` gets the original put bound to the store, and the arguments.
 */
export function onPut(
  name: string,
  run: (
    put: (...args: PutArgs) => IDBRequest,
    store: IDBObjectStore,
    ...args: PutArgs
  ) => IDBRequest,
): void {
  const put = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
    this: IDBObjectStore,
    ...args: PutArgs
  ) {
    if (this.name !== name) return put.apply(this, args);
    return run((...a: PutArgs) => put.apply(this, a), this, ...args);
  });
}
