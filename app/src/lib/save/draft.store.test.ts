import { describe, expect, it, vi } from 'vitest';
import type { DraftSheet } from '../../engine/index.ts';
import { SAVE_SCHEMA_VERSION, type CareerRecord, type CareerSave } from './schema.ts';
import {
  base,
  flipByte,
  onPut,
  raw,
  snapshotSeqs,
  store,
  tamper,
  useFreshDatabase,
  variant,
} from './testing/idb.ts';
import { SAMPLE_CAREER_ID, sampleDraft } from './testing/sample.ts';
import type { SnapshotRecord } from './schema.ts';

/*
 * The coach's sheet between rounds in the row of `careers` (ADR-0021, item 3; docs/02-
 * architecture.md, 4.2, "Ficha do técnico"; T-075), with fake-indexeddb: `writeDraft` and the
 * guard, the row's sheet when opening (`stale`, `invalid`), the snapshot write that leaves the row
 * without it, the undo, the list and the delete.
 */

useFreshDatabase();

const draft = sampleDraft(base);
const squad = base.game.squads[base.career.clubId]!;

/** `save` with `sheet` as its draft. */
const withDraft = (save: CareerSave, sheet: DraftSheet = draft): CareerSave => ({
  ...save,
  career: { ...save.career, draft: sheet },
});

/** Another coherent sheet: other tactic, one more free slot. */
const other: DraftSheet = {
  lineup: {
    ...draft.lineup,
    starters: draft.lineup.starters.map((id, i) => (i === 10 ? null : id)),
    captains: [],
  },
  tactic: { posture: 'balanced', pressure: 'medium' },
};

async function careerRow(): Promise<CareerRecord | undefined> {
  const db = await raw();
  const row = await db.get('careers', SAMPLE_CAREER_ID);
  db.close();
  return row;
}

async function putRow(change: (row: CareerRecord) => unknown): Promise<void> {
  const db = await raw();
  const row = await db.get('careers', SAMPLE_CAREER_ID);
  await db.put('careers', change(row!) as CareerRecord);
  db.close();
}

async function allRows() {
  const db = await raw();
  const rows = {
    careers: await db.getAll('careers'),
    snapshots: await db.getAll('snapshots'),
    matchSheets: await db.getAll('matchSheets'),
  };
  db.close();
  return rows;
}

describe('SaveStore.writeDraft (ADR-0021, item 3)', () => {
  it('stores { seq, sheet } in the career row, and opening gives the sheet back', async () => {
    const s = store();
    expect((await s.writeSnapshot(variant(2))).ok).toBe(true);
    expect(
      await s.writeDraft(withDraft(variant(2)), { expectedHeadSeq: 1, snapshotSeq: 1 }),
    ).toEqual({
      ok: true,
      value: { seq: 1 },
    });
    expect((await careerRow())?.draft).toEqual({ seq: 1, sheet: draft });
    const opened = await store().openCareer(SAMPLE_CAREER_ID);
    if (!opened.ok) throw new Error(opened.error);
    expect(opened.value.save).toEqual(withDraft(variant(2)));
    expect(opened.value.draftSkipped).toBeUndefined();
    // The snapshot itself is unchanged: one version, without the sheet.
    expect(await snapshotSeqs()).toEqual([1]);
  });

  it('the last sheet written wins', async () => {
    const s = store();
    await s.writeSnapshot(variant(2));
    await s.writeDraft(withDraft(variant(2)), { expectedHeadSeq: 1, snapshotSeq: 1 });
    await s.writeDraft(withDraft(variant(2), other), { expectedHeadSeq: 1, snapshotSeq: 1 });
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok && opened.value.save.career.draft).toEqual(other);
  });

  it('with an old seq refuses with conflict, and nothing changes', async () => {
    const s = store();
    await s.writeSnapshot(variant(2));
    await s.writeSnapshot(variant(3), undefined, { expectedHeadSeq: 1 });
    await s.writeDraft(withDraft(variant(3)), { expectedHeadSeq: 2, snapshotSeq: 2 });
    const before = await allRows();
    expect(
      await s.writeDraft(withDraft(variant(2), other), { expectedHeadSeq: 1, snapshotSeq: 1 }),
    ).toEqual({
      ok: false,
      error: 'conflict',
      detail: { expectedHeadSeq: 1, headSeq: 2 },
    });
    expect(await allRows()).toEqual(before);
  });

  it('refuses a career not on the device, and a row of a newer build, changing nothing', async () => {
    const s = store();
    expect(
      await s.writeDraft(withDraft(variant(2)), { expectedHeadSeq: 0, snapshotSeq: 0 }),
    ).toEqual({
      ok: false,
      error: 'not-found',
    });
    await s.writeSnapshot(variant(2));
    await putRow((row) => ({ ...row, schemaVersion: SAVE_SCHEMA_VERSION + 1 }));
    const before = await allRows();
    expect(
      await s.writeDraft(withDraft(variant(2)), { expectedHeadSeq: 1, snapshotSeq: 1 }),
    ).toMatchObject({
      ok: false,
      error: 'save-too-new',
    });
    expect(await allRows()).toEqual(before);
  });

  it('refuses a sheet that does not pass parseDraft against the save squad (invalid-save)', async () => {
    const s = store();
    await s.writeSnapshot(variant(2));
    const before = await allRows();
    const stranger = Object.values(base.game.squads).find((ids) => ids !== squad)![0]!;
    const wrong: DraftSheet[] = [
      {
        ...draft,
        lineup: { ...draft.lineup, starters: [stranger, ...draft.lineup.starters.slice(1)] },
      },
      { ...draft, lineup: { ...draft.lineup, bench: [squad[0]!, ...draft.lineup.bench.slice(1)] } },
      { ...draft, tactic: { ...draft.tactic, posture: 'allOut' as 'attacking' } },
      { ...draft, lineup: { ...draft.lineup, starters: draft.lineup.starters.slice(1) } },
    ];
    for (const sheet of wrong) {
      expect(
        await s.writeDraft(withDraft(variant(2), sheet), { expectedHeadSeq: 1, snapshotSeq: 1 }),
      ).toMatchObject({ ok: false, error: 'invalid-save' });
    }
    expect(await s.writeDraft(variant(2), { expectedHeadSeq: 1, snapshotSeq: 1 })).toMatchObject({
      ok: false,
      error: 'invalid-save',
    });
    expect(await allRows()).toEqual(before);
  });

  it('answers quota-exceeded when the put is refused, and the row stays as it was', async () => {
    const s = store();
    await s.writeSnapshot(variant(2));
    const before = await allRows();
    onPut('careers', () => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(
      await s.writeDraft(withDraft(variant(2)), { expectedHeadSeq: 1, snapshotSeq: 1 }),
    ).toMatchObject({
      ok: false,
      error: 'quota-exceeded',
    });
    vi.restoreAllMocks();
    expect(await allRows()).toEqual(before);
  });

  it('reads and writes only the careers store (never snapshots nor matchSheets)', async () => {
    const s = store();
    await s.writeSnapshot(variant(2));
    // The store's connection, already open: every transaction it starts from now on.
    const transaction = vi.spyOn(IDBDatabase.prototype, 'transaction');
    const get = vi.spyOn(IDBObjectStore.prototype, 'get');
    const put = vi.spyOn(IDBObjectStore.prototype, 'put');
    expect(
      (await s.writeDraft(withDraft(variant(2)), { expectedHeadSeq: 1, snapshotSeq: 1 })).ok,
    ).toBe(true);
    const scopes = transaction.mock.calls.map(([names]) => [names].flat());
    expect(scopes).toEqual([['careers']]);
    expect(get.mock.contexts.map((store) => (store as IDBObjectStore).name)).toEqual(['careers']);
    expect(put.mock.contexts.map((store) => (store as IDBObjectStore).name)).toEqual(['careers']);
  });
});

describe('the row sheet when opening (ADR-0021, item 3)', () => {
  it('is ignored when built on another snapshot (stale), and the snapshot sheet stays', async () => {
    const s = store();
    await s.writeSnapshot(withDraft(variant(2)));
    await s.writeDraft(withDraft(variant(2), other), { expectedHeadSeq: 1, snapshotSeq: 1 });
    await putRow((row) => ({ ...row, draft: { ...row.draft!, seq: 7 } }));
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    if (!opened.ok) throw new Error(opened.error);
    expect(opened.value.draftSkipped).toBe('stale');
    expect(opened.value.save.career.draft).toEqual(draft);
  });

  it('is stale after falling back to the version before a corrupted head', async () => {
    const s = store();
    await s.writeSnapshot(withDraft(variant(2)));
    await s.writeSnapshot(withDraft(variant(3)), undefined, { expectedHeadSeq: 1 });
    await s.writeDraft(withDraft(variant(3), other), { expectedHeadSeq: 2, snapshotSeq: 2 });
    await tamper(2, (r: SnapshotRecord) => flipByte(r));
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    if (!opened.ok) throw new Error(opened.error);
    expect(opened.value.seq).toBe(1);
    expect(opened.value.draftSkipped).toBe('stale');
    expect(opened.value.save).toEqual(withDraft(variant(2)));
  });

  it('after a fallback, a sheet written with the seq of the snapshot that opened is used', async () => {
    const s = store();
    await s.writeSnapshot(withDraft(variant(2)));
    await s.writeSnapshot(withDraft(variant(3)), undefined, { expectedHeadSeq: 1 });
    // The head N+1 = 2 is corrupted: opening falls back to N = 1, the head stays 2.
    await tamper(2, (r: SnapshotRecord) => flipByte(r));
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    if (!opened.ok) throw new Error(opened.error);
    expect([opened.value.seq, opened.value.headSeq]).toEqual([1, 2]);
    // The guard against another tab is the head; the sheet's seq is the snapshot that opened.
    expect(
      await s.writeDraft(withDraft(opened.value.save, other), {
        expectedHeadSeq: 2,
        snapshotSeq: 1,
      }),
    ).toEqual({ ok: true, value: { seq: 1 } });
    expect((await careerRow())?.draft).toEqual({ seq: 1, sheet: other });
    const again = await store().openCareer(SAMPLE_CAREER_ID);
    if (!again.ok) throw new Error(again.error);
    expect(again.value.seq).toBe(1);
    expect(again.value.draftSkipped).toBeUndefined();
    expect(again.value.save).toEqual(withDraft(variant(2), other));
  });

  it('is ignored when it does not pass parseDraft (invalid), and the career opens with the snapshot sheet', async () => {
    const stranger = Object.values(base.game.squads).find((ids) => ids !== squad)![0]!;
    const bad: unknown[] = [
      { seq: 1, sheet: { ...draft, lineup: { ...draft.lineup, captains: [stranger] } } },
      { seq: 1, sheet: { ...draft, extra: true } },
      { seq: 1 },
      { seq: '1', sheet: draft },
      'draft',
      null,
    ];
    for (const stored of bad) {
      const s = store();
      await s.writeSnapshot(withDraft(variant(2)), undefined, undefined);
      await putRow((row) => ({ ...row, draft: stored }));
      const opened = await s.openCareer(SAMPLE_CAREER_ID);
      if (!opened.ok) throw new Error(opened.error);
      expect(opened.value.draftSkipped, JSON.stringify(stored)).toBe('invalid');
      expect(opened.value.save.career.draft).toEqual(draft);
      await s.deleteCareer(SAMPLE_CAREER_ID);
    }
  });

  it('a save without any sheet opens without one, and says nothing', async () => {
    const s = store();
    await s.writeSnapshot(variant(2));
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    if (!opened.ok) throw new Error(opened.error);
    expect(Object.hasOwn(opened.value.save.career, 'draft')).toBe(false);
    expect('draftSkipped' in opened.value).toBe(false);
  });
});

describe('the row sheet and the other operations', () => {
  it('a snapshot write stores the row without the sheet; the sheet is in the snapshot', async () => {
    const s = store();
    await s.writeSnapshot(variant(2));
    await s.writeDraft(withDraft(variant(2)), { expectedHeadSeq: 1, snapshotSeq: 1 });
    expect((await careerRow())?.draft).toBeDefined();
    expect(
      (await s.writeSnapshot(withDraft(variant(3)), undefined, { expectedHeadSeq: 1 })).ok,
    ).toBe(true);
    expect(await careerRow()).not.toHaveProperty('draft');
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok && opened.value.save).toEqual(withDraft(variant(3)));
    expect(opened.ok && opened.value.draftSkipped).toBeUndefined();
  });

  it('the undo of a failed check gives back the previous row with its sheet', async () => {
    const s = store();
    await s.writeSnapshot(variant(2));
    await s.writeDraft(withDraft(variant(2), other), { expectedHeadSeq: 1, snapshotSeq: 1 });
    const before = await careerRow();
    onPut('snapshots', (put, _store, value) => put(flipByte(value as SnapshotRecord)));
    expect(await s.writeSnapshot(withDraft(variant(3)), undefined, { expectedHeadSeq: 1 })).toEqual(
      { ok: false, error: 'verify-failed', detail: { problem: 'mismatch', rolledBack: true } },
    );
    vi.restoreAllMocks();
    expect(await careerRow()).toEqual(before);
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok && opened.value.save).toEqual(withDraft(variant(2), other));
  });

  it('listCareers gives the summary without the sheet', async () => {
    const s = store();
    await s.writeSnapshot(variant(2));
    await s.writeDraft(withDraft(variant(2)), { expectedHeadSeq: 1, snapshotSeq: 1 });
    const listed = await s.listCareers();
    if (!listed.ok) throw new Error(listed.error);
    expect(listed.value).toHaveLength(1);
    expect(listed.value[0]).not.toHaveProperty('draft');
    expect(listed.value[0]).toMatchObject({ id: SAMPLE_CAREER_ID, headSeq: 1 });
  });

  it('deleteCareer removes the sheet with the career', async () => {
    const s = store();
    await s.writeSnapshot(variant(2));
    await s.writeDraft(withDraft(variant(2)), { expectedHeadSeq: 1, snapshotSeq: 1 });
    expect((await s.deleteCareer(SAMPLE_CAREER_ID)).ok).toBe(true);
    expect(await careerRow()).toBeUndefined();
    expect(
      await s.writeDraft(withDraft(variant(2)), { expectedHeadSeq: 1, snapshotSeq: 1 }),
    ).toEqual({
      ok: false,
      error: 'not-found',
    });
  });
});
