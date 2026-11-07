import { describe, expect, it } from 'vitest';
import { snapshotSeqs, store, useFreshDatabase, variant } from './testing/idb.ts';

/*
 * The `errors` store of the database (docs/02-architecture.md, 4.2; US-045): a ring kept in one
 * transaction, the oldest dropped first. What a row holds is lib/errors' (no personal data); here
 * only the ring and its independence from the careers.
 */

useFreshDatabase();

describe('the error ring (US-045)', () => {
  it('keeps the newest rows, in order, and drops the oldest past the limit', async () => {
    const s = store();
    for (let i = 0; i < 7; i++) {
      expect(await s.appendError({ code: `e${i}` }, 5)).toEqual({ ok: true, value: undefined });
    }
    const listed = await s.listErrors();
    expect(listed.ok && listed.value.map((row) => row.code)).toEqual([
      'e2',
      'e3',
      'e4',
      'e5',
      'e6',
    ]);
    // Auto-increment keys keep growing: the order survives the drops.
    const ids = listed.ok ? listed.value.map((row) => row.id as number) : [];
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
  });

  it('an empty database lists no rows', async () => {
    expect(await store().listErrors()).toEqual({ ok: true, value: [] });
  });

  it('never touches the careers', async () => {
    const s = store();
    await s.writeSnapshot(variant(1));
    await s.appendError({ code: 'x' }, 1);
    await s.appendError({ code: 'y' }, 1);
    expect(await snapshotSeqs()).toEqual([1]);
    expect((await s.listCareers()).ok && (await s.listErrors())).toMatchObject({
      ok: true,
      value: [{ code: 'y' }],
    });
  });

  it('answers storage-unavailable when IndexedDB is missing, and never throws', async () => {
    (globalThis as { indexedDB?: unknown }).indexedDB = undefined;
    const s = store();
    expect(await s.appendError({ code: 'x' }, 50)).toMatchObject({
      ok: false,
      error: 'storage-unavailable',
    });
    expect(await s.listErrors()).toMatchObject({ ok: false, error: 'storage-unavailable' });
  });
});
