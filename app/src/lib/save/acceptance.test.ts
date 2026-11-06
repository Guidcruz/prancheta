import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CareerSave } from './schema.ts';
import { KEPT_SNAPSHOTS, MAX_CAREERS } from './schema.ts';
import type { WrittenSnapshot } from './store.ts';
import {
  atRound,
  flipByte,
  raw,
  season,
  sheetKeys,
  snapshotSeqs,
  store,
  tamper,
  useFreshDatabase,
  variant,
} from './testing/idb.ts';
import { SAMPLE_CAREER_ID, careerIdOf as cid } from './testing/sample.ts';

/*
 * Acceptance journeys of US-032 and US-034 at the level of the library (T-018, QA gate 2). The
 * unit files already cover each rule one by one (snapshots.test.ts, sheets.test.ts,
 * careers.test.ts); these tests run the scenarios of the stories the way the game will use the
 * store: a real season played round by round, closing and reopening the app, the guard of the
 * previous write passed on, and the ADR-0012 promise checked with a revision that is not the
 * current one.
 */

useFreshDatabase();

function written(result: Awaited<ReturnType<ReturnType<typeof store>['writeSnapshot']>>) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

async function rowsOf(careerId = SAMPLE_CAREER_ID) {
  const db = await raw();
  const out = {
    careers: (await db.getAll('careers')).filter((r) => r.id === careerId),
    snapshots: (await db.getAll('snapshots')).filter((r) => r.careerId === careerId),
    sheets: (await db.getAll('matchSheets')).filter((r) => r.careerId === careerId),
  };
  db.close();
  return out;
}

describe('US-032 journey: a career saved round by round', () => {
  it('saves after each round with the guard of the previous write, keeps 3 versions, reopens equal', async () => {
    const s = store();
    let last: WrittenSnapshot | undefined;
    for (let played = 0; played <= 5; played++) {
      const guard = { expectedHeadSeq: last?.seq ?? 0 };
      last = written(await s.writeSnapshot(atRound(played), last?.sheets, guard));
      expect((await snapshotSeqs()).length).toBeLessThanOrEqual(KEPT_SNAPSHOTS);
    }
    // Round 5 played: the stored version is the one of round 6, and only 3 remain.
    const reopened = await store().openCareer(SAMPLE_CAREER_ID);
    if (!reopened.ok) throw new Error(reopened.error);
    expect(reopened.value.save.game.round).toBe(6);
    expect(reopened.value.save).toEqual(atRound(5));
    expect(reopened.value).toMatchObject({ skipped: [], roundsLost: 0, missingSheetRounds: [] });
    expect(await snapshotSeqs()).toEqual([4, 5, 6]);
    // The five rounds of sheets are all there, once each.
    expect(await sheetKeys()).toEqual([1, 2, 3, 4, 5].map((r) => [1, r]));
  });

  it('after a corrupted newest version, continues from the previous one and keeps saving', async () => {
    const s = store();
    let last: WrittenSnapshot | undefined;
    for (const played of [3, 4, 5]) {
      last = written(await s.writeSnapshot(atRound(played), last?.sheets));
    }
    await tamper(3, flipByte);
    // A new run of the app: opens round 5 (version 2), loses one round, says so.
    const app = store();
    const back = await app.openCareer(SAMPLE_CAREER_ID);
    if (!back.ok) throw new Error(back.error);
    expect(back.value).toMatchObject({ seq: 2, headSeq: 3, roundsLost: 1 });
    expect(back.value.save).toEqual(atRound(4));
    // The player plays on from there; the guard is the head it opened with.
    const next = written(
      await app.writeSnapshot(atRound(5), back.value.sheets, {
        expectedHeadSeq: back.value.headSeq,
      }),
    );
    expect(next.seq).toBe(4);
    const again = await store().openCareer(SAMPLE_CAREER_ID);
    expect(again.ok && again.value).toMatchObject({ seq: 4, skipped: [], roundsLost: 0 });
    expect(again.ok && again.value.save).toEqual(atRound(5));
    // Never more than 3 versions, and the corrupted one is not among the survivors' newest.
    expect((await snapshotSeqs()).length).toBeLessThanOrEqual(KEPT_SNAPSHOTS);
  });

  it('opening is read-only: a fallback does not rewrite, repair or delete any row', async () => {
    const s = store();
    let last: WrittenSnapshot | undefined;
    for (const played of [3, 4, 5]) {
      last = written(await s.writeSnapshot(atRound(played), last?.sheets));
    }
    await tamper(3, flipByte);
    const before = await rowsOf();
    for (let i = 0; i < 2; i++) await store().openCareer(SAMPLE_CAREER_ID);
    expect(await rowsOf()).toEqual(before);
  });

  it('with the 3 versions corrupted, does not open, keeps the career listed and lets it be deleted', async () => {
    const s = store();
    for (const played of [3, 4, 5]) await s.writeSnapshot(atRound(played));
    await s.writeSnapshot(atRound(2, 1, cid('healthy')));
    for (const seq of [1, 2, 3]) await tamper(seq, flipByte);
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    expect(opened).toMatchObject({ ok: false, error: 'all-corrupt' });
    const listed = await s.listCareers();
    expect(listed.ok && listed.value.map((c) => c.id).sort()).toEqual(
      [cid('healthy'), SAMPLE_CAREER_ID].sort(),
    );
    // The healthy career is untouched by the other one's failure.
    const healthy = await s.openCareer(cid('healthy'));
    expect(healthy.ok && healthy.value.save).toEqual(atRound(2, 1, cid('healthy')));
    // The player can get rid of the broken career (US-034), and only of it.
    expect((await s.deleteCareer(SAMPLE_CAREER_ID)).ok).toBe(true);
    const after = await s.listCareers();
    expect(after.ok && after.value.map((c) => c.id)).toEqual([cid('healthy')]);
    expect(await snapshotSeqs()).toEqual([]);
    expect(await sheetKeys()).toEqual([]);
  });

  it('writes a deeply frozen save without changing it, and the stored copy is not the same object', async () => {
    const frozen = structuredClone(atRound(3));
    const freeze = (v: unknown): void => {
      if (v !== null && typeof v === 'object') {
        Object.values(v).forEach(freeze);
        Object.freeze(v);
      }
    };
    freeze(frozen);
    const snapshot = JSON.stringify(frozen);
    const s = store();
    expect((await s.writeSnapshot(frozen)).ok).toBe(true);
    expect(JSON.stringify(frozen)).toBe(snapshot);
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok && opened.value.save).toEqual(frozen);
    expect(opened.ok && opened.value.save).not.toBe(frozen);
  });
});

describe('US-034 journey: several careers', () => {
  it('playing a round in one career leaves the other byte-identical in every row', async () => {
    const s = store();
    let a: WrittenSnapshot | undefined;
    for (const played of [2, 3]) {
      a = written(await s.writeSnapshot(atRound(played, 1, cid('a')), a?.sheets));
    }
    await s.writeSnapshot(atRound(4, 1, cid('b')));
    const beforeB = await rowsOf(cid('b'));
    await s.writeSnapshot(atRound(4, 1, cid('a')), a?.sheets, { expectedHeadSeq: a!.seq });
    expect(await rowsOf(cid('b'))).toEqual(beforeB);
    // The list reflects both, newest save first.
    const listed = await s.listCareers();
    if (!listed.ok) throw new Error(listed.error);
    expect(listed.value.map((c) => [c.id, c.season, c.round])).toEqual([
      [cid('a'), 1, 5],
      [cid('b'), 1, 5],
    ]);
  });

  it('deleting removes all 3 versions and the sheets of the career, and the id can be used again', async () => {
    const s = store();
    let last: WrittenSnapshot | undefined;
    for (const played of [1, 2, 3, 4]) {
      last = written(await s.writeSnapshot(atRound(played), last?.sheets));
    }
    expect(await snapshotSeqs()).toHaveLength(KEPT_SNAPSHOTS);
    await s.deleteCareer(SAMPLE_CAREER_ID);
    expect(await rowsOf()).toMatchObject({ snapshots: [], sheets: [] });
    // Deleting twice is harmless.
    expect((await s.deleteCareer(SAMPLE_CAREER_ID)).ok).toBe(true);
    // A new career with the same id starts clean at head 0.
    const fresh = written(await s.writeSnapshot(atRound(1), undefined, { expectedHeadSeq: 0 }));
    expect(fresh.seq).toBe(1);
  });

  it('two tabs creating the last free career: exactly one is accepted', async () => {
    const a = store();
    const b = store();
    for (let i = 0; i < MAX_CAREERS - 1; i++) await a.writeSnapshot(variant(1, cid(`c-${i}`)));
    const [ra, rb] = await Promise.all([
      a.writeSnapshot(variant(1, cid('new-a'))),
      b.writeSnapshot(variant(1, cid('new-b'))),
    ]);
    expect([ra.ok, rb.ok].sort()).toEqual([false, true]);
    const refused = ra.ok ? rb : ra;
    expect(refused).toMatchObject({ ok: false, error: 'career-limit' });
    const listed = await a.listCareers();
    expect(listed.ok && listed.value).toHaveLength(MAX_CAREERS);
  });
});

describe('ADR-0012 conformance: the save keeps what it was created with', () => {
  /** A season whose names revision is not the current one (0), as after a yearly batch of names. */
  const oldRev: CareerSave = { ...season, game: { ...season.game, retiredNamesRev: 7 } };

  it('keeps names, faces and a retiredNamesRev that is not the current one, in every version kept', async () => {
    const s = store();
    let last: WrittenSnapshot | undefined;
    const rounds = [36, 37, 38].map((played) => {
      const at = atRound(played);
      return { ...at, game: { ...at.game, retiredNamesRev: 7, players: oldRev.game.players } };
    });
    for (const save of rounds) last = written(await s.writeSnapshot(save, last?.sheets));
    // Newest version: reopened in a new app run.
    const opened = await store().openCareer(SAMPLE_CAREER_ID);
    if (!opened.ok) throw new Error(opened.error);
    expect(opened.value.save.game.retiredNamesRev).toBe(7);
    for (const [id, player] of Object.entries(oldRev.game.players)) {
      expect(opened.value.save.game.players[id]!.name, id).toEqual(player.name);
      expect(opened.value.save.game.players[id]!.face, id).toBe(player.face);
    }
    // Falling back to the previous version keeps them too.
    await tamper(3, flipByte);
    const back = await store().openCareer(SAMPLE_CAREER_ID);
    if (!back.ok) throw new Error(back.error);
    expect(back.value.seq).toBe(2);
    expect(back.value.save.game.retiredNamesRev).toBe(7);
    expect(Object.values(back.value.save.game.players).map((p) => p.name.full)).toEqual(
      Object.values(oldRev.game.players).map((p) => p.name.full),
    );
  });

  it('never resolves a name on its own: lib/save does not import the generators or the name lists', () => {
    const dir = __dirname;
    const sources = readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.startsWith('testing'))
      .map((f) => [f, readFileSync(join(dir, f), 'utf8')] as const);
    expect(sources.length).toBeGreaterThan(5);
    for (const [file, text] of sources) {
      expect(text, file).not.toMatch(/from\s+['"][^'"]*(generators|content\/names|identity)/);
    }
  });
});
