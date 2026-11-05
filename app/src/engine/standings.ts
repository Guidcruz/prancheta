import type { Fixture } from './fixtures.ts';
import type { GameState } from './game.ts';
import { seedFromString } from './rng.ts';
import type { ClubId } from './types.ts';

/*
 * The league table (docs/design/temporada.md, "Pontos e tabela"; US-012; T-013). It is derived:
 * nothing stores a table that could disagree with the results, so every row comes from the
 * `Fixture.result` of the season (docs/02-architecture.md, 4.1, "A tabela é derivada").
 *
 * Tie-breaks, in this order (temporada.md, the Brasileirão's):
 * 1. points; 2. wins; 3. goal difference; 4. goals scored;
 * 5. head to head, only when exactly 2 clubs are level up to 4: points in the games between
 *    them, then the goal difference in those games;
 * 6. fewer red cards; 7. fewer yellow cards;
 * 8. the draw: ascending `seedFromString("<seed>-tiebreak-<clubId>")` (deterministic, and it
 *    spends no draw of any Rng). Two clubs with the same hash (never seen) fall back to the id.
 * With 3 or more clubs level up to 4, criterion 5 is skipped and 6 follows.
 *
 * An abandoned match counts with its awarded score (`MatchSummary.score`); its cards count as
 * normal (temporada.md, "Casos de borda").
 */

/** Points for a win, a draw and a loss (temporada.md: rule constants). */
export const POINTS = { win: 3, draw: 1, loss: 0 } as const;
/** The last places that go down (temporada.md: "os 4 últimos caem"). */
export const RELEGATION_SPOTS = 4;
/** Results shown in the "últimos 5" column. */
export const FORM_LENGTH = 5;

/** A result from a club's point of view, as the "últimos 5" column shows it (V/E/D in pt-BR). */
export type StandingResult = 'W' | 'D' | 'L';

/** One row of the table (temporada.md, "Pontos e tabela"; the percentage is the screen's). */
export interface StandingRow {
  /** 1..20. */
  readonly position: number;
  readonly clubId: ClubId;
  readonly points: number;
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDifference: number;
  readonly yellows: number;
  readonly reds: number;
  /** The last {@link FORM_LENGTH} results, oldest first. */
  readonly form: readonly StandingResult[];
}

interface Tally {
  clubId: ClubId;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  yellows: number;
  reds: number;
  results: StandingResult[];
}

/** Head to head of one club against another: points and goal difference in their games. */
interface HeadToHead {
  points: number;
  goalDifference: number;
}

function emptyTally(clubId: ClubId): Tally {
  return {
    clubId,
    points: 0,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    yellows: 0,
    reds: 0,
    results: [],
  };
}

const pairKey = (a: ClubId, b: ClubId) => `${a}\u0000${b}`;

/** Adds one played fixture to the tallies and to the head-to-head records. */
function addFixture(
  fixture: Fixture,
  tallies: Map<ClubId, Tally>,
  h2h: Map<string, HeadToHead>,
): void {
  const result = fixture.result;
  if (result === undefined) return;
  const sides = [
    { id: fixture.homeId, other: fixture.awayId, own: 0, side: 'home' },
    { id: fixture.awayId, other: fixture.homeId, own: 1, side: 'away' },
  ] as const;
  for (const { id, other, own, side } of sides) {
    const tally = tallies.get(id);
    if (tally === undefined) continue;
    const scored = result.score[own];
    const conceded = result.score[1 - own]!;
    const outcome: StandingResult = scored > conceded ? 'W' : scored === conceded ? 'D' : 'L';
    const points = outcome === 'W' ? POINTS.win : outcome === 'D' ? POINTS.draw : POINTS.loss;
    tally.played += 1;
    tally.points += points;
    if (outcome === 'W') tally.wins += 1;
    else if (outcome === 'D') tally.draws += 1;
    else tally.losses += 1;
    tally.goalsFor += scored;
    tally.goalsAgainst += conceded;
    tally.yellows += result.stats[side].yellows;
    tally.reds += result.stats[side].reds;
    tally.results.push(outcome);
    const key = pairKey(id, other);
    const record = h2h.get(key) ?? { points: 0, goalDifference: 0 };
    record.points += points;
    record.goalDifference += scored - conceded;
    h2h.set(key, record);
  }
}

/** Criteria 1 to 4: negative when `a` is ahead. */
function compareMain(a: Tally, b: Tally): number {
  return (
    b.points - a.points ||
    b.wins - a.wins ||
    b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
    b.goalsFor - a.goalsFor
  );
}

/** Orders the tallies with the eight criteria. */
function sortTallies(
  tallies: readonly Tally[],
  h2h: ReadonlyMap<string, HeadToHead>,
  lottery: ReadonlyMap<ClubId, number>,
): Tally[] {
  // Criteria 6 to 8, shared by both group sizes.
  const compareRest = (a: Tally, b: Tally): number => {
    const byCards = a.reds - b.reds || a.yellows - b.yellows;
    if (byCards !== 0) return byCards;
    const draw = lottery.get(a.clubId)! - lottery.get(b.clubId)!;
    if (draw !== 0) return draw;
    return a.clubId < b.clubId ? -1 : a.clubId > b.clubId ? 1 : 0;
  };
  const sorted = [...tallies].sort((a, b) => compareMain(a, b) || compareRest(a, b));
  // Criterion 5 only inside a group of exactly two clubs level up to criterion 4.
  const out: Tally[] = [];
  for (let i = 0; i < sorted.length;) {
    let j = i + 1;
    while (j < sorted.length && compareMain(sorted[i]!, sorted[j]!) === 0) j++;
    if (j - i === 2) {
      const [a, b] = [sorted[i]!, sorted[i + 1]!];
      const ab = h2h.get(pairKey(a.clubId, b.clubId)) ?? { points: 0, goalDifference: 0 };
      const ba = h2h.get(pairKey(b.clubId, a.clubId)) ?? { points: 0, goalDifference: 0 };
      const head = ba.points - ab.points || ba.goalDifference - ab.goalDifference;
      out.push(...(head > 0 ? [b, a] : [a, b]));
    } else {
      for (let k = i; k < j; k++) out.push(sorted[k]!);
    }
    i = j;
  }
  return out;
}

function toRows(sorted: readonly Tally[]): StandingRow[] {
  return sorted.map((t, index) => ({
    position: index + 1,
    clubId: t.clubId,
    points: t.points,
    played: t.played,
    wins: t.wins,
    draws: t.draws,
    losses: t.losses,
    goalsFor: t.goalsFor,
    goalsAgainst: t.goalsAgainst,
    goalDifference: t.goalsFor - t.goalsAgainst,
    yellows: t.yellows,
    reds: t.reds,
    form: t.results.slice(-FORM_LENGTH),
  }));
}

/** The draw of criterion 8 for every club of the state. */
function lotteryKeys(state: Pick<GameState, 'seed' | 'clubs'>): Map<ClubId, number> {
  const keys = new Map<ClubId, number>();
  for (const clubId of Object.keys(state.clubs)) {
    keys.set(clubId, seedFromString(`${state.seed}-tiebreak-${clubId}`));
  }
  return keys;
}

/** What the table reads from the state. */
export type StandingsState = Pick<GameState, 'seed' | 'clubs' | 'fixtures'>;

/**
 * The table after each round, from 0 (nobody has played: every row at zero, in the order of the
 * draw) to `throughRound`: `history[k]` is the table after round k. One pass over the fixtures,
 * so the facts of a round (facts.ts) read the tables they need at once.
 */
export function standingsHistory(state: StandingsState, throughRound: number): StandingRow[][] {
  const lottery = lotteryKeys(state);
  const tallies = new Map<ClubId, Tally>();
  for (const clubId of Object.keys(state.clubs)) tallies.set(clubId, emptyTally(clubId));
  const h2h = new Map<string, HeadToHead>();
  const byRound = new Map<number, Fixture[]>();
  for (const fixture of state.fixtures) {
    if (fixture.result === undefined || !(fixture.round <= throughRound)) continue;
    const list = byRound.get(fixture.round) ?? [];
    list.push(fixture);
    byRound.set(fixture.round, list);
  }
  const history: StandingRow[][] = [toRows(sortTallies([...tallies.values()], h2h, lottery))];
  for (let round = 1; round <= throughRound; round++) {
    for (const fixture of byRound.get(round) ?? []) addFixture(fixture, tallies, h2h);
    history.push(toRows(sortTallies([...tallies.values()], h2h, lottery)));
  }
  return history;
}

/**
 * The league table (docs/02-architecture.md, 4.1; US-012), derived from the played fixtures with
 * the tie-breaks of temporada.md (see the header). Every club of the state has a row, played or
 * not. `throughRound` (optional) stops at that round, for the position change of the last round
 * (US-023: the table before it is `getStandings(state, state.round - 2)`); by default every
 * played fixture counts. Pure; never throws.
 */
export function getStandings(state: StandingsState, throughRound?: number): StandingRow[] {
  const lottery = lotteryKeys(state);
  const tallies = new Map<ClubId, Tally>();
  for (const clubId of Object.keys(state.clubs)) tallies.set(clubId, emptyTally(clubId));
  const h2h = new Map<string, HeadToHead>();
  const played = state.fixtures
    .filter(
      (f) => f.result !== undefined && (throughRound === undefined || f.round <= throughRound),
    )
    .sort((a, b) => a.round - b.round);
  for (const fixture of played) addFixture(fixture, tallies, h2h);
  return toRows(sortTallies([...tallies.values()], h2h, lottery));
}
