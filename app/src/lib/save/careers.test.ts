import { describe, expect, it } from 'vitest';
import { MAX_CAREERS } from './schema.ts';
import {
  atRound,
  base,
  sheetKeys,
  snapshotSeqs,
  store,
  useFreshDatabase,
  variant,
} from './testing/idb.ts';
import { SAMPLE_CAREER_ID, careerIdOf as cid } from './testing/sample.ts';

/*
 * US-034 with fake-indexeddb (docs/03-test-plan.md, 2 and 6): the list of careers, independent
 * careers, delete (snapshots and rows of sheets), the limit of 10, and the kv store.
 */

useFreshDatabase();

describe('several careers (US-034)', () => {
  it('lists the careers with club, season and round, the most recent first', async () => {
    const s = store();
    await s.writeSnapshot(variant(3, cid('a'), '2026-11-01T10:00:00.000Z'));
    await s.writeSnapshot(variant(9, cid('b'), '2026-11-05T10:00:00.000Z'));
    await s.writeSnapshot(variant(1, cid('c'), '2026-11-03T10:00:00.000Z'));
    const listed = await s.listCareers();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.map((c) => c.id)).toEqual([cid('b'), cid('c'), cid('a')]);
    const club = base.game.clubs[base.career.clubId]!.def;
    expect(listed.value[0]).toEqual({
      id: cid('b'),
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
    await s.writeSnapshot(atRound(3, 1, cid('a')));
    await s.writeSnapshot(atRound(3, 1, cid('b')));
    const before = await s.openCareer(cid('b'));
    await s.writeSnapshot(atRound(4, 1, cid('a')));
    await s.writeSnapshot(atRound(5, 1, cid('a')));
    expect(await s.openCareer(cid('b'))).toEqual(before);
    const a = await s.openCareer(cid('a'));
    expect(a.ok && a.value.save.game.round).toBe(6);
    expect(await sheetKeys(cid('b'))).toEqual([
      [1, 1],
      [1, 2],
      [1, 3],
    ]);
  });

  it('deletes a career, its versions and its sheets, and nothing else', async () => {
    const s = store();
    for (const round of [1, 2, 3, 4]) await s.writeSnapshot(atRound(round));
    await s.writeSnapshot(atRound(2, 1, cid('other')));
    expect((await sheetKeys()).length).toBe(4);
    expect(await s.deleteCareer(SAMPLE_CAREER_ID)).toEqual({ ok: true, value: undefined });
    expect(await snapshotSeqs()).toEqual([]);
    expect(await sheetKeys()).toEqual([]);
    expect(await s.openCareer(SAMPLE_CAREER_ID)).toEqual({ ok: false, error: 'not-found' });
    const listed = await s.listCareers();
    expect(listed.ok && listed.value.map((c) => c.id)).toEqual([cid('other')]);
    expect(await snapshotSeqs(cid('other'))).toEqual([1]);
    expect(await sheetKeys(cid('other'))).toEqual([
      [1, 1],
      [1, 2],
    ]);
  });

  it('holds 10 careers, refuses the 11th and makes room after a delete', async () => {
    const s = store();
    for (let i = 0; i < MAX_CAREERS; i++) {
      expect((await s.writeSnapshot(variant(1, cid(`career-${i}`)))).ok).toBe(true);
    }
    expect(await s.writeSnapshot(variant(1, cid('career-10')))).toEqual({
      ok: false,
      error: 'career-limit',
      detail: { max: 10 },
    });
    // The careers already there keep saving.
    expect((await s.writeSnapshot(variant(2, cid('career-3')))).ok).toBe(true);
    const listed = await s.listCareers();
    expect(listed.ok && listed.value).toHaveLength(MAX_CAREERS);
    await s.deleteCareer(cid('career-0'));
    expect((await s.writeSnapshot(variant(1, cid('career-10')))).ok).toBe(true);
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
