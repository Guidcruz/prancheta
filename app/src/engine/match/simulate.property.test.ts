import { describe, expect, it } from 'vitest';
import { fixtureInput, testGame } from '../testing/match.ts';
import { testParams } from '../testing/params.ts';
import { RATING, STOPPAGE } from './rules.ts';
import { simulateMatch } from './simulate.ts';
import type { MatchInput, MatchResult } from './types.ts';

/*
 * Invariants of the match over 1,000 seeds (docs/02-architecture.md, 6 "Propriedade"): each seed
 * plays one of the 380 fixtures of a new game (all formations and profiles of the synthetic
 * clubs show up), with its own seed.
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
  const stoppage: number[] = [];
  let previous = -1;
  for (const e of result.events) {
    const time = (e.half - 1) * 1000 + e.minute + (e.added ?? 0) / 100;
    expect(time).toBeGreaterThanOrEqual(previous);
    previous = time;
    if (e.type === 'goal') goals[e.side]++;
    if (e.type === 'chance') {
      chances[e.side]++;
      if (e.outcome === 'saved') saved[e.side]++;
    }
    if (e.type === 'stoppage') stoppage.push(e.minutes);
  }
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
    expect(result.minutes[id]).toBe(90);
    const rating = result.ratings[id];
    expect(typeof rating).toBe('number');
    expect(rating!).toBeGreaterThanOrEqual(RATING.min);
    expect(rating!).toBeLessThanOrEqual(RATING.max);
    const energy = result.finalEnergy[id]!;
    expect(energy).toBeGreaterThanOrEqual(0);
    expect(energy).toBeLessThanOrEqual(condition.get(id)!);
  }
  expect(result.motm).toBeDefined();
  expect(result.warnings).toEqual([]);
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
