import { describe, expect, it } from 'vitest';
import type { CareerSave } from './schema.ts';
import { sampleCareerSave } from './testing/sample.ts';
import {
  SAVE_LIMITS,
  errorPath,
  parseCareerSave,
  parseRoundSheets,
  type SaveIssue,
} from './validate.ts';

/*
 * The strict schema (validate.ts; ADR-0006, "Importar nunca usa dado antes de passar pela
 * validação estrita"): what it accepts, and a hostile save in many forms, refused without
 * throwing and without the content in the error. The engine's output at every phase of a career
 * is in fixtures.test.ts.
 */

const save = sampleCareerSave({ rounds: 3 });
const COACH = 'Treinador Secreto';
const good: CareerSave = { ...save, career: { ...save.career, coachName: COACH } };
type Json = Record<string, unknown>;
const json = (): Json => JSON.parse(JSON.stringify(good)) as Json;
const playerId = Object.keys(good.game.players)[0]!;
const clubId = good.career.clubId;
const fixtureId = Object.keys(good.career.matchSheets)[0]!;
const otherClub = Object.keys(good.game.clubs).find((id) => id !== clubId)!;
const unplayed = good.game.fixtures.find((f) => f.result === undefined)!.id;
const REMOVE = Symbol('remove');

/** A copy of the good save with the value at the dotted `path` changed (or removed). */
function edit(path: string, change: (old: unknown) => unknown, s: Json = json()): Json {
  const keys = path.split('.');
  let node = s;
  for (const key of keys.slice(0, -1)) node = node[key] as Json;
  const last = keys.at(-1)!;
  const next = change(node[last]);
  if (next === REMOVE) delete node[last];
  else node[last] = next;
  return s;
}
const set = (path: string, value: unknown) => edit(path, () => value);

function refused(raw: unknown, options?: Parameters<typeof parseCareerSave>[1]): SaveIssue {
  const result = parseCareerSave(raw, options);
  if (result.ok) throw new Error('accepted');
  expect(result.error).toBe('invalid-save');
  // Never the content: the nickname typed by the player does not leave in an error.
  expect(JSON.stringify(result)).not.toContain(COACH);
  return result.detail as SaveIssue;
}

describe('a valid save', () => {
  it('passes in every check, as a copy with the same content', () => {
    for (const check of ['full', 'open', 'write'] as const) {
      const result = parseCareerSave(json(), { check, careerId: good.careerId });
      expect(result.ok, check).toBe(true);
      expect(result.ok && result.value).toEqual(good);
    }
  });

  it('accepts the optional fields absent (no round played yet, no recap)', () => {
    const fresh = sampleCareerSave({ rounds: 0 });
    expect(fresh.career.lastRound).toBeUndefined();
    expect(parseCareerSave(JSON.parse(JSON.stringify(fresh))).ok).toBe(true);
  });
});

describe('a hostile or broken save is refused, never thrown', () => {
  const event = 'career.lastRound.results.0.events.0';
  const player = `game.players.${playerId}`;
  const cases: [string, () => unknown, string, string][] = [
    ['not an object', () => 'save', '', 'strict_object'],
    ['a newer format', () => set('schemaVersion', 4), 'schemaVersion', 'literal'],
    ['an older format', () => set('schemaVersion', 2), 'schemaVersion', 'literal'],
    ['an unknown key at the top', () => set('extra', 1), 'extra', 'strict_object'],
    [
      'an unknown key in the career',
      () => set('career.admin', true),
      'career.admin',
      'strict_object',
    ],
    [
      'a required key missing',
      () => set('career.baseSeason', REMOVE),
      'career.baseSeason',
      'strict_object',
    ],
    [
      'an unknown key deep in an event',
      () => set(`${event}.script`, 'x'),
      `${event}.script`,
      'strict_object',
    ],
    ['a careerId that is not a UUID', () => set('careerId', '../etc'), 'careerId', 'uuid'],
    ['a date that is not ISO', () => set('updatedAt', 'yesterday'), 'updatedAt', 'iso_timestamp'],
    ['a paramsHash that is not a SHA-256', () => set('paramsHash', 'x'), 'paramsHash', 'regex'],
    [
      'a nickname past its bound',
      () => set('career.coachName', COACH.repeat(SAVE_LIMITS.coachNameLength)),
      'career.coachName',
      'max_length',
    ],
    ['an empty nickname', () => set('career.coachName', '   '), 'career.coachName', 'check'],
    [
      'an id past its bound',
      () => set('career.clubId', 'x'.repeat(SAVE_LIMITS.idLength + 1)),
      'career.clubId',
      'max_length',
    ],
    [
      'a memory of phrases past 200',
      () => edit('career.phraseMemory', (old) => [...(old as string[]), 'one-more']),
      'career.phraseMemory',
      'max_length',
    ],
    [
      'a news item with too many variables',
      () =>
        set(
          'career.news.0.vars',
          Object.fromEntries(
            Array.from({ length: SAVE_LIMITS.refVars + 1 }, (_, i) => [`v${i}`, i]),
          ),
        ),
      'career.news.0.vars',
      'max_entries',
    ],
    [
      'a variable that is an object',
      () => set('career.news.0.vars.round', { nested: [[[[1]]]] }),
      'career.news.0.vars.round',
      'union',
    ],
    [
      'a match mode out of the list',
      () => set('career.matchMode', 'turbo'),
      'career.matchMode',
      'picklist',
    ],
    [
      'a count that is negative',
      () => set('game.fixtures.0.result.attendance', -1),
      'game.fixtures.0.result.attendance',
      'min_value',
    ],
    ['a number given as text', () => set('game.season', '1'), 'game.season', 'number'],
    ['a round past the end of the season', () => set('game.round', 40), 'game.round', 'max_value'],
    [
      'an event of a type that does not exist',
      () => set(`${event}.type`, 'explosion'),
      `${event}.type`,
      'variant',
    ],
    [
      'a player that the engine refuses (overall not of the attributes)',
      () => edit(`${player}.overall`, (old) => (old as number) + 1),
      player,
      'custom',
    ],
    [
      'a player with a field the engine does not know',
      () => set(`${player}.admin`, true),
      player,
      'custom',
    ],
    ['a face past its bound', () => set(`${player}.face`, 'x'.repeat(1000)), player, 'custom'],
    [
      'a player without the secondary position of v3 (ADR-0022)',
      () => set(`${player}.secondaryPosition`, REMOVE),
      player,
      'custom',
    ],
    [
      'a player whose secondary position is the goal',
      () => set(`${player}.secondaryPosition`, 'GK'),
      player,
      'custom',
    ],
    [
      'a club list the engine refuses (a club missing)',
      () => set(`game.clubs.${otherClub}`, REMOVE),
      'game.clubs',
      'check',
    ],
    [
      'a club definition with a field the data never has',
      () => set(`game.clubs.${clubId}.def.sponsor`, 'x'),
      'game.clubs',
      'check',
    ],
    [
      'a player name of 1 MB',
      () => set(`${player}.name.display`, 'x'.repeat(1 << 20)),
      player,
      'custom',
    ],
    [
      'a club name of 1 MB',
      () => set(`game.clubs.${clubId}.def.name`, 'x'.repeat(1 << 20)),
      'game.clubs',
      'check',
    ],
    [
      'a nickname with a right-to-left override',
      () => set('career.coachName', 'Treinador\u202Eodanierb'),
      'career.coachName',
      'check',
    ],
    [
      'a control character in a news variable',
      () => set('career.news.0.vars.club', 'Flamingo\u0007'),
      'career.news.0.vars.club',
      'check',
    ],
    [
      'zalgo in a player name',
      () => set(`${player}.name.full`, 'Jo\u0301\u0302\u0303ao Silva'),
      player,
      'custom',
    ],
    [
      'a zero-width space in a stadium',
      () => set(`game.clubs.${clubId}.def.stadium.name`, 'Est\u200Bádio'),
      'game.clubs',
      'check',
    ],
    [
      'a club city not in NFC',
      () => set(`game.clubs.${clubId}.def.city`, 'Sa\u0303o Paulo'),
      'game.clubs',
      'check',
    ],
    [
      'too many sheets for a season',
      () =>
        edit('career.matchSheets', (old) => {
          const sheets = old as Json;
          for (let i = 0; i < 400; i++) sheets[`x${i}`] = sheets[fixtureId];
          return sheets;
        }),
      'career.matchSheets',
      'max_entries',
    ],
  ];

  it.each(cases)('%s', (_label, change, path, problem) => {
    expect(refused(change())).toEqual({ path, problem });
  });

  it('refuses a key that could reach a prototype, at any depth (full check)', () => {
    const text = JSON.stringify(good);
    for (const hostile of [
      text.replace('"career":{', '"career":{"__proto__":{"admin":true},'),
      text.replace(`"${playerId}":{`, `"constructor":{"x":1},"${playerId}":{`),
      text.replace('"vars":{', '"vars":{"prototype":1,'),
      // Names of Object.prototype members pass valibot's strict object as known keys.
      text.replace('"career":{', '"career":{"toString":"x",'),
      text.replace(`"${playerId}":{`, `"valueOf":{"x":1},"${playerId}":{`),
      text.replace('"vars":{', '"vars":{"hasOwnProperty":1,'),
    ]) {
      expect(hostile).not.toBe(text);
      expect(refused(JSON.parse(hostile))).toEqual({ path: '', problem: 'forbidden-key' });
    }
  });

  it('refuses a prototype key in what the application layer builds, also when writing', () => {
    for (const path of [
      'career.news.0.vars.constructor',
      'career.social.0.toString',
      'career.valueOf',
      '__defineGetter__',
    ]) {
      const hostile = set(path, 1);
      expect(refused(hostile, { check: 'write' }), path).toEqual({
        path: '',
        problem: 'forbidden-key',
      });
      expect(refused(hostile, { check: 'full' }).problem, path).toBe('forbidden-key');
    }
  });

  it('refuses a getter that throws, or a Proxy, as unreadable instead of throwing', () => {
    const trap = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error('trap');
        },
      },
    );
    expect(refused(trap)).toEqual({ path: '', problem: 'unreadable' });
    const getter = json();
    Object.defineProperty(getter.career, 'coachName', {
      enumerable: true,
      get: () => {
        throw new Error('getter');
      },
    });
    expect(refused(getter).problem).toBe('unreadable');
  });

  it('refuses a deeply nested value without exhausting the stack', () => {
    let deep: unknown = 1;
    for (let i = 0; i < 100_000; i++) deep = [deep];
    expect(refused(set('career.news.0.vars.round', deep)).problem).toBeTypeOf('string');
  });

  it('refuses a huge list fast, at its bound', () => {
    const news = Array.from({ length: SAVE_LIMITS.refs + 1 }, () => good.career.news[0]);
    const started = performance.now();
    expect(refused(set('career.news', news))).toEqual({
      path: 'career.news',
      problem: 'max_length',
    });
    expect(performance.now() - started).toBeLessThan(2_000);
  });
});

describe('the path of an error (security review L1)', () => {
  it('cuts each segment to 40 and the path to 200, and hides an unsafe key', () => {
    expect(errorPath(['game', 'players', 'x'.repeat(100), 'age'])).toBe(
      `game.players.${'x'.repeat(40)}.age`,
    );
    expect(errorPath(['a\u202Eb', 'c\u0000', 'd.e', '', 3, null])).toBe(
      '<key>.<key>.<key>.<key>.3.<key>',
    );
    expect([...errorPath(Array.from({ length: 20 }, () => 'y'.repeat(40)))]).toHaveLength(200);
  });

  it('a hostile key reaches the error only in that form', () => {
    expect(refused(set('\u202Eevil', 1))).toEqual({ path: '<key>', problem: 'strict_object' });
    expect(refused(set('k'.repeat(300), 1))).toEqual({
      path: 'k'.repeat(40),
      problem: 'strict_object',
    });
  });
});

describe('coherence: what the save refers to exists', () => {
  it.each<[string, () => unknown, string, string]>([
    [
      'the coach club is not in the state',
      () => set('career.clubId', 'no-such-club'),
      'career.clubId',
      'unknown-club',
    ],
    [
      'a player is kept under another id',
      () =>
        edit('game.players', (old) => ({ ...(old as Json), 'someone#1': (old as Json)[playerId] })),
      'game.players.someone#1.id',
      'key-mismatch',
    ],
    [
      'a squad lists a player that does not exist',
      () => set(`game.squads.${clubId}.0`, `${clubId}#999`),
      `game.squads.${clubId}.0`,
      'unknown-player',
    ],
    [
      'a sheet of a match not played',
      () =>
        set(`career.matchSheets.${unplayed}`, {
          ...good.career.matchSheets[fixtureId],
          fixtureId: unplayed,
        }),
      `career.matchSheets.${unplayed}`,
      'unknown-fixture',
    ],
    [
      'the year is not the base season (D4)',
      () => set('career.baseSeason', 2030),
      'game.year',
      'base-season-mismatch',
    ],
  ])('refuses when %s', (_label, change, path, problem) => {
    expect(refused(change())).toEqual({ path, problem });
  });

  it('refuses the save of another career when one is asked for', () => {
    const other = '00000000-0000-4000-8000-0000000000ff';
    expect(refused(json(), { careerId: other })).toEqual({
      path: 'careerId',
      problem: 'other-career',
    });
  });
});

describe('the lighter checks', () => {
  it('writing reads the envelope and the career strictly, not the content of the state', () => {
    const broken = edit(`game.players.${playerId}.overall`, (old) => (old as number) + 1);
    expect(parseCareerSave(broken, { check: 'write' }).ok).toBe(true);
    expect(refused(set('extra', 1), { check: 'write' })).toEqual({
      path: 'extra',
      problem: 'strict_object',
    });
    expect(refused(set('career.clubId', 'no-such-club'), { check: 'write' })).toEqual({
      path: 'career.clubId',
      problem: 'unknown-club',
    });
    // The base season is the application layer's: the write checks it as the opening does.
    expect(refused(set('career.baseSeason', 2030), { check: 'write' })).toEqual({
      path: 'game.year',
      problem: 'base-season-mismatch',
    });
  });

  it('opening trusts the content of the sheets (checked when written), not their place', () => {
    const extra = set(`career.matchSheets.${fixtureId}.events.0.script`, 'x');
    expect(parseCareerSave(extra, { check: 'open' }).ok).toBe(true);
    expect(refused(extra, { check: 'full' }).problem).toBe('strict_object');
    const moved = set(`career.matchSheets.${fixtureId}.fixtureId`, 'elsewhere');
    expect(refused(moved, { check: 'open' }).problem).toBe('unknown-fixture');
  });

  it('opening does not search for prototype keys, and its output never carries one', () => {
    const hostile = JSON.parse(
      JSON.stringify(good).replace('"career":{', '"career":{"__proto__":{"admin":true},'),
    ) as Json;
    expect(Object.hasOwn(hostile.career as Json, '__proto__')).toBe(true);
    const opened = parseCareerSave(hostile, { check: 'open' });
    if (!opened.ok) throw new Error('refused');
    expect(Object.hasOwn(opened.value.career, '__proto__')).toBe(false);
    expect(Object.getPrototypeOf(opened.value.career)).toBe(Object.prototype);
    expect((opened.value.career as unknown as Json).admin).toBeUndefined();
  });

  it('a row of sheets is checked in full, with each key its own fixture', () => {
    const row = { [fixtureId]: good.career.matchSheets[fixtureId] };
    expect(parseRoundSheets(JSON.parse(JSON.stringify(row)))).toEqual({ ok: true, value: row });
    expect(parseRoundSheets({ other: row[fixtureId] })).toMatchObject({
      ok: false,
      detail: { path: 'other', problem: 'key-mismatch' },
    });
    expect(parseRoundSheets(JSON.parse(`{"__proto__":{"x":1}}`))).toMatchObject({
      ok: false,
      detail: { problem: 'forbidden-key' },
    });
    expect(parseRoundSheets('row')).toMatchObject({ ok: false, error: 'invalid-save' });
  });
});
