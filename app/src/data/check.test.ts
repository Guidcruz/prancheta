import { describe, expect, it } from 'vitest';
import { syntheticClubs } from '../engine/testing/clubs.ts';
import { buildBlocklist } from './blocklist.ts';
import {
  checkClubData,
  formatClubIssues,
  renderClubShield,
  type ClubDataIssue,
  type ClubDataResult,
} from './check.ts';

/*
 * The scenarios of US-001 with synthetic clubs (`Clube Teste 01`...) and a blocklist of invented
 * names: the real names never appear in the repository, not even in tests.
 */
const blocklist = buildBlocklist([
  'Clube Proibido',
  'Arena Vetada',
  'Vetadinhos',
  'Proibidão',
  'zzq',
]);

function issuesOf(result: ClubDataResult): ClubDataIssue[] {
  if (result.ok) throw new Error('expected the club data to be refused');
  return result.issues;
}

describe('checkClubData (US-001)', () => {
  it('accepts 20 valid clubs with unique ids, every field and a shield each', () => {
    const result = checkClubData(syntheticClubs(), blocklist);
    if (!result.ok) throw new Error(formatClubIssues(result.issues));
    expect(result.clubs).toHaveLength(20);
    expect(new Set(result.clubs.map((c) => c.id)).size).toBe(20);
    for (const club of result.clubs) expect(renderClubShield(club)).toMatch(/^<svg .*<\/svg>$/);
  });

  it('accepts clubs with an empty rivals list', () => {
    const raw = syntheticClubs();
    expect(raw.filter((c) => c.rivals.length === 0)).toHaveLength(4);
    expect(checkClubData(raw, blocklist).ok).toBe(true);
  });

  it('accepts an empty blocklist', () => {
    expect(checkClubData(syntheticClubs(), buildBlocklist([])).ok).toBe(true);
  });

  it('fails when there are not exactly 20 clubs', () => {
    expect(issuesOf(checkClubData(syntheticClubs(18), blocklist))).toEqual([
      { field: '', problem: 'club-count', value: 18, range: { min: 20, max: 20 } },
    ]);
  });

  it('fails on a missing field and names club and field', () => {
    const raw = syntheticClubs();
    delete (raw[9] as { nickname?: string }).nickname;
    expect(issuesOf(checkClubData(raw, blocklist))).toEqual([
      { index: 9, clubId: 'clube-teste-10', field: 'nickname', problem: 'missing' },
    ]);
  });

  it('fails on a duplicated id', () => {
    const raw = syntheticClubs();
    raw[18]!.id = 'clube-teste-20';
    expect(issuesOf(checkClubData(raw, blocklist))).toMatchObject([
      { index: 19, clubId: 'clube-teste-20', field: 'id', problem: 'duplicate-id', other: '#18' },
    ]);
  });

  it('fails on an asymmetric derby and names the pair', () => {
    const raw = syntheticClubs();
    raw[4]!.rivals = []; // 06 still lists 05
    expect(issuesOf(checkClubData(raw, blocklist))).toMatchObject([
      { clubId: 'clube-teste-06', problem: 'asymmetric-rival', other: 'clube-teste-05' },
    ]);
  });

  it('fails on a rival that does not exist and names the pair', () => {
    const raw = syntheticClubs();
    raw[17]!.rivals = ['clube-teste-99'];
    expect(issuesOf(checkClubData(raw, blocklist))).toMatchObject([
      { clubId: 'clube-teste-18', problem: 'unknown-rival', other: 'clube-teste-99' },
    ]);
  });

  it.each([
    ['name', 'CLUBE PROIBIDO'],
    ['shortName', 'Proibidao'],
    ['abbreviation', 'ZZQ'],
    ['nickname', '  vetadinhos '],
    ['stadium.name', 'Arena  Vetadá'],
  ] as const)('blocks a real %s regardless of accent, case and spaces', (field, value) => {
    const raw = syntheticClubs();
    if (field === 'stadium.name') raw[12]!.stadium.name = value;
    else raw[12]![field] = value;
    expect(issuesOf(checkClubData(raw, blocklist))).toEqual([
      { index: 12, clubId: 'clube-teste-13', field, problem: 'blocked-name', value },
    ]);
  });

  it('does not block a name that only contains a blocked one', () => {
    const raw = syntheticClubs();
    raw[0]!.name = 'Clube Proibido do Norte';
    expect(checkClubData(raw, blocklist).ok).toBe(true);
  });

  it('blocks a real name even in a club that is broken otherwise', () => {
    const raw = syntheticClubs();
    raw[2]!.name = 'Clube Proibido';
    delete (raw[2] as { city?: string }).city;
    expect(issuesOf(checkClubData(raw, blocklist))).toEqual([
      { index: 2, clubId: 'clube-teste-03', field: 'city', problem: 'missing' },
      {
        index: 2,
        clubId: 'clube-teste-03',
        field: 'name',
        problem: 'blocked-name',
        value: 'Clube Proibido',
      },
    ]);
  });

  it('fails when a shield does not render, naming the club', () => {
    const result = checkClubData(syntheticClubs(), blocklist, {
      renderShield: (club) => {
        if (club.id === 'clube-teste-07') throw new Error('boom');
        return club.id === 'clube-teste-08' ? '' : renderClubShield(club);
      },
    });
    expect(issuesOf(result)).toEqual([
      {
        index: 6,
        clubId: 'clube-teste-07',
        field: 'shield',
        problem: 'shield-error',
        value: 'boom',
      },
      { index: 7, clubId: 'clube-teste-08', field: 'shield', problem: 'shield-error', value: '' },
    ]);
  });

  it('fails on an invalid blocklist file', () => {
    expect(issuesOf(checkClubData(syntheticClubs(), { hashes: ['x'] }))).toEqual([
      { field: 'blocklist', problem: 'blocklist-wrong-algorithm' },
      { field: 'blocklist', problem: 'blocklist-wrong-normalization' },
      { field: 'blocklist.hashes.0', problem: 'blocklist-invalid-hash' },
    ]);
  });

  it('never throws, whatever the input', () => {
    for (const input of [undefined, 'x', [null], [{ name: 7, stadium: 1 }]]) {
      expect(() => checkClubData(input, undefined)).not.toThrow();
      expect(checkClubData(input, blocklist).ok).toBe(false);
    }
  });
});

describe('formatClubIssues', () => {
  it('names club, field, problem, pair, value and range', () => {
    expect(
      formatClubIssues([
        { field: '', problem: 'club-count', value: 19, range: { min: 20, max: 20 } },
        {
          index: 0,
          clubId: 'clube-teste-01',
          field: 'rivals.0',
          problem: 'asymmetric-rival',
          value: 'clube-teste-02',
          other: 'clube-teste-02',
        },
        { index: 3, field: 'id', problem: 'missing' },
      ]),
    ).toBe(
      [
        '(list): club-count, got 19 (range 20..20)',
        'clube-teste-01 rivals.0: asymmetric-rival (with clube-teste-02), got "clube-teste-02"',
        '#3 id: missing',
      ].join('\n'),
    );
  });
});
