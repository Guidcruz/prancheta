import { SERIE_A_CLUBS } from './clubs.ts';
import { SEASON_ROUNDS, SEASON_WEEKS, type SeasonParams } from './params.ts';
import { fail, ok } from './result.ts';
import { Rng, seedFromString } from './rng.ts';
import type { ClubId, FixtureId, Result } from './types.ts';

/*
 * Série A calendar (docs/design/temporada.md, "Tabela de jogos" and "Datas"; US-006; T-007).
 * Pure and seeded: the only draw is the order of the clubs, from its own stream
 * `${seed}-fixtures-${season}` (ADR-0007, rule 2), so nothing else in the game moves it.
 *
 * 1. The club ids are sorted (the calendar never depends on the order of the input list) and
 *    shuffled (Fisher-Yates) into the 20 slots of the table.
 * 2. First half (rounds 1..19): the Berger table (circle method), slot 19 fixed and the others
 *    rotating. Inside the first half every club alternates home and away with at most one break.
 * 3. Second half (rounds 20..38): round 19 + n repeats round n with home and away swapped.
 *
 * The canonical Berger order, mirrored, gives two clubs three games in a row at the turn (their
 * break falls on rounds 1-2, so it comes back inverted on rounds 20-21 right after round 19).
 * The first half therefore starts at the first rotation of the Berger rounds whose mirrored
 * season has no club with more than two home or away games in a row (BERGER_START, found once
 * at load; it does not depend on the seed, since the shuffle only relabels the slots).
 */

/** A league match (docs/02-architecture.md, 4.1). `result` arrives with the rounds (T-013). */
export interface Fixture {
  /** `s${season}-r${round}-${homeId}-${awayId}`. */
  readonly id: FixtureId;
  /** 1..38. */
  readonly round: number;
  /** "YYYY-MM-DD"; every match of a round is on the same day. */
  readonly date: string;
  readonly homeId: ClubId;
  readonly awayId: ClubId;
}

/** When a round is played (temporada.md, "Datas"). */
export interface RoundSlot {
  /** 1..38. */
  readonly round: number;
  /** Week of the season, 1..34; week 1 starts on the 2nd Saturday of April. */
  readonly week: number;
  readonly day: 'sunday' | 'wednesday';
  /** "YYYY-MM-DD". */
  readonly date: string;
}

export interface FixturesRequest {
  /** Seed of the career or league. */
  readonly seed: number;
  /** Starts at 1; part of the fixture ids and of the seed label. */
  readonly season: number;
  /** Calendar year of the season (from the new-game screen; the engine never reads a clock). */
  readonly year: number;
  readonly clubIds: readonly ClubId[];
}

export type FixturesError = 'invalid-club-count' | 'duplicate-club' | 'invalid-calendar';

/** Rounds of each half of the season. */
export const HALF_ROUNDS = SEASON_ROUNDS / 2;
/** Most consecutive home (or away) games any club may have (temporada.md; US-006). */
export const MAX_SAME_VENUE_RUN = 2;
/** Valid calendar years: the date label is "YYYY-MM-DD". */
export const YEAR_RANGE = { min: 1, max: 9999 } as const;

/** One match of a slot table: [home slot, away slot]. */
export type SlotPair = readonly [number, number];

/**
 * Berger table for `teams` slots (even): round r pairs the fixed slot `teams − 1` with slot r
 * and slot r + k with slot r − k (mod teams − 1), k = 1..teams/2 − 1. The fixed slot plays at
 * home on odd r; the other pairs alternate by k, which makes every slot alternate home and away.
 */
function bergerRounds(teams: number): SlotPair[][] {
  const rotating = teams - 1;
  const rounds: SlotPair[][] = [];
  for (let r = 0; r < rotating; r++) {
    const round: SlotPair[] = [r % 2 === 0 ? [r, rotating] : [rotating, r]];
    for (let k = 1; k < teams / 2; k++) {
      const up = (r + k) % rotating;
      const down = (r - k + rotating) % rotating;
      round.push(k % 2 === 1 ? [down, up] : [up, down]);
    }
    rounds.push(round);
  }
  return rounds;
}

/** The whole season of a first half: the half, then the same rounds with the venues swapped. */
function mirrored(half: readonly (readonly SlotPair[])[]): SlotPair[][] {
  return [
    ...half.map((round) => [...round]),
    ...half.map((round) => round.map(([home, away]): SlotPair => [away, home])),
  ];
}

/** Longest run of consecutive home or away games of any slot. */
export function longestVenueRun(rounds: readonly (readonly SlotPair[])[], teams: number): number {
  let longest = 0;
  for (let slot = 0; slot < teams; slot++) {
    let run = 0;
    let last: boolean | undefined;
    for (const round of rounds) {
      const pair = round.find(([home, away]) => home === slot || away === slot);
      if (pair === undefined) continue;
      const home = pair[0] === slot;
      run = home === last ? run + 1 : 1;
      last = home;
      if (run > longest) longest = run;
    }
  }
  return longest;
}

/** First rotation of the Berger rounds that keeps every run within MAX_SAME_VENUE_RUN. */
function findBergerStart(teams: number): number {
  const rounds = bergerRounds(teams);
  for (let start = 0; start < rounds.length; start++) {
    const half = [...rounds.slice(start), ...rounds.slice(0, start)];
    if (longestVenueRun(mirrored(half), teams) <= MAX_SAME_VENUE_RUN) return start;
  }
  // Unreachable for 20 clubs (fixtures.test.ts pins the value); a bug if it ever happens.
  throw new Error(`no Berger rotation keeps runs within ${MAX_SAME_VENUE_RUN} for ${teams}`);
}

/** Index of the Berger round that opens the season (see the header). */
export const BERGER_START = findBergerStart(SERIE_A_CLUBS);

/** The 38 rounds of the season as slot pairs, before the clubs are drawn into the slots. */
export function seasonSlotTable(): SlotPair[][] {
  const rounds = bergerRounds(SERIE_A_CLUBS);
  return mirrored([...rounds.slice(BERGER_START), ...rounds.slice(0, BERGER_START)]);
}

// --- Dates, without the Date object (the engine never touches the clock or the locale). ---

/** Days since 1970-01-01 of a proleptic Gregorian date (H. Hinnant, "days_from_civil"). */
function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Inverse of daysFromCivil, as "YYYY-MM-DD". */
function civilFromDays(days: number): string {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  const pad = (n: number, width: number) => String(n).padStart(width, '0');
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** 0 = Sunday ... 6 = Saturday (1970-01-01 was a Thursday). */
function weekday(days: number): number {
  return (((days + 4) % 7) + 7) % 7;
}

/** Whole days from one "YYYY-MM-DD" to another (positive when `to` is later). */
export function daysBetween(from: string, to: string): number | undefined {
  const a = parseDate(from);
  const b = parseDate(to);
  return a === undefined || b === undefined ? undefined : b - a;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDate(text: string): number | undefined {
  const match = DATE.exec(text);
  if (match === null) return undefined;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const days = daysFromCivil(year, month, day);
  return civilFromDays(days) === text ? days : undefined;
}

const SATURDAY = 6;
const APRIL = 4;
/** Offset from the Saturday that opens a week. */
const DAY_OFFSET = { sunday: 1, wednesday: 4 } as const;

function isWeekList(weeks: readonly number[]): boolean {
  return weeks.every(
    (week, i) =>
      Number.isInteger(week) &&
      week >= 1 &&
      week <= SEASON_WEEKS &&
      (i === 0 || week > weeks[i - 1]!),
  );
}

/**
 * The day of each of the 38 rounds (temporada.md, "Datas"): the season starts on the 2nd Saturday
 * of April of `year` and lasts 34 weeks; one round on the Sunday of every week except the FIFA
 * weeks, and one more on the Wednesday of each midweek week. Refuses (`invalid-calendar`) a year
 * outside YEAR_RANGE or week lists that `validateParams` would refuse.
 */
export function seasonCalendar(
  year: number,
  season: SeasonParams,
): Result<RoundSlot[], 'invalid-calendar'> {
  if (!Number.isInteger(year) || year < YEAR_RANGE.min || year > YEAR_RANGE.max) {
    return fail('invalid-calendar', { year });
  }
  const fifa = new Set(season.fifaWeeks);
  const midweek = new Set(season.midweekWeeks);
  if (
    !isWeekList(season.fifaWeeks) ||
    !isWeekList(season.midweekWeeks) ||
    season.midweekWeeks.some((week) => fifa.has(week)) ||
    SEASON_WEEKS - fifa.size + midweek.size !== SEASON_ROUNDS
  ) {
    return fail('invalid-calendar', {
      fifaWeeks: season.fifaWeeks,
      midweekWeeks: season.midweekWeeks,
    });
  }

  const april1 = daysFromCivil(year, APRIL, 1);
  const firstSaturday = april1 + ((SATURDAY - weekday(april1) + 7) % 7);
  const start = firstSaturday + 7;
  const slots: RoundSlot[] = [];
  for (let week = 1; week <= SEASON_WEEKS; week++) {
    const saturday = start + 7 * (week - 1);
    const days: RoundSlot['day'][] = [];
    if (!fifa.has(week)) days.push('sunday');
    if (midweek.has(week)) days.push('wednesday');
    for (const day of days) {
      slots.push({
        round: slots.length + 1,
        week,
        day,
        date: civilFromDays(saturday + DAY_OFFSET[day]),
      });
    }
  }
  return ok(slots);
}

/** `s${season}-r${round}-${homeId}-${awayId}` (docs/02-architecture.md, 4.1). */
export function fixtureId(
  season: number,
  round: number,
  homeId: ClubId,
  awayId: ClubId,
): FixtureId {
  return `s${season}-r${round}-${homeId}-${awayId}`;
}

/**
 * The 380 matches of a season, by round, with their dates (US-006). Same request and same
 * parameters, same calendar. Refuses a list that is not exactly 20 distinct clubs, and an
 * invalid year or week list (`seasonCalendar`).
 */
export function generateFixtures(
  request: FixturesRequest,
  season: SeasonParams,
): Result<Fixture[], FixturesError> {
  const { clubIds } = request;
  if (clubIds.length !== SERIE_A_CLUBS) {
    return fail('invalid-club-count', { count: clubIds.length, expected: SERIE_A_CLUBS });
  }
  const sorted = [...clubIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const repeated = sorted.find((id, i) => i > 0 && id === sorted[i - 1]);
  if (repeated !== undefined) return fail('duplicate-club', { clubId: repeated });
  const calendar = seasonCalendar(request.year, season);
  if (!calendar.ok) return calendar;

  const rng = new Rng(seedFromString(`${request.seed >>> 0}-fixtures-${request.season}`));
  const slots = sorted;
  for (let i = slots.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [slots[i], slots[j]] = [slots[j]!, slots[i]!];
  }

  const fixtures: Fixture[] = [];
  seasonSlotTable().forEach((pairs, index) => {
    const { round, date } = calendar.value[index]!;
    for (const [home, away] of pairs) {
      const homeId = slots[home]!;
      const awayId = slots[away]!;
      fixtures.push({
        id: fixtureId(request.season, round, homeId, awayId),
        round,
        date,
        homeId,
        awayId,
      });
    }
  });
  return ok(fixtures);
}
