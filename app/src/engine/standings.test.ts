import { describe, expect, it } from 'vitest';
import type { Fixture } from './fixtures.ts';
import type { ClubState } from './game.ts';
import type { MatchStats } from './match/types.ts';
import { seedFromString } from './rng.ts';
import { getStandings, standingsHistory, type StandingsState } from './standings.ts';
import { testGame } from './testing/match.ts';

/*
 * The table of temporada.md ("Pontos e tabela"; US-012): the columns, and each of the eight
 * tie-breaks with fixtures built by hand.
 */

const SEED = 7;

interface Cards {
  hy?: number;
  hr?: number;
  ay?: number;
  ar?: number;
}

function stats(yellows: number, reds: number): MatchStats {
  return { shots: 0, onTarget: 0, possession: 50, yellows, reds };
}

function fx(
  round: number,
  homeId: string,
  awayId: string,
  score?: [number, number],
  cards: Cards = {},
): Fixture {
  return {
    id: `s1-r${round}-${homeId}-${awayId}`,
    round,
    date: '2026-04-12',
    homeId,
    awayId,
    ...(score === undefined
      ? {}
      : {
          result: {
            score,
            abandoned: false,
            goals: [],
            stats: {
              home: stats(cards.hy ?? 0, cards.hr ?? 0),
              away: stats(cards.ay ?? 0, cards.ar ?? 0),
            },
            attendance: 0,
          },
        }),
  };
}

function table(ids: readonly string[], fixtures: Fixture[], seed = SEED): StandingsState {
  const club = Object.values(testGame().clubs)[0]!;
  const clubs: Record<string, ClubState> = {};
  for (const id of ids) clubs[id] = club;
  return { seed, clubs, fixtures };
}

const order = (s: StandingsState, through?: number) =>
  getStandings(s, through).map((r) => r.clubId);
const lottery = (id: string) => seedFromString(`${SEED}-tiebreak-${id}`);

describe('getStandings: columns', () => {
  it('counts points, games, wins, draws, losses, goals, cards and the last five', () => {
    const s = table(
      ['a', 'b', 'c'],
      [
        fx(1, 'a', 'b', [2, 0], { hy: 1, ar: 1 }),
        fx(2, 'c', 'a', [1, 1], { hy: 2 }),
        fx(3, 'b', 'c', [3, 2]),
        fx(4, 'a', 'c'),
      ],
    );
    const rows = getStandings(s);
    const a = rows.find((r) => r.clubId === 'a')!;
    expect(a).toEqual({
      position: 1,
      clubId: 'a',
      points: 4,
      played: 2,
      wins: 1,
      draws: 1,
      losses: 0,
      goalsFor: 3,
      goalsAgainst: 1,
      goalDifference: 2,
      yellows: 1,
      reds: 0,
      form: ['W', 'D'],
    });
    const b = rows.find((r) => r.clubId === 'b')!;
    expect([b.points, b.played, b.wins, b.losses, b.goalsFor, b.goalsAgainst, b.reds]).toEqual([
      3, 2, 1, 1, 3, 4, 1,
    ]);
    const c = rows.find((r) => r.clubId === 'c')!;
    expect([c.points, c.yellows, c.form]).toEqual([1, 2, ['D', 'L']]);
    expect(rows.map((r) => r.position)).toEqual([1, 2, 3]);
  });

  it('keeps only the last five results, oldest first', () => {
    const fixtures = [1, 2, 3, 4, 5, 6, 7].map((r) =>
      fx(r, 'a', 'b', r % 2 === 0 ? [0, 1] : r === 7 ? [1, 1] : [1, 0]),
    );
    const a = getStandings(table(['a', 'b'], fixtures)).find((r) => r.clubId === 'a')!;
    expect(a.form).toEqual(['W', 'L', 'W', 'L', 'D']);
  });

  it('has a row for every club, played or not, and stops at throughRound', () => {
    const s = table(['a', 'b', 'c', 'd'], [fx(1, 'a', 'b', [1, 0]), fx(2, 'c', 'd', [0, 3])]);
    expect(getStandings(s)).toHaveLength(4);
    expect(getStandings(s, 1).find((r) => r.clubId === 'd')!.played).toBe(0);
    expect(getStandings(s, 0).every((r) => r.played === 0)).toBe(true);
    const history = standingsHistory(s, 2);
    expect(history).toHaveLength(3);
    expect(history[2]).toEqual(getStandings(s));
    expect(history[1]).toEqual(getStandings(s, 1));
  });
});

describe('getStandings: tie-breaks (temporada.md; US-012, P1)', () => {
  it('1. points first', () => {
    // a beats c (3 pts); b draws twice (2 pts) with more goals.
    const s = table(
      ['a', 'b', 'c', 'd'],
      [fx(1, 'a', 'c', [1, 0]), fx(1, 'b', 'd', [4, 4]), fx(2, 'd', 'b', [3, 3])],
    );
    expect(order(s)[0]).toBe('a');
  });

  it('2. then wins, even with a worse goal difference', () => {
    // a: W, L, D = 4 pts, 1 win... b: D, D, D, D = 4 pts, 0 wins.
    const s = table(
      ['a', 'b', 'c', 'd'],
      [
        fx(1, 'a', 'c', [1, 0]),
        fx(2, 'a', 'd', [0, 5]),
        fx(3, 'a', 'c', [0, 0]),
        fx(1, 'b', 'd', [0, 0]),
        fx(2, 'b', 'c', [0, 0]),
        fx(3, 'b', 'd', [0, 0]),
        fx(4, 'b', 'c', [0, 0]),
      ],
    );
    const rows = getStandings(s);
    const a = rows.find((r) => r.clubId === 'a')!;
    const b = rows.find((r) => r.clubId === 'b')!;
    expect([a.points, b.points]).toEqual([4, 4]);
    expect(a.goalDifference).toBeLessThan(b.goalDifference);
    expect(a.position).toBeLessThan(b.position);
  });

  it('3. then goal difference, 4. then goals scored', () => {
    const s = table(
      ['a', 'b', 'c', 'd', 'e', 'f'],
      [fx(1, 'a', 'd', [3, 1]), fx(1, 'b', 'e', [2, 1]), fx(1, 'c', 'f', [1, 0])],
    );
    // a: +2; b and c: +1, b with more goals.
    expect(order(s).slice(0, 3)).toEqual(['a', 'b', 'c']);
  });

  it('5. head to head between exactly two clubs: points, then goal difference', () => {
    // a and b level on points, wins, difference and goals; b won the game between them.
    const s = table(
      ['a', 'b', 'c', 'd'],
      [
        fx(1, 'a', 'b', [0, 1]),
        fx(2, 'a', 'c', [1, 0]),
        fx(2, 'b', 'd', [0, 1]),
        fx(3, 'c', 'd', [0, 0]),
      ],
    );
    const rows = getStandings(s);
    const [a, b] = [rows.find((r) => r.clubId === 'a')!, rows.find((r) => r.clubId === 'b')!];
    expect([a.points, a.wins, a.goalDifference, a.goalsFor]).toEqual([
      b.points,
      b.wins,
      b.goalDifference,
      b.goalsFor,
    ]);
    expect(b.position).toBeLessThan(a.position);
    // Swap who won the direct game: the order follows it, whatever the draw says.
    const t = table(
      ['a', 'b', 'c', 'd'],
      [
        fx(1, 'a', 'b', [1, 0]),
        fx(2, 'b', 'c', [1, 0]),
        fx(2, 'a', 'd', [0, 1]),
        fx(3, 'c', 'd', [0, 0]),
      ],
    );
    expect(order(t).indexOf('a')).toBeLessThan(order(t).indexOf('b'));
  });

  it('5. head to head on goal difference when the points between them are level', () => {
    // Two direct games: a wins 3x0, b wins 1x0 (3 points each); a is ahead on the difference.
    // Overall both have 6 points, 2 wins, 4 goals for and 4 against.
    const s = table(
      ['a', 'b', 'c', 'd'],
      [
        fx(1, 'a', 'b', [3, 0]),
        fx(2, 'b', 'a', [1, 0]),
        fx(3, 'a', 'd', [1, 0]),
        fx(4, 'a', 'c', [0, 3]),
        fx(3, 'b', 'c', [3, 0]),
        fx(4, 'b', 'd', [0, 1]),
      ],
    );
    const rows = getStandings(s);
    const [a, b] = [rows.find((r) => r.clubId === 'a')!, rows.find((r) => r.clubId === 'b')!];
    expect([a.points, a.goalDifference, a.goalsFor]).toEqual([
      b.points,
      b.goalDifference,
      b.goalsFor,
    ]);
    expect(a.position).toBeLessThan(b.position);
  });

  it('6. fewer reds, 7. fewer yellows when the head to head does not decide', () => {
    // a and b drew each other: level up to 5; c has not played.
    const reds = table(['a', 'b', 'c'], [fx(1, 'a', 'b', [1, 1], { hr: 1, ay: 4 })]);
    expect(order(reds).slice(0, 2)).toEqual(['b', 'a']);
    const yellows = table(['a', 'b', 'c'], [fx(1, 'a', 'b', [1, 1], { hy: 3, ay: 2 })]);
    expect(order(yellows).slice(0, 2)).toEqual(['b', 'a']);
  });

  it('with three or more level up to 4 skips the head to head and goes to the cards', () => {
    // a, b, c all with 3 points, 1 win, 0 difference, 1 goal (a cycle: a>b, b>c, c>a).
    // a has the fewest reds; c the fewest yellows of the other two.
    const s = table(
      ['a', 'b', 'c'],
      [
        fx(1, 'a', 'b', [1, 0], { hy: 2, ay: 1, ar: 1 }),
        fx(2, 'b', 'c', [1, 0], { hy: 1, ar: 1 }),
        fx(3, 'c', 'a', [1, 0], { hy: 1 }),
      ],
    );
    const rows = getStandings(s);
    expect(rows.map((r) => [r.points, r.wins, r.goalDifference, r.goalsFor])).toEqual([
      [3, 1, 0, 1],
      [3, 1, 0, 1],
      [3, 1, 0, 1],
    ]);
    // reds: a 0, b 1, c 1; yellows: b 2, c 1 → a, c, b.
    expect(rows.map((r) => r.clubId)).toEqual(['a', 'c', 'b']);
  });

  it('8. a full tie goes to the seeded draw, always the same for the same seed', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const s = table(ids, [
      fx(1, 'a', 'b', [0, 0]),
      fx(1, 'c', 'd', [0, 0]),
      fx(1, 'e', 'f', [0, 0]),
    ]);
    // Pairs a-b, c-d, e-f drew each other: the head to head is level too.
    const byDraw = [...ids].sort((x, y) => lottery(x) - lottery(y));
    expect(order(s)).toEqual(byDraw);
    expect(order(s)).toEqual(order(table(ids, s.fixtures as Fixture[])));
    const other = order(table(ids, s.fixtures as Fixture[], SEED + 1));
    expect(other).toEqual(
      [...ids].sort(
        (x, y) =>
          seedFromString(`${SEED + 1}-tiebreak-${x}`) - seedFromString(`${SEED + 1}-tiebreak-${y}`),
      ),
    );
  });

  it('an abandoned match counts with its awarded score', () => {
    const f = fx(1, 'a', 'b', [0, 3]);
    const s = table(['a', 'b'], [{ ...f, result: { ...f.result!, abandoned: true } }]);
    const rows = getStandings(s);
    expect(rows[0]).toMatchObject({ clubId: 'b', points: 3, goalsFor: 3 });
  });

  it('does not change its input', () => {
    const s = table(['a', 'b', 'c'], [fx(2, 'a', 'b', [1, 0]), fx(1, 'b', 'c', [2, 2])]);
    const copy = structuredClone(s);
    getStandings(s);
    standingsHistory(s, 2);
    expect(s).toEqual(copy);
  });
});
