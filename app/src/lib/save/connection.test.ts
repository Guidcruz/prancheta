import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveDb } from './db.ts';
import { SaveStore } from './store.ts';

/*
 * The store's connection (NIT of the T-018 review): when a connection reports that it closed (the
 * `blocking` of a newer tab, or `terminated`), the store drops it only if it is still the current
 * one; a late report of an old connection never drops a newer one.
 */

const closers: ((closed: Promise<SaveDb>) => void)[] = [];

vi.mock('./db.ts', async (original) => {
  const actual = await original<typeof import('./db.ts')>();
  return {
    ...actual,
    openSaveDb: (name: string, onClosed: (closed: Promise<SaveDb>) => void) => {
      closers.push(onClosed);
      return actual.openSaveDb(name, onClosed);
    },
  };
});

beforeEach(() => {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  closers.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const current = (s: SaveStore) => (s as unknown as { db: Promise<SaveDb> | undefined }).db;

describe('save store connection', () => {
  it('drops the connection that closed, and only that one', async () => {
    const s = new SaveStore({ dbName: 'prancheta-connection' });
    await s.listCareers();
    const first = current(s)!;
    // The first connection closes (another tab upgrades): the next access opens a new one.
    closers[0]!(first);
    expect(current(s)).toBeUndefined();
    await s.listCareers();
    const second = current(s)!;
    expect(second).not.toBe(first);
    // A late report of the first connection must not drop the second one.
    closers[0]!(first);
    expect(current(s)).toBe(second);
    expect(closers).toHaveLength(2);
    (await first).close();
    await s.close();
  });
});
