import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CareerSave } from './schema.ts';
import { SAVE_LIMITS, parseCareerSave } from './validate.ts';
import {
  atRound,
  base,
  mustEncodeSnapshot,
  raw,
  snapshotSeqs,
  store,
  tamper,
  useFreshDatabase,
  variant,
} from './testing/idb.ts';
import { SAMPLE_CAREER_ID } from './testing/sample.ts';

/*
 * Acceptance scenarios of US-033 and US-066 at the level of the library (T-019, QA gate 2), the
 * way the game and the future import (T-020) reach the store: a hostile save never creates or
 * alters a career, text that is legitimate is kept as it is, and the year follows the base season
 * across the turn of the season. The rules themselves are in validate.test.ts, safe-text.test.ts,
 * migrated.test.ts and base-season.test.ts; here they are checked end to end through the rows.
 */

useFreshDatabase();

type Json = Record<string, unknown>;

const clone = (save: CareerSave): Json => JSON.parse(JSON.stringify(save)) as Json;
const playerId = Object.keys(base.game.players)[0]!;
const clubId = base.career.clubId;

function edit(save: CareerSave, change: (draft: Json) => void): Json {
  const draft = clone(save);
  change(draft);
  return draft;
}

async function allRows() {
  const db = await raw();
  const out = {
    careers: await db.getAll('careers'),
    snapshots: await db.getAll('snapshots'),
    sheets: await db.getAll('matchSheets'),
  };
  db.close();
  return out;
}

/** An own, enumerable key even when the name is that of an Object.prototype member. */
function own(target: Json, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

const longText = 'a'.repeat(SAVE_LIMITS.coachNameLength * 20);

/**
 * Where each hostile form is stopped (docs/02-architecture.md, 4.2, "Níveis de conferência do
 * esquema"): `full` (import, T-020) stops all of them; the write level stops what the application
 * layer builds (envelope and career), and the open level stops what is wrong in the content except
 * the prototype keys, which the open level does not search for (the engine's output is guaranteed
 * by the property test and the hash protects the stored copy).
 */
const hostile: [string, (d: Json) => void, { write: boolean; open: boolean }][] = [
  [
    '__proto__ key in the career',
    (d) =>
      Object.defineProperty(d.career, '__proto__', { value: { admin: true }, enumerable: true }),
    { write: true, open: false },
  ],
  [
    'constructor key in the career',
    (d) => own(d.career as Json, 'constructor', { x: 1 }),
    { write: true, open: false },
  ],
  [
    'toString key in the career',
    (d) => own(d.career as Json, 'toString', 'x'),
    { write: true, open: false },
  ],
  [
    'valueOf key in the game state',
    (d) => own(d.game as Json, 'valueOf', 'x'),
    { write: false, open: false },
  ],
  [
    'giant coach name',
    (d) => ((d.career as Json).coachName = longText),
    { write: true, open: true },
  ],
  [
    'giant player name',
    (d) => {
      const players = (d.game as Json).players as Record<string, { name: Json }>;
      players[playerId]!.name = { display: longText, full: longText, family: longText };
    },
    { write: false, open: true },
  ],
  [
    'RLO in the coach name',
    (d) => ((d.career as Json).coachName = 'Mestre\u202Eod'),
    { write: true, open: true },
  ],
  [
    'control character in the coach name',
    (d) => ((d.career as Json).coachName = 'Mestre\u0007\n'),
    { write: true, open: true },
  ],
  [
    'zalgo in the coach name',
    (d) => ((d.career as Json).coachName = 'Mestre\u0301\u0302\u0303\u0304\u0305'),
    { write: true, open: true },
  ],
  [
    'coach club that does not exist',
    (d) => ((d.career as Json).clubId = 'no-such-club'),
    { write: true, open: true },
  ],
  [
    'squad with a player that does not exist',
    (d) => (((d.game as Json).squads as Record<string, string[]>)[clubId]![0] = `${clubId}#999`),
    { write: false, open: true },
  ],
];

describe('US-033: a hostile save is refused and changes nothing', () => {
  it.each(hostile)('the import gate (full) refuses %s', (_label, change) => {
    const result = parseCareerSave(edit(base, change), { check: 'full' });
    expect(result.ok).toBe(false);
  });

  it.each(hostile.filter(([, , where]) => where.write))(
    'writing a new career with %s is refused and creates no row at all',
    async (_label, change) => {
      const result = await store().writeSnapshot(edit(base, change) as unknown as CareerSave);
      expect(result.ok).toBe(false);
      expect(await allRows()).toEqual({ careers: [], snapshots: [], sheets: [] });
    },
  );

  it.each(hostile.filter(([, , where]) => where.write))(
    'writing over an existing career with %s leaves every row byte-equal',
    async (_label, change) => {
      const s = store();
      expect((await s.writeSnapshot(atRound(3))).ok).toBe(true);
      const before = await allRows();
      const result = await s.writeSnapshot(
        edit(atRound(4), change) as unknown as CareerSave,
        undefined,
        { expectedHeadSeq: 1 },
      );
      expect(result.ok).toBe(false);
      expect(await allRows()).toEqual(before);
    },
  );

  it.each(hostile.filter(([, , where]) => where.open))(
    'a stored snapshot with %s is skipped on opening, never opened or repaired',
    async (_label, change) => {
      const s = store();
      await s.writeSnapshot(variant(1));
      await s.writeSnapshot(variant(2), undefined, { expectedHeadSeq: 1 });
      // What a tampered file would leave: a snapshot whose hash is right but whose content is not.
      const bad = await mustEncodeSnapshot(edit(variant(3), change));
      await tamper(2, (r) => ({ ...r, blob: bad.json, sha256: bad.sha256, bytes: bad.bytes }));
      const before = await allRows();
      const opened = await s.openCareer(SAMPLE_CAREER_ID);
      if (!opened.ok) throw new Error(opened.error);
      expect(opened.value.seq).toBe(1);
      expect(opened.value.skipped).toEqual([{ seq: 2, problem: 'invalid-save' }]);
      expect(await allRows()).toEqual(before);
    },
  );
});

describe('US-033: a save of a newer format', () => {
  it('is not opened, not overwritten and not created over when written', async () => {
    const s = store();
    await s.writeSnapshot(variant(1));
    await tamper(1, (r) => ({ ...r, schemaVersion: 99 }));
    const db = await raw();
    await db.put('careers', { ...(await db.get('careers', SAMPLE_CAREER_ID))!, schemaVersion: 99 });
    db.close();
    const before = await allRows();
    expect(await s.openCareer(SAMPLE_CAREER_ID)).toMatchObject({
      ok: false,
      error: 'save-too-new',
    });
    expect(await s.writeSnapshot(variant(2), undefined, { expectedHeadSeq: 1 })).toMatchObject({
      ok: false,
      error: 'save-too-new',
    });
    expect(await allRows()).toEqual(before);
    expect(await snapshotSeqs()).toEqual([1]);
  });
});

describe('US-033: a save of the previous format (the v1 fixture, stored as an older build did)', () => {
  it('opens identical, same round, same club, same table, with nothing written', async () => {
    const fixture = JSON.parse(
      readFileSync(new URL('./__fixtures__/v1.json', import.meta.url), 'utf8'),
    ) as CareerSave;
    const encoded = await mustEncodeSnapshot({
      ...fixture,
      career: { ...fixture.career, matchSheets: {} },
    });
    const db = await raw();
    await db.put('snapshots', {
      careerId: fixture.careerId,
      seq: 1,
      schemaVersion: 1,
      savedAt: fixture.updatedAt,
      season: fixture.game.season,
      round: fixture.game.round,
      sheets: {},
      sha256: encoded.sha256,
      bytes: encoded.bytes,
      blob: encoded.json,
    });
    await db.put('careers', {
      id: fixture.careerId,
      club: fixture.game.clubs[fixture.career.clubId]!.def,
      season: fixture.game.season,
      round: fixture.game.round,
      updatedAt: fixture.updatedAt,
      headSeq: 1,
      schemaVersion: 1,
    });
    db.close();
    const before = await allRows();
    const opened = await store().openCareer(fixture.careerId);
    if (!opened.ok) throw new Error(opened.error);
    const { save } = opened.value;
    expect([save.game.season, save.game.round]).toEqual([fixture.game.season, fixture.game.round]);
    expect(save.career.clubId).toBe(fixture.career.clubId);
    expect(save.game.fixtures).toEqual(fixture.game.fixtures);
    expect(save.game.clubs).toEqual(fixture.game.clubs);
    // The whole save, field by field (its sheets were not stored here).
    expect(save).toEqual({ ...fixture, career: { ...fixture.career, matchSheets: {} } });
    expect(opened.value.skipped).toEqual([]);
    expect(await allRows()).toEqual(before);
  });
});

describe('US-033/ADR-0012: legitimate text is kept exactly as written', () => {
  const names = ["João d'Ávila-Çelik", 'Conceição Magalhães', "O'Brien-Núñez", 'Sant’Ana Pão'];

  it('accents, c-cedilla, tilde, apostrophes and hyphens pass the write and reopen equal', async () => {
    const s = store();
    for (const [i, name] of names.entries()) {
      const save = edit(variant(1), (d) => {
        (d.career as Json).coachName = name;
        const players = (d.game as Json).players as Record<string, { name: Json }>;
        players[playerId]!.name = { display: name, full: name, family: name };
      }) as unknown as CareerSave;
      const result = await s.writeSnapshot(
        save,
        undefined,
        i === 0 ? undefined : { expectedHeadSeq: i },
      );
      expect(result.ok, name).toBe(true);
      const opened = await s.openCareer(SAMPLE_CAREER_ID);
      if (!opened.ok) throw new Error(opened.error);
      expect(opened.value.save).toEqual(save);
      expect(opened.value.save.career.coachName).toBe(name);
    }
  });
});

describe('US-066 / D4: the year follows the base season', () => {
  it('a career crossing the turn keeps year = baseSeason + season - 1, and a wrong year is refused', async () => {
    const s = store();
    const baseSeason = base.career.baseSeason;
    const at = (season: number, round: number): CareerSave => ({
      ...variant(round),
      game: { ...base.game, season, round, year: baseSeason + season - 1 },
    });
    expect((await s.writeSnapshot(at(1, 38))).ok).toBe(true);
    expect((await s.writeSnapshot(at(2, 1), undefined, { expectedHeadSeq: 1 })).ok).toBe(true);
    expect((await s.writeSnapshot(at(3, 1), undefined, { expectedHeadSeq: 2 })).ok).toBe(true);
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    if (!opened.ok) throw new Error(opened.error);
    expect(opened.value.save.game.season).toBe(3);
    expect(opened.value.save.game.year).toBe(baseSeason + 2);
    expect(opened.value.save.career.baseSeason).toBe(baseSeason);
    const before = await allRows();
    const wrong: CareerSave = { ...at(3, 2), game: { ...at(3, 2).game, year: baseSeason } };
    expect(await s.writeSnapshot(wrong, undefined, { expectedHeadSeq: 3 })).toMatchObject({
      ok: false,
    });
    expect(await allRows()).toEqual(before);
  });
});
