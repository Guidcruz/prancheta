import { describe, expect, it } from 'vitest';
import {
  BERGER_START,
  HALF_ROUNDS,
  MAX_SAME_VENUE_RUN,
  bergerRounds,
  daysBetween,
  fixtureId,
  generateFixtures,
  longestVenueRun,
  mirrored,
  seasonCalendar,
  seasonSlotTable,
  type Fixture,
  type FixturesRequest,
} from './fixtures.ts';
import { newGame } from './game.ts';
import { SEASON_ROUNDS, type SeasonParams } from './params.ts';
import { syntheticClubs } from './testing/clubs.ts';
import { fixedIdentitySource } from './testing/identity.ts';
import { testParams } from './testing/params.ts';

const SEASON: SeasonParams = testParams().season;
const CLUB_IDS = syntheticClubs(20).map((c) => c.id);
const SEEDS = [0, 1, 42, 20261104, 0x7fffffff, 0xffffffff, 123456789, 987654321];

function request(overrides: Partial<FixturesRequest> = {}): FixturesRequest {
  return { seed: 20261104, season: 1, year: 2026, clubIds: CLUB_IDS, ...overrides };
}

function fixturesOf(overrides: Partial<FixturesRequest> = {}, season = SEASON): Fixture[] {
  const result = generateFixtures(request(overrides), season);
  if (!result.ok) throw new Error(`generateFixtures failed: ${result.error}`);
  return result.value;
}

function byRound(fixtures: readonly Fixture[]): Fixture[][] {
  const rounds: Fixture[][] = Array.from({ length: SEASON_ROUNDS }, () => []);
  for (const f of fixtures) rounds[f.round - 1]!.push(f);
  return rounds;
}

/** "H"/"A" of a club over the 38 rounds. */
function venues(fixtures: readonly Fixture[], clubId: string): string {
  return byRound(fixtures)
    .map((round) => {
      const f = round.find((m) => m.homeId === clubId || m.awayId === clubId)!;
      return f.homeId === clubId ? 'H' : 'A';
    })
    .join('');
}

/** 0 = Sunday ... 6 = Saturday, from a known Sunday. */
function weekdayOf(date: string): number {
  return (((daysBetween('2023-01-01', date)! % 7) + 7) % 7) as number;
}

describe('generateFixtures: valid table (US-006)', () => {
  it.each(SEEDS)('seed %i: 38 rounds of 10, every club once per round', (seed) => {
    const fixtures = fixturesOf({ seed });
    expect(fixtures).toHaveLength(380);
    const rounds = byRound(fixtures);
    for (const round of rounds) {
      expect(round).toHaveLength(10);
      const clubs = round.flatMap((f) => [f.homeId, f.awayId]);
      expect(new Set(clubs).size).toBe(20);
      expect(new Set(clubs)).toEqual(new Set(CLUB_IDS));
    }
  });

  it.each(SEEDS)('seed %i: every pair meets twice, once at each ground', (seed) => {
    const fixtures = fixturesOf({ seed });
    const ordered = new Set(fixtures.map((f) => `${f.homeId}>${f.awayId}`));
    expect(ordered.size).toBe(20 * 19);
    for (const f of fixtures) {
      expect(f.homeId).not.toBe(f.awayId);
      expect(ordered.has(`${f.awayId}>${f.homeId}`)).toBe(true);
    }
  });

  it.each(SEEDS)('seed %i: round N + 19 is round N with the venues swapped', (seed) => {
    const rounds = byRound(fixturesOf({ seed }));
    for (let n = 1; n <= HALF_ROUNDS; n++) {
      const first = rounds[n - 1]!.map((f) => `${f.awayId}>${f.homeId}`);
      const second = rounds[n + HALF_ROUNDS - 1]!.map((f) => `${f.homeId}>${f.awayId}`);
      expect(second).toEqual(first);
    }
  });

  it.each(SEEDS)('seed %i: no club has 3 home or 3 away games in a row', (seed) => {
    const fixtures = fixturesOf({ seed });
    for (const clubId of CLUB_IDS) {
      const pattern = venues(fixtures, clubId);
      expect(pattern, clubId).not.toMatch(/HHH|AAA/);
      // 19 home and 19 away games.
      expect(pattern.replaceAll('A', '')).toHaveLength(19);
    }
  });

  it('keeps ids, rounds and seasons in the agreed format', () => {
    const fixtures = fixturesOf({ season: 3 });
    for (const f of fixtures) {
      expect(f.id).toBe(fixtureId(3, f.round, f.homeId, f.awayId));
      expect(f.id).toBe(`s3-r${f.round}-${f.homeId}-${f.awayId}`);
    }
    expect(new Set(fixtures.map((f) => f.id)).size).toBe(380);
    expect(fixtures.map((f) => f.round)).toEqual(
      [...fixtures.map((f) => f.round)].sort((a, b) => a - b),
    );
  });
});

describe('generateFixtures: the slot table', () => {
  it('opens on the 4th Berger round, the first rotation that keeps runs within 2', () => {
    const rounds = bergerRounds(20);
    const valid = rounds
      .map((_, start) => mirrored([...rounds.slice(start), ...rounds.slice(0, start)]))
      .map((season) => longestVenueRun(season, 20) <= MAX_SAME_VENUE_RUN);
    expect(valid.indexOf(true)).toBe(3);
    expect(BERGER_START).toBe(valid.indexOf(true));
    expect(longestVenueRun(seasonSlotTable(), 20)).toBe(MAX_SAME_VENUE_RUN);
  });

  it('would give 3 in a row with the canonical order (why BERGER_START exists)', () => {
    const table = seasonSlotTable();
    const half = table.slice(0, HALF_ROUNDS);
    const canonical = [
      ...half.slice(HALF_ROUNDS - BERGER_START),
      ...half.slice(0, HALF_ROUNDS - BERGER_START),
    ];
    const season = [...canonical, ...canonical.map((r) => r.map(([h, a]) => [a, h] as const))];
    expect(longestVenueRun(season, 20)).toBe(3);
  });
});

describe('generateFixtures: determinism', () => {
  it('gives the same calendar for the same seed', () => {
    expect(fixturesOf()).toStrictEqual(fixturesOf());
  });

  it('does not depend on the order of the club list', () => {
    expect(fixturesOf({ clubIds: [...CLUB_IDS].reverse() })).toStrictEqual(fixturesOf());
  });

  it('changes with the seed and with the season', () => {
    const base = fixturesOf().map((f) => `${f.round}:${f.homeId}>${f.awayId}`);
    const other = fixturesOf({ seed: 7 }).map((f) => `${f.round}:${f.homeId}>${f.awayId}`);
    const next = fixturesOf({ season: 2 }).map((f) => `${f.round}:${f.homeId}>${f.awayId}`);
    expect(other).not.toEqual(base);
    expect(next).not.toEqual(base);
  });

  it('does not change its inputs', () => {
    const clubIds = [...CLUB_IDS];
    const season = { fifaWeeks: [...SEASON.fifaWeeks], midweekWeeks: [...SEASON.midweekWeeks] };
    generateFixtures(request({ clubIds }), season);
    expect(clubIds).toEqual(CLUB_IDS);
    expect(season).toEqual(SEASON);
  });
});

describe('seasonCalendar: dates (temporada.md, "Datas")', () => {
  it('starts on the Sunday after the 2nd Saturday of April', () => {
    const cases: [number, string][] = [
      [2026, '2026-04-12'], // 1 April 2026 is a Wednesday: Saturdays 4 and 11
      [2027, '2027-04-11'], // 1 April 2027 is a Thursday: Saturdays 3 and 10
      [2028, '2028-04-09'], // 1 April 2028 is a Saturday: Saturdays 1 and 8
      [2023, '2023-04-09'],
    ];
    for (const [year, first] of cases) {
      const calendar = seasonCalendar(year, SEASON);
      if (!calendar.ok) throw new Error('calendar failed');
      expect(calendar.value[0]).toEqual({ round: 1, week: 1, day: 'sunday', date: first });
    }
  });

  it.each([2024, 2025, 2026, 2027, 2028, 2100, 2400])(
    '%i: 38 rounds, Sundays outside FIFA weeks and the 8 Wednesdays',
    (year) => {
      const calendar = seasonCalendar(year, SEASON);
      if (!calendar.ok) throw new Error('calendar failed');
      const slots = calendar.value;
      expect(slots.map((s) => s.round)).toEqual(Array.from({ length: 38 }, (_, i) => i + 1));
      const fifa = new Set(SEASON.fifaWeeks);
      expect(slots.some((s) => fifa.has(s.week))).toBe(false);
      const wednesdays = slots.filter((s) => s.day === 'wednesday');
      expect(wednesdays.map((s) => s.week)).toEqual(SEASON.midweekWeeks);
      expect(slots.filter((s) => s.day === 'sunday')).toHaveLength(30);
      for (const s of slots) {
        expect(s.date.startsWith(`${year}-`)).toBe(true);
        expect(weekdayOf(s.date)).toBe(s.day === 'sunday' ? 0 : 3);
        // Week w goes from the opening Saturday + 7(w − 1) to the Friday after it.
        const offset = daysBetween(slots[0]!.date, s.date)! + 1;
        expect(Math.floor(offset / 7) + 1).toBe(s.week);
      }
      // Rest between rounds: Sunday → Wednesday 3, Wednesday → Sunday 4, a week, or a FIFA break.
      for (let i = 1; i < slots.length; i++) {
        expect([3, 4, 7, 14]).toContain(daysBetween(slots[i - 1]!.date, slots[i]!.date));
      }
      // Ends in the last days of November or the first of December.
      expect(slots[37]!.week).toBe(34);
      expect(slots[37]!.date >= `${year}-11-26` && slots[37]!.date <= `${year}-12-02`).toBe(true);
    },
  );

  it('puts every match of a round on the date of the round', () => {
    const calendar = seasonCalendar(2026, SEASON);
    if (!calendar.ok) throw new Error('calendar failed');
    for (const f of fixturesOf()) expect(f.date).toBe(calendar.value[f.round - 1]!.date);
  });

  it('follows other valid week lists', () => {
    const season = {
      fifaWeeks: [5, 15, 25, 33, 34],
      midweekWeeks: [2, 4, 6, 8, 10, 12, 14, 16, 18],
    };
    const calendar = seasonCalendar(2026, season);
    if (!calendar.ok) throw new Error('calendar failed');
    expect(calendar.value).toHaveLength(38);
    expect(calendar.value.filter((s) => s.day === 'wednesday')).toHaveLength(9);
    expect(calendar.value.some((s) => season.fifaWeeks.includes(s.week))).toBe(false);
  });
});

describe('refusals (never throws)', () => {
  it('refuses a list that is not 20 distinct clubs', () => {
    expect(generateFixtures(request({ clubIds: CLUB_IDS.slice(1) }), SEASON)).toMatchObject({
      ok: false,
      error: 'invalid-club-count',
    });
    expect(
      generateFixtures(request({ clubIds: [...CLUB_IDS.slice(1), CLUB_IDS[1]!] }), SEASON),
    ).toMatchObject({
      ok: false,
      error: 'duplicate-club',
      detail: { clubId: CLUB_IDS[1] },
    });
  });

  it.each([0, -1, 10000, 2026.5, Number.NaN])('refuses the year %s', (year) => {
    expect(seasonCalendar(year, SEASON)).toMatchObject({ ok: false, error: 'invalid-calendar' });
    expect(generateFixtures(request({ year }), SEASON)).toMatchObject({
      ok: false,
      error: 'invalid-calendar',
    });
  });

  it.each<[string, SeasonParams]>([
    [
      'FIFA week with a midweek round',
      { fifaWeeks: [9, 21, 25, 30], midweekWeeks: [3, 7, 9, 16, 19, 23, 28, 32] },
    ],
    ['wrong number of rounds', { fifaWeeks: [9, 21, 25, 30], midweekWeeks: [3, 7, 12] }],
    [
      'week out of the season',
      { fifaWeeks: [9, 21, 25, 35], midweekWeeks: [3, 7, 12, 16, 19, 23, 28, 32] },
    ],
    [
      'unsorted weeks',
      { fifaWeeks: [21, 9, 25, 30], midweekWeeks: [3, 7, 12, 16, 19, 23, 28, 32] },
    ],
  ])('refuses weeks with %s', (_, season) => {
    expect(seasonCalendar(2026, season)).toMatchObject({ ok: false, error: 'invalid-calendar' });
  });
});

describe('daysBetween', () => {
  it('counts leap days and refuses dates that do not exist', () => {
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
    expect(daysBetween('2023-02-28', '2023-03-01')).toBe(1);
    expect(daysBetween('2026-12-31', '2026-01-01')).toBe(-364);
    expect(daysBetween('2026-02-30', '2026-03-01')).toBeUndefined();
    expect(daysBetween('26-04-12', '2026-04-12')).toBeUndefined();
  });
});

describe('newGame: calendar of season 1', () => {
  it('carries the 380 fixtures of the career seed', () => {
    const clubs = syntheticClubs(20);
    const result = newGame(
      { seed: 99, year: 2027, realism: 'full' },
      clubs,
      testParams(),
      fixedIdentitySource(),
    );
    if (!result.ok) throw new Error('newGame failed');
    expect(result.value.fixtures).toStrictEqual(
      fixturesOf({ seed: 99, year: 2027, clubIds: clubs.map((c) => c.id) }),
    );
  });

  it('refuses an invalid year without throwing', () => {
    const result = newGame(
      { seed: 99, year: 0, realism: 'full' },
      syntheticClubs(20),
      testParams(),
      fixedIdentitySource(),
    );
    expect(result).toMatchObject({ ok: false, error: 'invalid-calendar' });
  });
});
