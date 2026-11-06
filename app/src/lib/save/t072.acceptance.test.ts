import { describe, expect, it } from 'vitest';
import { decodeSave, gunzip } from './codec.ts';
import { parseCareerSave } from './validate.ts';
import type { CareerSave } from './schema.ts';
import type { WrittenSnapshot } from './store.ts';
import {
  atRound,
  mustEncode,
  mustEncodeSnapshot,
  raw,
  sheetKeys,
  snapshotSeqs,
  store,
  tamper,
  useFreshDatabase,
  variant,
} from './testing/idb.ts';
import { SAMPLE_CAREER_ID } from './testing/sample.ts';
import { sha256Hex } from './codec.ts';

/*
 * QA gate 2 of T-072 (faster save write), at the level of the library: what the person using the
 * save sees must be the same as before (snapshot without gzip, season index, prune without reading
 * snapshots). The rule-by-rule cases are already in codec.test.ts, snapshots.test.ts and
 * sheets.test.ts; these run the journeys end to end and the hostile cases through the rows.
 */

useFreshDatabase();

function written(result: Awaited<ReturnType<ReturnType<typeof store>['writeSnapshot']>>) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
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

describe('T-072 journey: a whole season round by round, the turn, and a reopen', () => {
  it('reopens equal (sheets reassembled) after 38 rounds and after the turn, with the prune applied', async () => {
    let last: WrittenSnapshot | undefined;
    const play = async (save: CareerSave) => {
      // A new store each time: the app closed and reopened between rounds.
      const s = store();
      last = written(
        await s.writeSnapshot(save, last?.sheets, { expectedHeadSeq: last?.seq ?? 0 }),
      );
    };
    for (let played = 0; played <= 38; played++) await play(atRound(played));
    const endOfSeason = await store().openCareer(SAMPLE_CAREER_ID);
    expect(endOfSeason.ok && endOfSeason.value.save).toEqual(atRound(38));
    expect(endOfSeason.ok && endOfSeason.value).toMatchObject({
      skipped: [],
      missingSheetRounds: [],
    });
    expect(await sheetKeys()).toHaveLength(38);

    for (const played of [0, 1, 2]) await play(atRound(played, 2));
    // Three writes of season 2: no snapshot of season 1 is left, so its sheets are gone.
    expect(await snapshotSeqs()).toEqual([40, 41, 42]);
    expect(await sheetKeys()).toEqual([
      [2, 1],
      [2, 2],
    ]);
    const reopened = await store().openCareer(SAMPLE_CAREER_ID);
    expect(reopened.ok && reopened.value.save).toEqual(atRound(2, 2));
    expect(reopened.ok && reopened.value.skipped).toEqual([]);
  }, 120_000);
});

describe('T-072: the exported file keeps its gzip', () => {
  it('encodeSave gives a real gzip (1f 8b) that inflates and decodes back to the same save', async () => {
    const save = atRound(5);
    const encoded = await mustEncode(save);
    expect([encoded.gzip[0], encoded.gzip[1]]).toEqual([0x1f, 0x8b]);
    expect(encoded.gzip.byteLength).toBeLessThan(encoded.bytes);
    const inflated = await gunzip(encoded.gzip, encoded.bytes);
    expect(inflated.ok && inflated.value.byteLength).toBe(encoded.bytes);
    const decoded = await decodeSave(encoded.gzip, encoded.sha256, encoded.bytes);
    expect(decoded.ok && decoded.value).toEqual(save);
    // And what it gives is a save the import path accepts.
    expect(parseCareerSave(decoded.ok ? decoded.value : undefined, { check: 'full' }).ok).toBe(
      true,
    );
  });

  it('the snapshot of the device is not a gzip, while the same save exported is', async () => {
    const save = atRound(3);
    written(await store().writeSnapshot(save));
    const db = await raw();
    const record = await db.get('snapshots', [SAMPLE_CAREER_ID, 1]);
    db.close();
    expect([record!.blob[0], record!.blob[1]]).not.toEqual([0x1f, 0x8b]);
    expect(record!.blob[0]).toBe(0x7b); // "{"
    const exported = await mustEncode(save);
    expect(exported.gzip[0]).toBe(0x1f);
  });
});

describe('T-072: a tampered snapshot is skipped and nothing is changed', () => {
  async function three(s: ReturnType<typeof store>) {
    for (const round of [4, 5, 6]) await s.writeSnapshot(variant(round));
  }

  it.each([
    [
      'two different bytes swapped (same size, same multiset)',
      (r: { blob: Uint8Array<ArrayBuffer> }) => {
        const blob = r.blob.slice();
        const i = blob.findIndex((b, k) => k > 0 && b !== blob[0]);
        const first = blob[0]!;
        blob[0] = blob[i]!;
        blob[i] = first;
        return { ...r, blob };
      },
      'hash-mismatch',
    ],
    [
      'a byte replaced by another, same length',
      (r: { blob: Uint8Array<ArrayBuffer> }) => {
        const blob = r.blob.slice();
        blob[100] = blob[100] === 0x20 ? 0x21 : 0x20;
        return { ...r, blob };
      },
      'hash-mismatch',
    ],
    [
      'a size one byte too big (hash right)',
      (r: { bytes: number }) => ({ ...r, bytes: r.bytes + 1 }),
      'size-mismatch',
    ],
    [
      'a size one byte too small (hash right)',
      (r: { bytes: number }) => ({ ...r, bytes: r.bytes - 1 }),
      'size-mismatch',
    ],
  ])(
    'skips a newest snapshot with %s, opens the previous, and opening writes nothing',
    async (_l, change, problem) => {
      const s = store();
      await three(s);
      await tamper(3, change as never);
      const before = await allRows();
      const opened = await s.openCareer(SAMPLE_CAREER_ID);
      if (!opened.ok) throw new Error(opened.error);
      expect(opened.value.seq).toBe(2);
      expect(opened.value.skipped).toEqual([{ seq: 3, problem }]);
      expect(await allRows()).toEqual(before);
    },
  );

  it.each([
    ['valid JSON that is not a save (an empty object)', '{}', 'unknown-version'],
    ['valid JSON that is not an object', '[1,2,3]', 'unknown-version'],
    ['bytes that are not JSON', 'not json at all', 'corrupt-json'],
    ['invalid UTF-8 inside', '\u0000', 'corrupt-json'],
  ])('skips a snapshot whose hash and size were recomputed over %s', async (_l, text, problem) => {
    const s = store();
    await three(s);
    const blob = new TextEncoder().encode(text);
    const sha256 = await sha256Hex(blob);
    await tamper(3, (r) => ({ ...r, blob, sha256, bytes: blob.byteLength }));
    const before = await allRows();
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    if (!opened.ok) throw new Error(opened.error);
    expect(opened.value.seq).toBe(2);
    expect(opened.value.skipped).toEqual([{ seq: 3, problem }]);
    expect(await allRows()).toEqual(before);
  });

  it('skips a snapshot of invalid UTF-8 bytes with a recomputed hash', async () => {
    const s = store();
    await three(s);
    const blob = new Uint8Array([0x7b, 0xc3, 0x28, 0x7d]) as Uint8Array<ArrayBuffer>; // "{", bad sequence, "}"
    const sha256 = await sha256Hex(blob);
    await tamper(3, (r) => ({ ...r, blob, sha256, bytes: blob.byteLength }));
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok && opened.value.skipped).toEqual([{ seq: 3, problem: 'corrupt-json' }]);
  });

  it('with all three tampered, answers all-corrupt and still lists and deletes the career', async () => {
    const s = store();
    await three(s);
    for (const seq of [1, 2, 3]) await tamper(seq, (r) => ({ ...r, bytes: r.bytes + 1 }));
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    expect(!opened.ok && opened.error).toBe('all-corrupt');
    expect(await snapshotSeqs()).toEqual([1, 2, 3]);
  });
});

describe('T-072: prune by the season index across a fallback over the turn', () => {
  it('going back over the turn deletes no sheet that a kept snapshot needs', async () => {
    const s = store();
    let w = written(await s.writeSnapshot(atRound(38))); // seq 1, season 1
    w = written(await s.writeSnapshot(atRound(0, 2), w.sheets)); // seq 2, season 2
    written(await s.writeSnapshot(atRound(1, 2), w.sheets)); // seq 3, season 2
    await tamper(3, (r) => ({ ...r, bytes: r.bytes + 1 }));
    await tamper(2, (r) => ({ ...r, bytes: r.bytes + 1 }));
    const back = await s.openCareer(SAMPLE_CAREER_ID);
    if (!back.ok) throw new Error(back.error);
    expect(back.value).toMatchObject({ seq: 1, missingSheetRounds: [] });
    // Playing on from season 1 (round 38 again) keeps every row of season 1.
    written(await s.writeSnapshot(atRound(38), back.value.sheets));
    expect((await sheetKeys()).filter(([sn]) => sn === 1)).toHaveLength(38);
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok && opened.value.save).toEqual(atRound(38));
  });
});

describe('T-072: text past ASCII is stored and opened equal (UTF-8)', () => {
  const texts = ['Ação, coração e pão', 'Ünïcödé — “aspas” ’s', '日本語 ñ ß', '⚽ 🏆 🇧🇷 👨‍👩‍👧'];

  it.each(texts)(
    'the snapshot bytes are the UTF-8 of the JSON and decode back: %s',
    async (text) => {
      const save = {
        ...variant(1),
        career: { ...variant(1).career, coachName: text },
      } as CareerSave;
      const encoded = await mustEncodeSnapshot(save);
      expect(encoded.json).toEqual(new TextEncoder().encode(JSON.stringify(save)));
      expect(encoded.bytes).toBe(encoded.json.byteLength);
      expect(new TextDecoder('utf-8', { fatal: true }).decode(encoded.json)).toBe(
        JSON.stringify(save),
      );
      const exported = await mustEncode(save);
      const decoded = await decodeSave(exported.gzip, exported.sha256, exported.bytes);
      expect(decoded.ok && (decoded.value as CareerSave).career.coachName).toBe(text);
    },
  );

  it('a name with accents is stored by the store and reopens equal (also through a fallback)', async () => {
    const s = store();
    const name = 'Conceição Ávila Magalhães';
    const mk = (round: number) =>
      ({ ...variant(round), career: { ...variant(round).career, coachName: name } }) as CareerSave;
    written(await s.writeSnapshot(mk(1)));
    written(await s.writeSnapshot(mk(2), undefined, { expectedHeadSeq: 1 }));
    const db = await raw();
    const record = await db.get('snapshots', [SAMPLE_CAREER_ID, 2]);
    db.close();
    expect(record!.bytes).toBe(record!.blob.byteLength);
    expect(new TextDecoder().decode(record!.blob)).toContain(name);
    await tamper(2, (r) => ({ ...r, bytes: r.bytes + 1 }));
    const opened = await s.openCareer(SAMPLE_CAREER_ID);
    expect(opened.ok && opened.value.save).toEqual(mk(1));
  });
});
