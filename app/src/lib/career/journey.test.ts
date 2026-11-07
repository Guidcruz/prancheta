import { describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { ERROR_LOG_SIZE, ErrorLog, type ErrorEntry } from '../errors/index.ts';
import { SAVE_FIELD_NAMES, type CareerSave } from '../save/index.ts';
import { onPut, snapshotSeqs, store, useFreshDatabase, DB } from '../save/testing/idb.ts';
import { SAMPLE_CAREER_ID } from '../save/testing/sample.ts';
import { CareerService, roundBlock, type CareerSetup } from './service.ts';

/*
 * QA of T-023 (US-045, US-015): the player's journey through the CareerService over the real
 * SaveStore and fake-indexeddb, with the failures injected at the IndexedDB level (not by
 * replacing the store), and the privacy of the local log after each path.
 *
 * Already covered one by one in service.test.ts (guards, base, each code through a mocked
 * `writeSnapshot`, SHOULD 1/2 of the review) and log.test.ts (what a row keeps, ring, no
 * network); this file covers the whole flows: close and reopen equal, two tabs for real, a real
 * QuotaExceededError, a real VersionError, and a leak scan over the rows of every path.
 */

useFreshDatabase();

/** One ASCII word: a loose alphabet check would let it through, so only key lists stop it. */
const NICK = 'Zeca';
const CAREER_ID = SAMPLE_CAREER_ID;
const VERSIONS = { appVersion: '0.0.1', schemaVersion: 1, engineVersion: 1 };
const SETUP: CareerSetup = {
  coachName: NICK,
  clubId: 'flamingo',
  realism: 'full',
  matchMode: 'result',
};

interface Tab {
  readonly service: CareerService;
  readonly log: ErrorLog;
}

/** A "tab": its own store connection, log and service on the same database. */
function tab(): Tab {
  const s = store();
  const log = new ErrorLog(VERSIONS, s, { fields: SAVE_FIELD_NAMES });
  const service = new CareerService({
    store: s,
    log,
    appVersion: '0.0.1',
    now: () => new Date('2026-11-06T12:00:00.000Z'),
    newCareerId: () => CAREER_ID,
    newSeed: () => 2026,
  });
  return { service, log };
}

async function created(t: Tab = tab()): Promise<Tab> {
  const result = await t.service.create(SETUP);
  if (!result.ok) throw new Error(`create: ${result.error}`);
  return t;
}

async function playSaved(t: Tab, times: number): Promise<void> {
  for (let i = 0; i < times; i++) {
    const played = await t.service.playRound();
    if (!played.ok || !played.value.saved) throw new Error(`play: ${JSON.stringify(played)}`);
  }
}

const quota = () => {
  throw new DOMException('full', 'QuotaExceededError');
};

/** Every string a log row must never contain: the nickname, the id and the names in the save. */
function secretsOf(save: CareerSave): string[] {
  const names = new Set<string>([NICK, CAREER_ID, save.careerId]);
  for (const club of Object.values(save.game.clubs)) {
    names.add(club.def.name);
  }
  for (const player of Object.values(save.game.players) as unknown as {
    name?: { display?: string };
  }[]) {
    const display = player.name?.display;
    if (typeof display === 'string' && display.length >= 5) names.add(display);
  }
  return [...names];
}

function expectClean(entries: readonly ErrorEntry[], save: CareerSave): void {
  const text = JSON.stringify(entries);
  expect(secretsOf(save).length).toBeGreaterThan(20); // the nickname, the id, 20 clubs, players
  for (const secret of secretsOf(save)) expect(text, secret).not.toContain(secret);
  for (const entry of entries) {
    expect(Object.keys(entry).sort()).toEqual(
      expect.arrayContaining(['appVersion', 'code', 'engineVersion', 'kind', 'schemaVersion']),
    );
  }
}

describe('the leak scan can fail', () => {
  it('sees the nickname, a club name and the career id in a row', async () => {
    const t = await created();
    const save = get(t.service.state).save!;
    const base = {
      kind: 'storage',
      code: 'x',
      appVersion: '1',
      schemaVersion: 1,
      engineVersion: 1,
    };
    const club = Object.values(save.game.clubs)[0]!.def.name;
    for (const leak of [NICK, club, CAREER_ID]) {
      expect(() => expectClean([{ ...base, screen: leak } as ErrorEntry], save)).toThrow();
    }
    expect(() => expectClean([base as ErrorEntry], save)).not.toThrow();
  });
});

describe('journey: create, play, close and reopen (US-032 via the career layer)', () => {
  it('reopens in a new session with the very same career, then goes on from there', async () => {
    const first = await created();
    await playSaved(first, 5);
    const before = get(first.service.state).save!;
    expect(before.game.round).toBe(6);
    first.service.close();
    expect(get(first.service.state).status).toBe('closed');

    // A new session: another connection and another service over the same device.
    const second = tab();
    const listed = await second.service.list();
    expect(listed.ok && listed.value.map((c) => c.id)).toEqual([CAREER_ID]);
    expect(await second.service.open(CAREER_ID)).toEqual({ ok: true, value: undefined });
    const state = get(second.service.state);
    expect(state).toMatchObject({ status: 'open', busy: false, roundsLost: 0 });
    expect(state.save).toEqual(before);
    expect(roundBlock(state)).toBeUndefined();

    await playSaved(second, 2);
    expect(get(second.service.state).save!.game.round).toBe(8);
    expect(await snapshotSeqs()).toEqual([6, 7, 8]); // 3 versions kept (US-032)
    expect(await first.log.list()).toEqual([]);
  });
});

describe('journey: two tabs on the same career (CEO decision 3)', () => {
  it('the second tab to write gets conflict, ends on the full screen and the first goes on', async () => {
    const a = await created();
    const b = tab();
    await b.service.open(CAREER_ID);
    await playSaved(a, 1);

    const played = await b.service.playRound();
    expect(played).toMatchObject({ ok: true, value: { saved: false } });
    expect(get(b.service.state)).toMatchObject({
      status: 'fatal',
      fatal: { code: 'conflict', unsaved: true },
    });
    // Nothing of tab B reached the device; tab A is not affected.
    expect(await snapshotSeqs()).toEqual([1, 2]);
    await playSaved(a, 1);
    expect(await snapshotSeqs()).toEqual([1, 2, 3]);
    // Tab B cannot play or retry on this career any more.
    expect(await b.service.playRound()).toEqual({ ok: false, error: 'not-open' });
    expect(await b.service.retrySave()).toEqual({ ok: false, error: 'nothing-to-save' });

    const rows = await b.log.list();
    expect(rows.filter((e) => e.code === 'conflict')).toHaveLength(1);
    expectClean(rows, get(a.service.state).save!);
  });

  it('opening and doing nothing in the second tab is not a conflict', async () => {
    const a = await created();
    const b = tab();
    await b.service.open(CAREER_ID);
    await playSaved(a, 2);
    expect(get(b.service.state)).toMatchObject({ status: 'open', busy: false });
    expect(await b.log.list()).toEqual([]);
  });
});

describe('journey: a full disk (CEO decision 1)', () => {
  it('the round is not saved, play is blocked with the reason, "Tentar de novo" stores it', async () => {
    const t = await created();
    await playSaved(t, 1);
    onPut('snapshots', quota);
    const played = await t.service.playRound();
    expect(played).toMatchObject({ ok: true, value: { saved: false } });

    let state = get(t.service.state);
    expect(state).toMatchObject({ status: 'open', busy: false, unsaved: 'quota-exceeded' });
    expect(roundBlock(state)).toBe('unsaved');
    expect(await t.service.playRound()).toEqual({ ok: false, error: 'unsaved' });
    expect(await snapshotSeqs()).toEqual([1, 2]);

    // Still full: the retry fails the same way and nothing is lost nor duplicated.
    expect(await t.service.retrySave()).toMatchObject({ ok: false, error: 'quota-exceeded' });
    expect(get(t.service.state).unsaved).toBe('quota-exceeded');
    expect(await snapshotSeqs()).toEqual([1, 2]);

    // Space freed: the same round is stored once, and the block is gone.
    vi.restoreAllMocks();
    expect(await t.service.retrySave()).toEqual({ ok: true, value: undefined });
    state = get(t.service.state);
    expect(state.unsaved).toBeUndefined();
    expect(roundBlock(state)).toBeUndefined();
    expect(await snapshotSeqs()).toEqual([1, 2, 3]);
    await playSaved(t, 1);

    // After a reopen the career is at the round that was retried, plus the one played after.
    const again = tab();
    await again.service.open(CAREER_ID);
    expect(get(again.service.state).save!.game.round).toBe(4);

    const rows = await t.log.list();
    expect(rows.filter((e) => e.code === 'quota-exceeded')).toHaveLength(2);
    expect(rows.every((e) => e.kind === 'storage')).toBe(true);
    expectClean(rows, get(t.service.state).save!);
  });

  it('closing the game with the round unsaved loses only that round, and opens intact', async () => {
    const t = await created();
    await playSaved(t, 2);
    onPut('snapshots', quota);
    await t.service.playRound();
    vi.restoreAllMocks();
    t.service.close();

    const again = tab();
    await again.service.open(CAREER_ID);
    const state = get(again.service.state);
    expect(state).toMatchObject({ status: 'open', roundsLost: 0 });
    expect(state.save!.game.round).toBe(3);
  });
});

describe('journey: app-outdated (a newer build in another tab)', () => {
  /** Another tab of a newer build upgraded the database past the version this build knows. */
  async function newerBuildUpgraded(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB, 9999);
      request.onupgradeneeded = () => request.result.createObjectStore('future');
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  it('opening a career: the full screen code, nothing written, nothing thrown', async () => {
    await newerBuildUpgraded();
    const t = tab();
    expect(await t.service.open(CAREER_ID)).toMatchObject({ ok: false, error: 'app-outdated' });
    expect(get(t.service.state)).toMatchObject({
      status: 'fatal',
      busy: false,
      fatal: { code: 'app-outdated', unsaved: false },
    });
    expect((await t.log.list()).map((e) => e.code)).toContain('app-outdated');
  });

  it('creating a career: the full screen, not a banner; the career is not created', async () => {
    await newerBuildUpgraded();
    const t = tab();
    expect(await t.service.create(SETUP)).toMatchObject({ ok: false, error: 'app-outdated' });
    expect(get(t.service.state)).toMatchObject({
      status: 'fatal',
      busy: false,
      fatal: { code: 'app-outdated', unsaved: false },
    });
  });
});

describe('journey: rounds lost and bugs', () => {
  it('a damaged newest snapshot opens the previous one and tells how many rounds were lost', async () => {
    const t = await created();
    await playSaved(t, 3);
    // Damage the head without touching the others (flip the hash of the newest row).
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('snapshots', 'readwrite');
      const rows = tx.objectStore('snapshots');
      const all = rows.getAll();
      all.onsuccess = () => {
        const newest = (all.result as { seq: number; sha256: string }[]).sort(
          (x, y) => y.seq - x.seq,
        )[0]!;
        rows.put({ ...newest, sha256: 'f'.repeat(64) });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    const again = tab();
    await again.service.open(CAREER_ID);
    const state = get(again.service.state);
    expect(state).toMatchObject({ status: 'open', roundsLost: 1 });
    expect(state.save!.game.round).toBe(3);
    again.service.dismissRoundsLost();
    expect(get(again.service.state).roundsLost).toBe(0);
    // Playing on goes after the damaged head with the right guard (no conflict with itself).
    await playSaved(again, 1);
    const rows = await again.log.list();
    expect(rows.some((e) => e.code === 'snapshot-skipped')).toBe(true);
    expectClean(rows, state.save!);
  });

  it('an engine exception: not busy, the career before the round, the log has no message', async () => {
    const t = await created();
    const broken = new CareerService({
      store: store(),
      log: t.log,
      appVersion: '0.0.1',
      params: {} as never,
    });
    await broken.open(CAREER_ID);
    expect(await broken.playRound()).toEqual({ ok: false, error: 'unexpected' });
    expect(get(broken.state)).toMatchObject({ busy: false, crash: 'unexpected' });
    expect(get(broken.state).save!.game.round).toBe(1);
    // "Tentar de novo" brings the frame back; the saved career was not altered.
    broken.dismissCrash();
    expect(get(broken.state).crash).toBeUndefined();
    expect(await snapshotSeqs()).toEqual([1]);

    const rows = await t.log.list();
    const crash = rows.find((e) => e.screen === 'career.play');
    expect(crash).toMatchObject({ kind: 'programming', code: 'unexpected', type: 'TypeError' });
    expect(crash!.stack?.length ?? 0).toBeGreaterThan(0);
    expectClean(rows, get(t.service.state).save!);
  });
});

describe('the log across every path (US-045)', () => {
  it('after conflict, quota, a skipped snapshot and a crash, no row has personal data', async () => {
    const a = await created();
    await playSaved(a, 2);
    const b = tab();
    await b.service.open(CAREER_ID);
    await playSaved(a, 1);
    await b.service.playRound(); // conflict
    onPut('snapshots', quota);
    await a.service.playRound(); // quota-exceeded
    vi.restoreAllMocks();
    await a.service.retrySave();
    const broken = new CareerService({
      store: store(),
      log: a.log,
      appVersion: '0.0.1',
      params: {} as never,
    });
    await broken.open(CAREER_ID);
    await broken.playRound(); // engine exception

    const rows = await a.log.list();
    expect(rows.map((e) => e.code)).toEqual(
      expect.arrayContaining(['quota-exceeded', 'unexpected']),
    );
    expectClean(rows, get(a.service.state).save!);
    // The copy for support ("Copiar relatório") is the same rows.
    expectClean(await b.log.list(), get(a.service.state).save!);
  });

  it(`keeps only the newest ${ERROR_LOG_SIZE} rows when a stuck disk fails again and again`, async () => {
    const t = await created();
    onPut('snapshots', quota);
    await t.service.playRound();
    for (let i = 0; i < ERROR_LOG_SIZE + 10; i++) await t.service.retrySave();
    vi.restoreAllMocks();
    const rows = await t.log.list();
    expect(rows).toHaveLength(ERROR_LOG_SIZE);
    expect(rows.every((e) => e.code === 'quota-exceeded')).toBe(true);
    expectClean(rows, get(t.service.state).save!);
    // The player is still able to recover: the same round is stored once the disk has room.
    expect(await t.service.retrySave()).toEqual({ ok: true, value: undefined });
    expect(await snapshotSeqs()).toEqual([1, 2]);
  });
});
