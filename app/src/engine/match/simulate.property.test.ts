import { describe, expect, it } from 'vitest';
import { fixtureInput, testGame } from '../testing/match.ts';
import { testParams } from '../testing/params.ts';
import { INJURY_SEVERITIES, RATING, STOPPAGE } from './rules.ts';
import { simulateMatch } from './simulate.ts';
import type { MatchInput, MatchResult } from './types.ts';

/*
 * Invariants of the match over 1,000 seeds (docs/02-architecture.md, 6 "Propriedade"): each seed
 * plays one of the 380 fixtures of a new game (all formations and profiles of the synthetic
 * clubs show up), with its own seed. Since T-010: nobody sent off or injured appears in a later
 * event, cards add up in the statistics, injuries last within their severity and suspensions
 * come only from cards.
 */
const params = testParams();
const state = testGame();
const SEEDS = 1_000;

function inputFor(seed: number): MatchInput {
  const fixture = state.fixtures[seed % state.fixtures.length]!;
  return { ...fixtureInput(state, fixture), seed };
}

function check(input: MatchInput, result: MatchResult): void {
  const goals = { home: 0, away: 0 };
  const chances = { home: 0, away: 0 };
  const saved = { home: 0, away: 0 };
  const cards = { home: { yellow: 0, red: 0 }, away: { yellow: 0, red: 0 } };
  /** Minute each player left the pitch (red card or injury); he takes part in nothing after it. */
  const left = new Map<string, number>();
  const time = (e: MatchResult['events'][number]) =>
    (e.half - 1) * 1000 + e.minute + (e.added ?? 0) / 100;
  const stoppage: number[] = [];
  let previous = -1;
  for (const e of result.events) {
    expect(time(e)).toBeGreaterThanOrEqual(previous);
    previous = time(e);
    for (const id of playersIn(e)) expect(left.has(id), `${id} after leaving`).toBe(false);
    if (e.type === 'goal') goals[e.side]++;
    if (e.type === 'chance' || e.type === 'penaltyMissed') {
      chances[e.side]++;
      if (e.outcome === 'saved') saved[e.side]++;
    }
    if (e.type === 'yellow') cards[e.side].yellow++;
    if (e.type === 'red') cards[e.side].red++;
    if (e.type === 'red' || e.type === 'injury') left.set(e.player, e.minute);
    if (e.type === 'stoppage') stoppage.push(e.minutes);
  }
  const fulltime = result.events.at(-1)!;
  expect(fulltime.type).toBe('fulltime');
  if (fulltime.type === 'fulltime' && fulltime.abandoned) return; // never with real parameters
  expect(stoppage).toHaveLength(2);
  expect(stoppage[0]).toBeGreaterThanOrEqual(STOPPAGE[1].min);
  expect(stoppage[0]).toBeLessThanOrEqual(STOPPAGE[1].max);
  expect(stoppage[1]).toBeGreaterThanOrEqual(STOPPAGE[2].min);
  expect(stoppage[1]).toBeLessThanOrEqual(STOPPAGE[2].max);
  expect(result.score).toEqual([goals.home, goals.away]);
  for (const side of ['home', 'away'] as const) {
    const stats = result.stats[side];
    expect(stats.shots).toBe(goals[side] + chances[side]);
    expect(stats.onTarget).toBe(goals[side] + saved[side]);
    expect(stats.yellows).toBe(cards[side].yellow);
    expect(stats.reds).toBe(cards[side].red);
    expect(stats.possession).toBeGreaterThanOrEqual(30);
    expect(stats.possession).toBeLessThanOrEqual(70);
  }
  expect(result.stats.home.possession + result.stats.away.possession).toBe(100);

  const starters = [...input.home.sheet.lineup.starters, ...input.away.sheet.lineup.starters];
  const condition = new Map(
    [...input.home.players, ...input.away.players].map((p) => [p.id, p.condition]),
  );
  expect(Object.keys(result.ratings)).toHaveLength(22);
  for (const id of starters) {
    expect(result.minutes[id]).toBe(left.get(id) ?? 90);
    const rating = result.ratings[id];
    if (result.minutes[id]! < RATING.minMinutes) expect(rating).toBeNull();
    else {
      expect(rating!).toBeGreaterThanOrEqual(RATING.min);
      expect(rating!).toBeLessThanOrEqual(RATING.max);
    }
    const energy = result.finalEnergy[id]!;
    expect(energy).toBeGreaterThanOrEqual(0);
    expect(energy).toBeLessThanOrEqual(condition.get(id)!);
  }
  expect(result.motm).toBeDefined();
  expect(result.warnings).toEqual([]);
  // Injuries within their severity, suspensions only for cards, counters within 0..2.
  const severity = new Map(
    result.events.flatMap((e) => (e.type === 'injury' ? [[e.player, e.severity] as const] : [])),
  );
  expect(result.newInjuries).toHaveLength(severity.size);
  for (const { player, rounds } of result.newInjuries) {
    const row = INJURY_SEVERITIES.find((r) => r.severity === severity.get(player))!;
    expect(rounds).toBeGreaterThanOrEqual(row.minRounds);
    expect(rounds).toBeLessThanOrEqual(row.maxRounds);
  }
  const sentOff = new Set(result.events.flatMap((e) => (e.type === 'red' ? [e.player] : [])));
  for (const { player, games } of result.newSuspensions) {
    expect(games).toBeGreaterThanOrEqual(1);
    expect(games).toBeLessThanOrEqual(2);
    if (!sentOff.has(player)) expect(games).toBe(1);
  }
  for (const id of sentOff) expect(result.newSuspensions.some((s) => s.player === id)).toBe(true);
  expect(Object.keys(result.yellowCounts).sort()).toEqual(Object.keys(result.minutes).sort());
  for (const count of Object.values(result.yellowCounts)) {
    expect([0, 1, 2]).toContain(count);
  }
}

/** Every player an event names. */
function playersIn(e: MatchResult['events'][number]): string[] {
  switch (e.type) {
    case 'chance':
      return [e.shooter];
    case 'goal':
      return e.assist === undefined ? [e.scorer] : [e.scorer, e.assist];
    case 'penaltyAwarded':
    case 'penaltyMissed':
      return [e.taker];
    case 'yellow':
    case 'red':
    case 'injury':
      return [e.player];
    case 'substitution':
      return [e.out, e.in];
    default:
      return [];
  }
}

describe(`simulateMatch: invariants over ${SEEDS} seeds`, () => {
  it('keeps score, statistics, ratings, energy and time consistent', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const input = inputFor(seed);
      check(input, simulateMatch(input, params));
    }
  });

  it('is deterministic in every seed (a sample of 100, run twice)', () => {
    for (let seed = 0; seed < SEEDS; seed += 10) {
      const input = inputFor(seed);
      expect(JSON.stringify(simulateMatch(input, params))).toBe(
        JSON.stringify(simulateMatch(input, params)),
      );
    }
  });
});
