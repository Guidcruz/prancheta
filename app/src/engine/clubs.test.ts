import { describe, expect, it } from 'vitest';
import {
  SERIE_A_CLUBS,
  DEFAULT_STRENGTH,
  STRENGTH_RANGE,
  validateClubs,
  type ClubIssue,
  type ClubsResult,
} from './clubs.ts';
import { SEASON_ROUNDS } from './params.ts';
import { syntheticClubs } from './testing/clubs.ts';

/*
 * The engine cannot import app/src/data/ (lint), so these tests use the synthetic clubs
 * `Clube Teste 01`... (US-001). app/src/data/ tests the blocklist, the shields and the real file.
 */
function issuesOf(result: ClubsResult): ClubIssue[] {
  if (result.ok) throw new Error('expected the club list to be refused');
  expect(result.error).toBe('invalid-clubs');
  return result.detail;
}

describe('validateClubs', () => {
  it('accepts 20 valid clubs and returns a fresh copy', () => {
    const raw = syntheticClubs();
    const result = validateClubs(raw);
    if (!result.ok) throw new Error(JSON.stringify(result.detail, null, 2));
    expect(result.value).toEqual(raw);
    expect(result.value[0]).not.toBe(raw[0]);
    expect(result.value[0]!.stadium).not.toBe(raw[0]!.stadium);
    expect(result.value[0]!.rivals).not.toBe(raw[0]!.rivals);
    expect(result.warnings).toEqual([]);
  });

  it('matches the season: 20 clubs play 38 rounds', () => {
    expect(SERIE_A_CLUBS).toBe(20);
    expect(2 * (SERIE_A_CLUBS - 1)).toBe(SEASON_ROUNDS);
  });

  it('accepts clubs without rivals, aiProfile or strength', () => {
    const raw = syntheticClubs();
    const loner = raw[19]!;
    expect(loner.rivals).toEqual([]);
    delete loner.aiProfile;
    delete loner.strength;
    const result = validateClubs(raw);
    if (!result.ok) throw new Error(JSON.stringify(result.detail, null, 2));
    expect(result.value[19]).not.toHaveProperty('aiProfile');
    // docs/design/clubes-serie-a.md, "Casos de borda": absent strength is 70, with a warning.
    expect(result.value[19]!.strength).toBe(DEFAULT_STRENGTH);
    expect(DEFAULT_STRENGTH).toBe(70);
    expect(result.warnings).toEqual([
      { code: 'club-strength-default', detail: { clubId: 'clube-teste-20' } },
    ]);
  });

  it('requires exactly 20 clubs', () => {
    expect(issuesOf(validateClubs(syntheticClubs(19)))).toEqual([
      { field: '', problem: 'club-count', value: 19, range: { min: 20, max: 20 } },
    ]);
    expect(issuesOf(validateClubs(syntheticClubs(21)))[0]).toMatchObject({
      problem: 'club-count',
      value: 21,
    });
    expect(validateClubs(syntheticClubs(4), { count: 4 }).ok).toBe(true);
  });

  it('refuses something that is not a list', () => {
    expect(issuesOf(validateClubs({ clubs: [] }))).toEqual([
      { field: '', problem: 'not-a-list', value: { clubs: [] } },
    ]);
    expect(issuesOf(validateClubs(null))[0]!.problem).toBe('not-a-list');
  });

  it.each([
    'id',
    'name',
    'shortName',
    'abbreviation',
    'nickname',
    'city',
    'state',
    'colors',
    'size',
    'stadium',
    'rivals',
    'titles',
  ] as const)('names the club and the field when %s is missing', (field) => {
    const raw = syntheticClubs();
    delete (raw[3] as Partial<(typeof raw)[number]>)[field];
    const issues = issuesOf(validateClubs(raw));
    expect(issues).toContainEqual(
      field === 'id'
        ? { index: 3, field, problem: 'missing' }
        : { index: 3, clubId: 'clube-teste-04', field, problem: 'missing' },
    );
  });

  it('names stadium.name and stadium.capacity when missing', () => {
    const raw = syntheticClubs();
    raw[5]!.stadium = {} as { name: string; capacity: number };
    const issues = issuesOf(validateClubs(raw));
    expect(issues).toEqual([
      { index: 5, clubId: 'clube-teste-06', field: 'stadium.name', problem: 'missing' },
      { index: 5, clubId: 'clube-teste-06', field: 'stadium.capacity', problem: 'missing' },
    ]);
  });

  it('refuses empty and non-string text fields', () => {
    const raw = syntheticClubs();
    raw[0]!.name = '   ';
    (raw[1] as { nickname: unknown }).nickname = 7;
    raw[2]!.stadium.name = '';
    const issues = issuesOf(validateClubs(raw));
    expect(issues).toEqual([
      { index: 0, clubId: 'clube-teste-01', field: 'name', problem: 'empty', value: '   ' },
      { index: 1, clubId: 'clube-teste-02', field: 'nickname', problem: 'not-a-string', value: 7 },
      { index: 2, clubId: 'clube-teste-03', field: 'stadium.name', problem: 'empty', value: '' },
    ]);
  });

  it('refuses unknown keys, so a typo is never silently ignored', () => {
    const raw = syntheticClubs();
    (raw[0] as Record<string, unknown>).nickName = 'x';
    (raw[0]!.stadium as Record<string, unknown>).city = 'y';
    expect(issuesOf(validateClubs(raw))).toEqual([
      {
        index: 0,
        clubId: 'clube-teste-01',
        field: 'nickName',
        problem: 'unknown-key',
        value: 'x',
      },
      {
        index: 0,
        clubId: 'clube-teste-01',
        field: 'stadium.city',
        problem: 'unknown-key',
        value: 'y',
      },
    ]);
  });

  it('refuses invalid id, state, colours, size and profile', () => {
    const raw = syntheticClubs();
    (raw[0] as { id: string }).id = 'Clube Teste';
    raw[1]!.state = 'sp';
    raw[2]!.colors = ['#12345', 'red'];
    (raw[3] as { size: string }).size = 'huge';
    (raw[4] as { aiProfile: string }).aiProfile = 'lazy';
    (raw[5] as { colors: unknown }).colors = ['#123456'];
    const problems = issuesOf(validateClubs(raw)).map((i) => [i.index, i.field, i.problem]);
    expect(problems).toEqual(
      expect.arrayContaining([
        [0, 'id', 'invalid-id'],
        [1, 'state', 'invalid-state'],
        [2, 'colors.0', 'invalid-color'],
        [2, 'colors.1', 'invalid-color'],
        [3, 'size', 'invalid-size'],
        [4, 'aiProfile', 'invalid-ai-profile'],
        [5, 'colors', 'not-a-list'],
      ]),
    );
  });

  it('keeps strength in 55..85, whatever the size', () => {
    expect(STRENGTH_RANGE).toEqual({ min: 55, max: 85 });
    const raw = syntheticClubs();
    raw[0]!.strength = 55; // big at the bottom edge: valid
    raw[19]!.strength = 85; // small at the top edge: valid
    raw[6]!.strength = 54;
    raw[7]!.strength = 86;
    raw[8]!.strength = Number.NaN;
    expect(issuesOf(validateClubs(raw))).toEqual([
      {
        index: 6,
        clubId: 'clube-teste-07',
        field: 'strength',
        problem: 'out-of-range',
        value: 54,
        range: { min: 55, max: 85 },
      },
      {
        index: 7,
        clubId: 'clube-teste-08',
        field: 'strength',
        problem: 'out-of-range',
        value: 86,
        range: { min: 55, max: 85 },
      },
      {
        index: 8,
        clubId: 'clube-teste-09',
        field: 'strength',
        problem: 'not-a-number',
        value: Number.NaN,
      },
    ]);
  });

  it('requires an integer strength', () => {
    const raw = syntheticClubs();
    raw[0]!.strength = 75.5;
    expect(issuesOf(validateClubs(raw))).toEqual([
      {
        index: 0,
        clubId: 'clube-teste-01',
        field: 'strength',
        problem: 'not-an-integer',
        value: 75.5,
      },
    ]);
  });

  it('requires a positive integer stadium capacity', () => {
    const raw = syntheticClubs();
    raw[0]!.stadium.capacity = 0;
    raw[1]!.stadium.capacity = 1500.5;
    (raw[2]!.stadium as { capacity: unknown }).capacity = '20000';
    const problems = issuesOf(validateClubs(raw)).map((i) => [i.clubId, i.field, i.problem]);
    expect(problems).toEqual([
      ['clube-teste-01', 'stadium.capacity', 'out-of-range'],
      ['clube-teste-02', 'stadium.capacity', 'not-an-integer'],
      ['clube-teste-03', 'stadium.capacity', 'not-a-number'],
    ]);
  });

  it('requires a three-letter capital abbreviation, unique in the league', () => {
    const raw = syntheticClubs();
    raw[0]!.abbreviation = 'Tab';
    raw[1]!.abbreviation = 'TAAA';
    raw[9]!.abbreviation = 'TAC'; // same as clube-teste-03
    expect(issuesOf(validateClubs(raw))).toEqual([
      {
        index: 0,
        clubId: 'clube-teste-01',
        field: 'abbreviation',
        problem: 'invalid-abbreviation',
        value: 'Tab',
      },
      {
        index: 1,
        clubId: 'clube-teste-02',
        field: 'abbreviation',
        problem: 'invalid-abbreviation',
        value: 'TAAA',
      },
      {
        index: 9,
        clubId: 'clube-teste-10',
        field: 'abbreviation',
        problem: 'duplicate-abbreviation',
        value: 'TAC',
        other: 'clube-teste-03',
      },
    ]);
  });

  it('requires titles as integers of at least 0, zero included', () => {
    const raw = syntheticClubs();
    const zero = { league: 0, cup: 0, libertadores: 0, sudamericana: 0 };
    raw[0]!.titles = { ...zero };
    raw[1]!.titles = { ...zero, league: -1, cup: 1.5 };
    (raw[2] as { titles: unknown }).titles = { league: 2, cup: 1 };
    (raw[3] as { titles: unknown }).titles = { ...zero, recopa: 1 };
    (raw[4] as { titles: unknown }).titles = 3;
    raw[5]!.titles = { ...zero, libertadores: -2, sudamericana: '1' as unknown as number };
    const problems = issuesOf(validateClubs(raw)).map((i) => [i.clubId, i.field, i.problem]);
    expect(problems).toEqual([
      ['clube-teste-02', 'titles.league', 'out-of-range'],
      ['clube-teste-02', 'titles.cup', 'not-an-integer'],
      ['clube-teste-03', 'titles.libertadores', 'missing'],
      ['clube-teste-03', 'titles.sudamericana', 'missing'],
      ['clube-teste-04', 'titles.recopa', 'unknown-key'],
      ['clube-teste-05', 'titles', 'not-an-object'],
      ['clube-teste-06', 'titles.libertadores', 'out-of-range'],
      ['clube-teste-06', 'titles.sudamericana', 'not-a-number'],
    ]);
  });

  it('refuses a duplicated id and names both positions', () => {
    const raw = syntheticClubs();
    raw[19]!.id = 'clube-teste-18';
    expect(issuesOf(validateClubs(raw))).toEqual([
      {
        index: 19,
        clubId: 'clube-teste-18',
        field: 'id',
        problem: 'duplicate-id',
        value: 'clube-teste-18',
        other: '#17',
      },
    ]);
  });

  it('refuses an asymmetric derby and names the pair', () => {
    const raw = syntheticClubs();
    raw[0]!.rivals.push('clube-teste-03'); // 03 lists only 04
    expect(issuesOf(validateClubs(raw))).toEqual([
      {
        index: 0,
        clubId: 'clube-teste-01',
        field: 'rivals.1',
        problem: 'asymmetric-rival',
        value: 'clube-teste-03',
        other: 'clube-teste-03',
      },
    ]);
  });

  it('refuses a rival that does not exist and names the pair', () => {
    const raw = syntheticClubs();
    raw[2]!.rivals.push('clube-fantasma');
    expect(issuesOf(validateClubs(raw))).toEqual([
      {
        index: 2,
        clubId: 'clube-teste-03',
        field: 'rivals.1',
        problem: 'unknown-rival',
        value: 'clube-fantasma',
        other: 'clube-fantasma',
      },
    ]);
  });

  it('refuses a club as its own rival, a repeated rival and an unreadable rival', () => {
    const raw = syntheticClubs();
    raw[16]!.rivals = ['clube-teste-17'];
    raw[0]!.rivals = ['clube-teste-02', 'clube-teste-02'];
    (raw[2]!.rivals as unknown[]) = ['clube-teste-04', 4];
    const problems = issuesOf(validateClubs(raw)).map((i) => [i.clubId, i.field, i.problem]);
    expect(problems).toEqual([
      ['clube-teste-01', 'rivals.1', 'duplicate-rival'],
      ['clube-teste-03', 'rivals.1', 'invalid-id'],
      ['clube-teste-17', 'rivals.0', 'self-rival'],
    ]);
  });

  it('lists every issue at once, including the cross-club ones of broken clubs', () => {
    const raw: unknown[] = syntheticClubs();
    const broken = raw[0] as Record<string, unknown>;
    delete broken.city;
    broken.rivals = ['clube-teste-02', 'clube-nenhum'];
    raw[7] = 'not a club';
    const issues = issuesOf(validateClubs(raw));
    expect(issues).toEqual([
      { index: 0, clubId: 'clube-teste-01', field: 'city', problem: 'missing' },
      { index: 7, field: '', problem: 'not-an-object', value: 'not a club' },
      {
        index: 0,
        clubId: 'clube-teste-01',
        field: 'rivals.1',
        problem: 'unknown-rival',
        value: 'clube-nenhum',
        other: 'clube-nenhum',
      },
      // 08 is gone, so 07 now names a club that does not exist.
      {
        index: 6,
        clubId: 'clube-teste-07',
        field: 'rivals.0',
        problem: 'unknown-rival',
        value: 'clube-teste-08',
        other: 'clube-teste-08',
      },
    ]);
  });

  it('never throws, whatever the input', () => {
    const holey: unknown[] = [];
    holey[1] = 'x';
    const inputs: unknown[] = [
      undefined,
      0,
      'x',
      [null],
      [[]],
      [{ id: 1, stadium: null, rivals: 'a', colors: null }],
      [{ ...syntheticClubs(1)[0], rivals: holey }],
      Object.assign([], { length: 3 }),
    ];
    for (const input of inputs) {
      expect(() => validateClubs(input)).not.toThrow();
      expect(validateClubs(input).ok).toBe(false);
    }
  });
});
