import { describe, expect, it } from 'vitest';
import { BENCH_SIZE } from '../lineup.ts';
import { aiFixtureInput, aiTeamInput, fixtureInput, testGame } from '../testing/match.ts';
import { testParams } from '../testing/params.ts';
import { INJURY_SEVERITIES, MAX_SUBS, RATING, STOPPAGE } from './rules.ts';
import { simulateMatch } from './simulate.ts';
import type { MatchCommand, MatchInput, MatchResult } from './types.ts';

/*
 * Invariants of the match over 1,000 seeds (docs/02-architecture.md, 6 "Propriedade"): each seed
 * plays one of the 380 fixtures of a new game (all formations and profiles of the synthetic
 * clubs show up), with its own seed. Since T-010: nobody sent off or injured appears in a later
 * event, cards add up in the statistics, injuries last within their severity and suspensions
 * come only from cards. Since T-012: odd seeds play with the AI's sheets (bench of 7, in-match
 * AI), and every third of those with the coach on the home side giving a few commands; nobody
 * comes on twice or from outside the bench, at most 5 substitutions per side.
 */
const params = testParams();
const state = testGame();
const SEEDS = 1_000;

const plainInputs = state.fixtures.map((f) => fixtureInput(state, f));
const aiInputs = state.fixtures.map((f) => aiFixtureInput(state, f));
const coachInputs = state.fixtures.map((f) => ({
  ...aiInputs[state.fixtures.indexOf(f)]!,
  home: aiTeamInput(state, f, f.homeId, 'human'),
}));

function inputFor(seed: number): MatchInput {
  const i = seed % state.fixtures.length;
  if (seed % 2 === 0) return { ...plainInputs[i]!, seed };
  return { ...(seed % 3 === 0 ? coachInputs : aiInputs)[i]!, seed };
}

/** A few commands of the coach for the human home side (some of them invalid on purpose). */
function commandsFor(seed: number, input: MatchInput): MatchCommand[] | undefined {
  if (input.home.controller !== 'human') return undefined;
  const { starters, bench } = input.home.sheet.lineup;
  return [
    {
      minute: 10 + (seed % 30),
      side: 'home',
      kind: 'substitution',
      out: starters[1 + (seed % 10)]!,
      in: bench[seed % 7]!,
    },
    {
      minute: 45,
      side: 'home',
      kind: 'halftimeTalk',
      talk: (['motivate', 'demand', 'calm'] as const)[seed % 3]!,
    },
    {
      minute: 50 + (seed % 20),
      side: 'home',
      kind: 'tactic',
      formation: (['4-3-3', '3-5-2', '5-3-2', '4-2-3-1'] as const)[seed % 4]!,
    },
    {
      minute: 75,
      side: 'home',
      kind: 'preset',
      preset: (['press', 'holdResult', 'allOut'] as const)[seed % 3]!,
    },
    {
      minute: 76,
      side: 'home',
      kind: 'substitution',
      out: starters[2 + (seed % 9)]!,
      in: bench[(seed + 3) % 7]!,
    },
  ];
}

function check(input: MatchInput, result: MatchResult): void {
  /** Minute each player came on, and the substitutions of each side. */
  const cameOn = new Map<string, number>();
  const subs = { home: 0, away: 0 };
  const benches = {
    home: new Set(input.home.sheet.lineup.bench.slice(0, BENCH_SIZE)),
    away: new Set(input.away.sheet.lineup.bench.slice(0, BENCH_SIZE)),
  };
  const onPitch = new Set([
    ...input.home.sheet.lineup.starters,
    ...input.away.sheet.lineup.starters,
  ]);
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
    // The substitution of an injured player names him once more, right after his injury.
    const named = e.type === 'substitution' && e.reason === 'injury' ? [e.in] : playersIn(e);
    for (const id of named) expect(left.has(id), `${id} after leaving`).toBe(false);
    if (e.type === 'substitution' && e.reason === 'injury') onPitch.add(e.out);
    if (e.type === 'substitution') {
      subs[e.side]++;
      expect(benches[e.side].has(e.in), `${e.in} from the bench`).toBe(true);
      expect(onPitch.has(e.in), `${e.in} comes on once`).toBe(false);
      expect(onPitch.has(e.out), `${e.out} on the pitch`).toBe(true);
      onPitch.delete(e.out);
      onPitch.add(e.in);
      // The first regulation minute he played: an injury swap or a substitution in added time
      // comes after his minute is counted.
      cameOn.set(e.in, e.reason === 'injury' || e.added !== undefined ? e.minute + 1 : e.minute);
      // A tactical substitution takes effect at the start of its minute: he did not play it (in
      // added time, every regulation minute was already played).
      left.set(e.out, e.reason === 'injury' || e.added !== undefined ? e.minute : e.minute - 1);
    }
    if (e.type === 'goal') goals[e.side]++;
    if (e.type === 'chance' || e.type === 'penaltyMissed') {
      chances[e.side]++;
      if (e.outcome === 'saved') saved[e.side]++;
    }
    if (e.type === 'yellow') cards[e.side].yellow++;
    if (e.type === 'red') cards[e.side].red++;
    if (e.type === 'red' || e.type === 'injury') {
      left.set(e.player, e.minute);
      onPitch.delete(e.player);
    }
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
  expect(subs.home).toBeLessThanOrEqual(MAX_SUBS);
  expect(subs.away).toBeLessThanOrEqual(MAX_SUBS);
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
  expect(Object.keys(result.ratings)).toHaveLength(22 + subs.home + subs.away);
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
  for (const [id, first] of cameOn) {
    const until = left.get(id) ?? 90;
    expect(result.minutes[id]).toBe(Math.max(0, Math.min(90, until) - Math.min(first, 91) + 1));
    expect(result.finalEnergy[id]!).toBeLessThanOrEqual(condition.get(id)!);
  }
  expect(result.motm).toBeDefined();
  // Only the coach's commands may be refused (the generated ones are sometimes invalid).
  for (const w of result.warnings) expect(w.code.startsWith('command-')).toBe(true);
  if (input.home.controller !== 'human') expect(result.warnings).toEqual([]);
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
  it('keeps score, statistics, ratings, energy and time consistent', { timeout: 30_000 }, () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const input = inputFor(seed);
      check(input, simulateMatch(input, params, commandsFor(seed, input)));
    }
  });

  it('is deterministic in every seed (a sample of 100, run twice)', () => {
    for (let seed = 0; seed < SEEDS; seed += 10) {
      const input = inputFor(seed);
      const commands = commandsFor(seed, input);
      expect(JSON.stringify(simulateMatch(input, params, commands))).toBe(
        JSON.stringify(simulateMatch(input, params, commands)),
      );
    }
  });
});
