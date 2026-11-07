import { describe, expect, it } from 'vitest';
import { store, useFreshDatabase } from '../save/testing/idb.ts';
import {
  ERROR_LOG_SIZE,
  ErrorLog,
  cleanDetail,
  cleanPath,
  cleanStack,
  cleanToken,
  errorType,
} from './log.ts';

/*
 * US-045: the local log has versions, screen, type and stack, never the nickname, the content of
 * a save or an exception's message; it keeps the newest 50 and makes no request.
 */

useFreshDatabase();

const VERSIONS = { appVersion: '0.0.1', schemaVersion: 1, engineVersion: 14 };
/** A nickname of one ASCII word: it passes any loose alphabet check, so only key lists stop it. */
const NICK = 'Zeca';
const UUID = '6f1c2a9e-3b7d-4c55-9a10-2b8e4f7d1c03';
const FIELDS = new Set([
  'career',
  'news',
  'vars',
  'club',
  'game',
  'players',
  'name',
  'display',
  'clubs',
  'def',
]);

describe('what a row keeps', () => {
  it('cleans codes to a closed alphabet', () => {
    expect(cleanToken('quota-exceeded')).toBe('quota-exceeded');
    expect(cleanToken('career.play')).toBe('career.play');
    expect(cleanToken('Zeca do Apito')).toBe('*');
    expect(cleanToken('x'.repeat(61))).toBe('*');
    expect(cleanToken(3)).toBe('*');
  });

  it('keeps only field names and indices of a path; record keys become *', () => {
    expect(cleanPath('career.news.3.vars.club', FIELDS)).toBe('career.news.3.vars.club');
    expect(cleanPath('game.players.flamingo-07.name.display', FIELDS)).toBe(
      'game.players.*.name.display',
    );
    expect(cleanPath('game.clubs.<key>.def', FIELDS)).toBe('game.clubs.*.def');
    // A record key of letters only is still a record key (security review LOW-2).
    expect(cleanPath('game.clubs.zeca.def', FIELDS)).toBe('game.clubs.*.def');
    expect(cleanPath(`career.${NICK}`, FIELDS)).toBe('career.*');
    expect(cleanPath('career.news', new Set())).toBe('*.*');
    expect(cleanPath('', FIELDS)).toBe('');
  });

  it('keeps flat numbers, booleans and codes of a detail, nothing nested nor free text', () => {
    expect(
      cleanDetail({
        problem: 'mismatch',
        rolledBack: false,
        seq: 3,
        name: NICK,
        careerId: UUID,
        coachName: NICK,
        nested: { coachName: NICK },
        list: [1, 2],
        nan: Number.NaN,
      }),
    ).toEqual({ problem: 'mismatch', rolledBack: false, seq: 3 });
    expect(cleanDetail('text')).toBeUndefined();
    expect(cleanDetail({ name: NICK })).toBeUndefined();
    expect(cleanDetail({ seq: UUID, problem: UUID })).toBeUndefined();
    expect(cleanDetail({ name: 'QuotaExceededError', problem: 'hash-mismatch' })).toEqual({
      name: 'QuotaExceededError',
      problem: 'hash-mismatch',
    });
    // Only the listed keys, whatever the value.
    expect(cleanDetail({ anything: 'write-failed', n: 3 })).toBeUndefined();
  });

  it('reads the type of an exception, never its message', () => {
    expect(errorType(new TypeError(NICK))).toBe('TypeError');
    expect(errorType('boom')).toBe('string');
    expect(errorType(undefined)).toBeUndefined();
  });

  it('reduces a V8 stack to its frames, without the message line', () => {
    const error = new Error(`${NICK}\n    at fake (http://x/${NICK}.js:1:1)`);
    error.stack = [
      `Error: ${NICK}`,
      '    at play (http://localhost:5173/jogo/src/lib/career/service.ts?t=1:120:15)',
      '    at async http://localhost:5173/jogo/assets/index-Ab12.js:3:9',
      '    at <anonymous>',
    ].join('\n');
    expect(cleanStack(error)).toEqual(['play@service.ts:120:15', '@index-Ab12.js:3:9']);
  });

  it('cuts a message of several lines that looks like frames before reading them', () => {
    const message = `${NICK}\n    at Fulano (https://x/a.js:1:2)`;
    const error = new Error(message);
    error.stack = `Error: ${message}\n    at real (http://x/assets/b.js:3:4)`;
    expect(cleanStack(error)).toEqual(['real@b.js:3:4']);
    // The same message where the stack does not start with it (a name changed later).
    error.stack = `Custom: ${message}\n    at real (http://x/assets/b.js:3:4)`;
    expect(cleanStack(error)).toEqual(['real@b.js:3:4']);
  });

  it('drops the head of a V8 stack even when it looks like a Firefox frame', () => {
    const error = new Error(`${NICK}@a.js:1:2`);
    error.name = '';
    error.stack = `${NICK}@a.js:1:2\n    at real (http://x/assets/b.js:3:4)`;
    expect(cleanStack(error)).toEqual(['real@b.js:3:4']);
    // A head with no message to match: still not a frame.
    expect(cleanStack({ stack: `${NICK}@c.js:5:6\n    at real (http://x/b.js:3:4)` })).toEqual([
      'real@b.js:3:4',
    ]);
  });

  it('reads the frames of Firefox and Safari', () => {
    const error = { stack: 'render@http://x/assets/App-1.js:10:4\n@http://x/a.js:1:2\n' };
    expect(cleanStack(error)).toEqual(['render@App-1.js:10:4', '@a.js:1:2']);
  });

  it('an entry has the versions, kind, code, screen, type and stack only', () => {
    const log = new ErrorLog(VERSIONS);
    const error = new RangeError(NICK);
    error.stack = `RangeError: ${NICK}\n    at draw (http://x/assets/Pitch.js:5:6)`;
    expect(log.entryOf({ kind: 'programming', code: 'unexpected', screen: 'club', error })).toEqual(
      {
        kind: 'programming',
        code: 'unexpected',
        screen: 'club',
        type: 'RangeError',
        stack: ['draw@Pitch.js:5:6'],
        ...VERSIONS,
      },
    );
  });

  it('a hostile error object never throws nor leaks', () => {
    const hostile = {
      get name(): string {
        throw new Error(NICK);
      },
      get stack(): string {
        throw new Error(NICK);
      },
    };
    const log = new ErrorLog(VERSIONS);
    const entry = log.entryOf({ kind: 'programming', code: 'unexpected', error: hostile });
    expect(JSON.stringify(entry)).not.toContain(NICK);
  });
});

describe('the ring', () => {
  it(`keeps the newest ${ERROR_LOG_SIZE} in the database, the oldest dropped`, async () => {
    const log = new ErrorLog(VERSIONS, store());
    for (let i = 0; i < ERROR_LOG_SIZE + 5; i++) {
      void log.record({ kind: 'storage', code: 'write-failed', detail: { seq: i } });
    }
    const rows = await log.list();
    expect(rows).toHaveLength(ERROR_LOG_SIZE);
    expect(rows[0]!.detail).toEqual({ seq: 5 });
    expect(rows.at(-1)!.detail).toEqual({ seq: ERROR_LOG_SIZE + 4 });
    expect(rows[0]).not.toHaveProperty('id');
  });

  it('survives a new session (the rows are in IndexedDB)', async () => {
    const s = store();
    await new ErrorLog(VERSIONS, s).record({ kind: 'storage', code: 'quota-exceeded' });
    const again = new ErrorLog(VERSIONS, s);
    expect((await again.list()).map((e) => e.code)).toEqual(['quota-exceeded']);
  });

  it('without IndexedDB keeps this session in memory, and never throws', async () => {
    (globalThis as { indexedDB?: unknown }).indexedDB = undefined;
    const log = new ErrorLog(VERSIONS, store());
    for (let i = 0; i < ERROR_LOG_SIZE + 2; i++) {
      await log.record({ kind: 'storage', code: 'storage-unavailable' });
    }
    expect(await log.list()).toHaveLength(ERROR_LOG_SIZE);
  });

  it('makes no network request', async () => {
    const calls: unknown[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = ((...args: unknown[]) => {
      calls.push(args);
      return Promise.reject(new Error('no network'));
    }) as typeof fetch;
    try {
      const log = new ErrorLog(VERSIONS, store());
      await log.record({ kind: 'programming', code: 'unexpected', error: new Error(NICK) });
      await log.list();
    } finally {
      globalThis.fetch = original;
    }
    expect(calls).toEqual([]);
  });
});
