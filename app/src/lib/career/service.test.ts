import { describe, expect, it, vi, type MockInstance } from 'vitest';
import { get } from 'svelte/store';
import { ErrorLog, type ErrorEntry } from '../errors/index.ts';
import {
  SAVE_FIELD_NAMES,
  SAVE_SCHEMA_VERSION,
  parseCareerSave,
  type CareerSave,
  type SaveStore,
  type SheetIndex,
  type WriteError,
} from '../save/index.ts';
import {
  mustEncodeSnapshot,
  snapshotSeqs,
  store,
  tamper,
  useFreshDatabase,
} from '../save/testing/idb.ts';
import { SAMPLE_CAREER_ID, careerIdOf } from '../save/testing/sample.ts';
import type { GameParams, IdentitySource } from '../../engine/index.ts';
import {
  CareerService,
  roundBlock,
  type CareerServiceOptions,
  type CareerSetup,
} from './service.ts';

/*
 * The CareerService over the real SaveStore and fake-indexeddb (T-023; docs/02-architecture.md,
 * 4.2): every write carries the `expectedHeadSeq` guard, the `base` goes back as the very value
 * the store returned, every save handed to the store passes the `full` schema, each code of the
 * store is handled, an unsaved round blocks the next one, a snapshot of the current format skipped
 * by `invalid-save` becomes a programming error in the log, and the nickname is checked.
 */

useFreshDatabase();

/** One ASCII word: a loose alphabet check would let it through, so only key lists stop it. */
const COACH = 'Zeca';
const UUID = '6f1c2a9e-3b7d-4c55-9a10-2b8e4f7d1c03';
const VERSIONS = { appVersion: '0.0.1', schemaVersion: 1, engineVersion: 1 };
const SETUP: CareerSetup = {
  coachName: COACH,
  clubId: 'flamingo',
  realism: 'full',
  matchMode: 'result',
};

interface Harness {
  readonly service: CareerService;
  readonly store: SaveStore;
  readonly log: ErrorLog;
  readonly write: MockInstance<SaveStore['writeSnapshot']>;
  readonly entries: () => Promise<ErrorEntry[]>;
}

function harness(options: { careerId?: string; label?: string } = {}): Harness {
  const s = store();
  const log = new ErrorLog(VERSIONS, s, { fields: SAVE_FIELD_NAMES });
  const write = vi.spyOn(s, 'writeSnapshot');
  const service = new CareerService({
    store: s,
    log,
    appVersion: '0.0.1',
    now: () => new Date('2026-11-06T12:00:00.000Z'),
    newCareerId: () => options.careerId ?? SAMPLE_CAREER_ID,
    newSeed: () => 2026,
  });
  return { service, store: s, log, write, entries: () => log.list() };
}

/** Every call to `writeSnapshot` so far: its save, base and guard, and what it returned. */
async function writes(h: Harness) {
  return Promise.all(
    h.write.mock.calls.map(async ([save, base, guard], i) => ({
      save,
      base,
      guard,
      result: await h.write.mock.results[i]!.value,
    })),
  );
}

async function created(h: Harness = harness()): Promise<Harness> {
  const result = await h.service.create(SETUP);
  if (!result.ok) throw new Error(`create: ${result.error}`);
  return h;
}

async function playOk(h: Harness, times = 1): Promise<void> {
  for (let i = 0; i < times; i++) {
    const played = await h.service.playRound();
    if (!played.ok || !played.value.saved) throw new Error(`play: ${JSON.stringify(played)}`);
  }
}

const fail = (error: WriteError, detail?: unknown) =>
  Promise.resolve(
    detail === undefined ? { ok: false as const, error } : { ok: false as const, error, detail },
  );

describe('create (US-014)', () => {
  it('stores a new career with the guard 0, no base, and opens it at round 1', async () => {
    const h = await created();
    const state = get(h.service.state);
    expect(state).toMatchObject({ status: 'open', busy: false, roundsLost: 0 });
    expect(state.save?.game.round).toBe(1);
    expect(state.save?.career).toMatchObject({ coachName: COACH, clubId: 'flamingo' });
    const [first] = await writes(h);
    expect(first!.base).toBeUndefined();
    expect(first!.guard).toEqual({ expectedHeadSeq: 0 });
    expect(await snapshotSeqs()).toEqual([1]);
    expect(state.save?.paramsHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('normalises the nickname to NFC and trims it', async () => {
    const h = harness();
    const decomposed = `  Jose${String.fromCodePoint(0x301)}  `;
    expect(await h.service.create({ ...SETUP, coachName: decomposed })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(get(h.service.state).save?.career.coachName).toBe('José');
  });

  it.each([
    ['empty', '', 'coach-name-empty'],
    ['only spaces', '    ', 'coach-name-empty'],
    ['too long', 'x'.repeat(25), 'coach-name-too-long'],
    ['a right-to-left override', `ab${String.fromCodePoint(0x202e)}cd`, 'coach-name-unsafe'],
    ['a control character', `ab${String.fromCodePoint(0x7)}cd`, 'coach-name-unsafe'],
    ['a zero-width space', `ab${String.fromCodePoint(0x200b)}cd`, 'coach-name-unsafe'],
    ['zalgo', `x${String.fromCodePoint(0x301, 0x302, 0x303)}`, 'coach-name-unsafe'],
    ['a lone surrogate', `a${String.fromCharCode(0xd800)}`, 'coach-name-unsafe'],
  ])('refuses a nickname with %s and stores nothing', async (_label, coachName, error) => {
    const h = harness();
    expect(await h.service.create({ ...SETUP, coachName })).toEqual({ ok: false, error });
    expect(h.write).not.toHaveBeenCalled();
    expect(await h.service.list()).toEqual({ ok: true, value: [] });
    expect(get(h.service.state).status).toBe('closed');
  });

  it('refuses a club that is not in the latest set', async () => {
    const h = harness();
    expect(await h.service.create({ ...SETUP, clubId: 'no-such-club' })).toEqual({
      ok: false,
      error: 'unknown-club',
    });
    expect(h.write).not.toHaveBeenCalled();
  });

  it('answers unsupported-browser without a UUID source (not a secure context)', async () => {
    const s = store();
    const log = new ErrorLog(VERSIONS, s, { fields: SAVE_FIELD_NAMES });
    const service = new CareerService({
      store: s,
      log,
      appVersion: '0.0.1',
      newCareerId: () => undefined,
    });
    expect(await service.create(SETUP)).toEqual({ ok: false, error: 'unsupported-browser' });
    expect((await log.list()).map((e) => e.code)).toEqual(['unsupported-browser']);
  });

  it('returns career-limit to the screen, without logging it, and stays closed', async () => {
    const h = harness();
    h.write.mockImplementationOnce(() => fail('career-limit'));
    expect(await h.service.create(SETUP)).toEqual({ ok: false, error: 'career-limit' });
    expect(get(h.service.state).status).toBe('closed');
    expect(await h.entries()).toEqual([]);
  });

  it('a new career refused by app-outdated goes to the full screen', async () => {
    const h = harness();
    h.write.mockImplementationOnce(() => fail('app-outdated'));
    expect(await h.service.create(SETUP)).toMatchObject({ ok: false, error: 'app-outdated' });
    expect(get(h.service.state)).toMatchObject({
      status: 'fatal',
      fatal: { code: 'app-outdated', unsaved: false },
    });
  });
});

describe('every write carries the guard and the opaque base (4.2)', () => {
  it('playing rounds: expectedHeadSeq is the last seq and the base is the very value returned', async () => {
    const h = await created();
    await playOk(h, 3);
    const all = await writes(h);
    expect(all).toHaveLength(4);
    for (let i = 1; i < all.length; i++) {
      const previous = all[i - 1]!.result;
      if (!previous.ok) throw new Error('previous write failed');
      expect(all[i]!.guard).toEqual({ expectedHeadSeq: previous.value.seq });
      // The same object: the service hands it back without reading or copying it.
      expect(all[i]!.base).toBe(previous.value.sheets);
    }
    expect(await snapshotSeqs()).toEqual([2, 3, 4]);
    const state = get(h.service.state);
    expect(state.save?.game.round).toBe(4);
    expect(Object.keys(state.save?.career.matchSheets ?? {})).toHaveLength(30);
    expect(state.save?.career.lastRound?.round).toBe(3);
  });

  it('no write ever leaves without a guard, and every saved save passes the full schema', async () => {
    const h = await created();
    await playOk(h, 2);
    await h.service.open(SAMPLE_CAREER_ID);
    await playOk(h, 1);
    for (const { save, guard } of await writes(h)) {
      expect(guard).toEqual({ expectedHeadSeq: expect.any(Number) });
      const checked = parseCareerSave(save, { check: 'full', careerId: SAMPLE_CAREER_ID });
      expect(checked.ok, JSON.stringify(checked.ok ? '' : checked.detail)).toBe(true);
    }
  });

  it('after opening, the base is OpenedCareer.sheets and the guard its headSeq', async () => {
    const h = await created();
    await playOk(h, 2);
    const open = vi.spyOn(h.store, 'openCareer');
    await h.service.open(SAMPLE_CAREER_ID);
    const opened = await open.mock.results[0]!.value;
    if (!opened.ok) throw new Error(opened.error);
    await playOk(h, 1);
    const last = (await writes(h)).at(-1)!;
    expect(last.base).toBe(opened.value.sheets);
    expect(last.guard).toEqual({ expectedHeadSeq: opened.value.headSeq });
  });

  it('opening a fallback snapshot keeps the head as expectedHeadSeq and shows the rounds lost', async () => {
    const h = await created();
    await playOk(h, 2);
    await tamper(3, (r) => ({ ...r, sha256: 'f'.repeat(64) }));
    await h.service.open(SAMPLE_CAREER_ID);
    const state = get(h.service.state);
    expect(state).toMatchObject({ status: 'open', roundsLost: 1 });
    expect(state.save?.game.round).toBe(2);
    await playOk(h, 1);
    expect((await writes(h)).at(-1)!.guard).toEqual({ expectedHeadSeq: 3 });
    h.service.dismissRoundsLost();
    expect(get(h.service.state).roundsLost).toBe(0);
    expect((await h.entries()).map((e) => [e.kind, e.code, e.problem])).toContainEqual([
      'storage',
      'snapshot-skipped',
      'hash-mismatch',
    ]);
  });

  it('consumes the pending fan decision in the same snapshot as the round', async () => {
    const h = await created();
    const s = h.store;
    const save = get(h.service.state).save!;
    const pending: CareerSave = { ...save, career: { ...save.career, pendingFanDecision: 2 } };
    expect((await s.writeSnapshot(pending, undefined, { expectedHeadSeq: 1 })).ok).toBe(true);
    await h.service.open(SAMPLE_CAREER_ID);
    expect(get(h.service.state).save?.career.pendingFanDecision).toBe(2);
    await playOk(h, 1);
    const stored = (await writes(h)).at(-1)!.save;
    expect(stored.career.pendingFanDecision).toBe(0);
    expect(stored.game.round).toBe(2);
  });
});

describe('a round that was not saved blocks the next one (CEO decision 1)', () => {
  it.each<[WriteError, unknown]>([
    ['quota-exceeded', { name: 'QuotaExceededError' }],
    ['verify-failed', { problem: 'mismatch', rolledBack: true }],
    ['too-large', { bytes: 41_000_000 }],
    ['write-failed', { name: 'AbortError' }],
    ['read-failed', { name: 'UnknownError' }],
    ['storage-unavailable', { name: 'InvalidStateError' }],
  ])('%s: the round stays in memory, play is blocked, retry stores it', async (code, detail) => {
    const h = await created();
    h.write.mockImplementationOnce(() => fail(code, detail));
    const played = await h.service.playRound();
    expect(played).toMatchObject({ ok: true, value: { saved: false } });
    let state = get(h.service.state);
    expect(state).toMatchObject({ status: 'open', busy: false, unsaved: code });
    expect(state.save?.game.round).toBe(2);
    expect(roundBlock(state)).toBe('unsaved');
    expect(await h.service.playRound()).toEqual({ ok: false, error: 'unsaved' });
    expect(await snapshotSeqs()).toEqual([1]);

    expect(await h.service.retrySave()).toEqual({ ok: true, value: undefined });
    state = get(h.service.state);
    expect(state.unsaved).toBeUndefined();
    expect(roundBlock(state)).toBeUndefined();
    expect(await snapshotSeqs()).toEqual([1, 2]);
    const retried = (await writes(h)).at(-1)!;
    expect(retried.guard).toEqual({ expectedHeadSeq: 1 });
    expect(retried.save.game.round).toBe(2);
    const entry = (await h.entries()).find((e) => e.code === code);
    expect(entry).toMatchObject({ kind: 'storage', code, screen: 'career.play' });
    await playOk(h, 1);
  });

  it('verify-failed whose undo also failed: the retry expects the snapshot that stayed', async () => {
    const h = await created();
    h.write.mockImplementationOnce(() =>
      fail('verify-failed', { problem: 'mismatch', rolledBack: false }),
    );
    await h.service.playRound();
    h.write.mockImplementationOnce(() => fail('write-failed'));
    await h.service.retrySave();
    expect((await writes(h)).at(-1)!.guard).toEqual({ expectedHeadSeq: 2 });
  });

  it('retry with nothing to save does nothing', async () => {
    const h = await created();
    expect(await h.service.retrySave()).toEqual({ ok: false, error: 'nothing-to-save' });
    expect(h.write).toHaveBeenCalledTimes(1);
  });

  it('invalid-save on a write is a programming error with only the path and the kind', async () => {
    const h = await created();
    h.write.mockImplementationOnce(() =>
      fail('invalid-save', { path: 'career.news.0.vars.club', problem: 'max_length' }),
    );
    await h.service.playRound();
    expect(get(h.service.state).unsaved).toBe('invalid-save');
    expect((await h.entries()).at(-1)).toMatchObject({
      kind: 'programming',
      code: 'invalid-save',
      // `club` is a key of the `vars` record, not a field of the format: logged as `*`.
      path: 'career.news.0.vars.*',
      problem: 'max_length',
    });
  });

  it('a double tap plays one round', async () => {
    const h = await created();
    const [a, b] = await Promise.all([h.service.playRound(), h.service.playRound()]);
    expect([a.ok, b.ok]).toEqual([true, false]);
    expect(b).toEqual({ ok: false, error: 'busy' });
    expect(get(h.service.state).save?.game.round).toBe(2);
  });
});

describe('codes that end the career on this tab (CEO decision 3)', () => {
  it('conflict: another tab played the same career; nothing changes here', async () => {
    const one = await created();
    const two = harness();
    await two.service.open(SAMPLE_CAREER_ID);
    await playOk(one, 1);
    const played = await two.service.playRound();
    expect(played).toMatchObject({ ok: true, value: { saved: false } });
    expect(get(two.service.state)).toMatchObject({
      status: 'fatal',
      fatal: { code: 'conflict', unsaved: true },
    });
    expect(await snapshotSeqs()).toEqual([1, 2]);
    expect((await two.entries()).at(-1)).toMatchObject({
      code: 'conflict',
      detail: { expectedHeadSeq: 1, headSeq: 2 },
    });
    two.service.close();
    expect(get(two.service.state).status).toBe('closed');
  });

  it.each<WriteError>(['app-outdated', 'save-too-new', 'unsupported-browser'])(
    '%s on a write goes to the full screen',
    async (code) => {
      const h = await created();
      h.write.mockImplementationOnce(() => fail(code));
      await h.service.playRound();
      expect(get(h.service.state)).toMatchObject({
        status: 'fatal',
        fatal: { code, unsaved: true },
      });
      expect(await h.service.playRound()).toEqual({ ok: false, error: 'not-open' });
    },
  );
});

describe('open', () => {
  it('all-corrupt: the full screen, the career stays listed, each skip is logged', async () => {
    const h = await created();
    await playOk(h, 2);
    for (const seq of [1, 2, 3]) await tamper(seq, (r) => ({ ...r, sha256: 'f'.repeat(64) }));
    expect(await h.service.open(SAMPLE_CAREER_ID)).toMatchObject({
      ok: false,
      error: 'all-corrupt',
    });
    expect(get(h.service.state)).toMatchObject({
      status: 'fatal',
      fatal: { code: 'all-corrupt', unsaved: false },
    });
    const listed = await h.service.list();
    expect(listed.ok && listed.value.map((c) => c.id)).toEqual([SAMPLE_CAREER_ID]);
    const codes = (await h.entries()).map((e) => e.code);
    expect(codes.filter((c) => c === 'snapshot-skipped')).toHaveLength(3);
    expect(codes.at(-1)).toBe('all-corrupt');
  });

  it.each([
    ['not-found', 'closed'],
    ['save-too-new', 'closed'],
    ['unsupported-browser', 'closed'],
    ['storage-unavailable', 'closed'],
    ['read-failed', 'fatal'],
    ['app-outdated', 'fatal'],
  ] as const)('%s: %s', async (code, status) => {
    const h = harness();
    vi.spyOn(h.store, 'openCareer').mockResolvedValueOnce({ ok: false, error: code });
    expect(await h.service.open(SAMPLE_CAREER_ID)).toEqual({ ok: false, error: code });
    expect(get(h.service.state).status).toBe(status);
    expect((await h.entries()).at(-1)).toMatchObject({ kind: 'storage', code });
  });

  it('not-found for real', async () => {
    const h = harness();
    expect(await h.service.open(careerIdOf('nobody'))).toEqual({ ok: false, error: 'not-found' });
  });

  it('a snapshot of the current format skipped by invalid-save is a programming error, without content', async () => {
    const h = await created();
    await playOk(h, 2);
    const head = get(h.service.state).save!;
    const other = await mustEncodeSnapshot({ ...head, careerId: careerIdOf('another-career') });
    await tamper(3, (r) => ({ ...r, blob: other.json, sha256: other.sha256, bytes: other.bytes }));
    await h.service.open(SAMPLE_CAREER_ID);
    expect(get(h.service.state)).toMatchObject({ status: 'open', roundsLost: 1 });
    const entries = await h.entries();
    expect(entries).toContainEqual({
      kind: 'programming',
      code: 'invalid-save',
      screen: 'career.open',
      path: 'careerId',
      problem: 'other-career',
      detail: { seq: 3, fromVersion: SAVE_SCHEMA_VERSION },
      appVersion: '0.0.1',
      schemaVersion: 1,
      engineVersion: 1,
    });
    expect(JSON.stringify(entries)).not.toContain(COACH);
  });

  it('a migrated save is written again at once, with the base the opening returned', async () => {
    const h = await created();
    const sheets: SheetIndex = { season: 1, rounds: {} };
    const save = get(h.service.state).save!;
    vi.spyOn(h.store, 'openCareer').mockResolvedValueOnce({
      ok: true,
      value: {
        save,
        seq: 1,
        headSeq: 1,
        skipped: [],
        roundsLost: 0,
        fromVersion: 0,
        sheets,
        missingSheetRounds: [],
      },
    });
    await h.service.open(SAMPLE_CAREER_ID);
    const last = (await writes(h)).at(-1)!;
    expect(last.base).toBe(sheets);
    expect(last.guard).toEqual({ expectedHeadSeq: 1 });
    expect(await snapshotSeqs()).toEqual([1, 2]);
  });
});

describe('the log never has personal data (US-045)', () => {
  it('after failures of every kind, no row has the nickname or the save', async () => {
    const h = await created();
    for (const code of ['quota-exceeded', 'verify-failed', 'write-failed'] as const) {
      h.write.mockImplementationOnce(() =>
        fail(code, { name: COACH, problem: COACH, coachName: COACH, careerId: UUID, seq: UUID }),
      );
      await h.service.playRound();
      await h.service.retrySave();
    }
    const text = JSON.stringify(await h.entries());
    expect(text).not.toContain(COACH);
    expect(text).not.toContain(UUID);
    expect(text).not.toContain(SAMPLE_CAREER_ID);
  });
});

describe('delete and list', () => {
  it('removes a career and closes it when it is the open one', async () => {
    const h = await created();
    expect(await h.service.remove(SAMPLE_CAREER_ID)).toEqual({ ok: true, value: undefined });
    expect(get(h.service.state).status).toBe('closed');
    expect(await h.service.list()).toEqual({ ok: true, value: [] });
  });
});

describe('a bug never leaves the career busy (review SHOULD 1 and 2)', () => {
  /** A service over the same store whose engine throws: params the engine cannot read. */
  function broken(h: Harness, options: Partial<CareerServiceOptions> = {}): CareerService {
    return new CareerService({
      store: h.store,
      log: h.log,
      appVersion: '0.0.1',
      newCareerId: () => SAMPLE_CAREER_ID,
      newSeed: () => 2026,
      ...options,
    });
  }

  it('an exception of the engine while playing: logged, not busy, the frame shows the error', async () => {
    const h = await created();
    const service = broken(h, { params: {} as GameParams });
    await service.open(SAMPLE_CAREER_ID);
    expect(await service.playRound()).toEqual({ ok: false, error: 'unexpected' });
    const state = get(service.state);
    expect(state).toMatchObject({ status: 'open', busy: false, crash: 'unexpected' });
    expect(state.save?.game.round).toBe(1);
    expect((await h.entries()).at(-1)).toMatchObject({
      kind: 'programming',
      code: 'unexpected',
      screen: 'career.play',
      type: 'TypeError',
    });
    // Until "Tentar de novo", no round starts; afterwards the frame is back.
    expect(await service.playRound()).toEqual({ ok: false, error: 'unexpected' });
    service.dismissCrash();
    expect(get(service.state).crash).toBeUndefined();
    expect(await snapshotSeqs()).toEqual([1]);
  });

  it('an exception while opening: unexpected, closed, not busy, logged', async () => {
    const h = await created();
    vi.spyOn(h.store, 'openCareer').mockRejectedValueOnce(new TypeError('bug'));
    expect(await h.service.open(SAMPLE_CAREER_ID)).toEqual({ ok: false, error: 'unexpected' });
    expect(get(h.service.state)).toMatchObject({ status: 'closed', busy: false });
    expect((await h.entries()).at(-1)).toMatchObject({
      kind: 'programming',
      code: 'unexpected',
      screen: 'career.open',
      type: 'TypeError',
    });
  });

  it('an exception after the round was stored keeps the stored round in memory', async () => {
    const h = await created();
    let thrown = false;
    // A subscriber that throws once the stored round reaches the state (after the head moved).
    const stop = h.service.state.subscribe((state) => {
      if (!thrown && state.save?.game.round === 2 && !state.busy) {
        thrown = true;
        throw new Error('subscriber');
      }
    });
    expect(await h.service.playRound()).toEqual({ ok: false, error: 'unexpected' });
    stop();
    const state = get(h.service.state);
    expect(state).toMatchObject({ busy: false, crash: 'unexpected' });
    expect(state.save?.game.round).toBe(2);
    expect(await snapshotSeqs()).toEqual([1, 2]);
    // After "Tentar de novo" the next round is 2 → 3, written on top of the head.
    h.service.dismissCrash();
    await playOk(h, 1);
    expect((await writes(h)).at(-1)!.guard).toEqual({ expectedHeadSeq: 2 });
  });

  it('an exception while creating: logged, not busy, nothing stored', async () => {
    const h = harness();
    const throwing = new Proxy({} as IdentitySource, {
      get() {
        throw new RangeError('identity source');
      },
    });
    const service = broken(h, { identities: throwing });
    expect(await service.create(SETUP)).toEqual({ ok: false, error: 'unexpected' });
    expect(get(service.state)).toMatchObject({ status: 'closed', busy: false });
    expect(await service.list()).toEqual({ ok: true, value: [] });
    expect((await h.entries()).at(-1)).toMatchObject({
      code: 'unexpected',
      screen: 'career.create',
    });
  });

  it('a double tap on "Nova carreira" creates one career', async () => {
    const h = harness();
    const [a, b] = await Promise.all([h.service.create(SETUP), h.service.create(SETUP)]);
    expect([a.ok, b]).toEqual([true, { ok: false, error: 'busy' }]);
    expect(h.write).toHaveBeenCalledTimes(1);
  });

  it('a failed paramsHash is not kept: the next creation computes it again', async () => {
    const h = harness();
    const digest = vi
      .spyOn(globalThis.crypto.subtle, 'digest')
      .mockRejectedValueOnce(new Error('digest'));
    expect(await h.service.create(SETUP)).toEqual({ ok: false, error: 'unexpected' });
    expect(get(h.service.state).busy).toBe(false);
    expect(await h.service.create(SETUP)).toEqual({ ok: true, value: undefined });
    expect(digest.mock.calls.length).toBeGreaterThan(1);
    expect(get(h.service.state).save?.paramsHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('a store that throws on write keeps the round as unsaved, for "Tentar de novo"', async () => {
    const h = await created();
    h.write.mockImplementationOnce(() => Promise.reject(new Error('bug')));
    expect(await h.service.playRound()).toMatchObject({ ok: true, value: { saved: false } });
    expect(get(h.service.state)).toMatchObject({ busy: false, unsaved: 'write-failed' });
    expect(await h.service.retrySave()).toEqual({ ok: true, value: undefined });
  });
});
