import { describe, expect, it } from 'vitest';
import { validateParams, type GameParams } from '../params.ts';
import { fixtureInput, testGame } from '../testing/match.ts';
import { testParams } from '../testing/params.ts';
import type { Side } from '../types.ts';
import { chanceProbability, comfortableLeadFactor } from './rules.ts';
import { simulateMatch } from './simulate.ts';
import type { MatchEvent, MatchInput, MatchResult } from './types.ts';

/*
 * "Tirar o pé" (partida.md, "Calibragem das goleadas"; T-016): a side leading by
 * `match.comfortableLeadGoals` or more creates chances with `Power × match.comfortableLeadPower`.
 * The repository value is neutral (1) until the game-designer tunes it with the /balance, so the
 * goldens of the match, the round and the season do not move (they run with testParams()).
 */

const neutral = testParams();
const relaxed = (power: number, goals = 2): GameParams => ({
  ...neutral,
  match: { ...neutral.match, comfortableLeadPower: power, comfortableLeadGoals: goals },
});

describe('comfortableLeadFactor', () => {
  it('is 1 for every score with the neutral factor', () => {
    for (let own = 0; own <= 6; own++) {
      for (let other = 0; other <= 6; other++) {
        expect(comfortableLeadFactor(own, other, neutral.match)).toBe(1);
      }
    }
  });

  it('with 0.85 lowers a lead of 2 or more and never a lead of 1, a draw or a deficit', () => {
    const { match } = relaxed(0.85);
    expect(comfortableLeadFactor(2, 0, match)).toBe(0.85);
    expect(comfortableLeadFactor(3, 1, match)).toBe(0.85);
    expect(comfortableLeadFactor(6, 0, match)).toBe(0.85);
    expect(comfortableLeadFactor(1, 0, match)).toBe(1);
    expect(comfortableLeadFactor(3, 2, match)).toBe(1);
    expect(comfortableLeadFactor(2, 2, match)).toBe(1);
    expect(comfortableLeadFactor(0, 2, match)).toBe(1);
  });

  it('follows match.comfortableLeadGoals', () => {
    const { match } = relaxed(0.85, 3);
    expect(comfortableLeadFactor(2, 0, match)).toBe(1);
    expect(comfortableLeadFactor(3, 0, match)).toBe(0.85);
  });

  it('cuts the chance of the side leading by 2 against the same defence', () => {
    const { match } = relaxed(0.85);
    const p = (lead: number) =>
      chanceProbability(70 * comfortableLeadFactor(lead, 0, match), 70, match);
    expect(p(1)).toBe(chanceProbability(70, 70, match));
    expect(p(2)).toBeLessThan(p(1));
  });
});

describe('the parameters of "tirar o pé"', () => {
  const raw = (patch: Record<string, unknown>) => ({
    ...neutral,
    match: { ...neutral.match, ...patch },
  });

  it('are neutral in the test parameters (the goldens run with them)', () => {
    expect(neutral.match.comfortableLeadPower).toBe(1);
    expect(neutral.match.comfortableLeadGoals).toBe(2);
    expect(validateParams(neutral).ok).toBe(true);
  });

  it('accept the range of partida.md and refuse what is outside it', () => {
    expect(validateParams(raw({ comfortableLeadPower: 0.7 })).ok).toBe(true);
    expect(validateParams(raw({ comfortableLeadPower: 0.69 })).ok).toBe(false);
    expect(validateParams(raw({ comfortableLeadPower: 1.01 })).ok).toBe(false);
    expect(validateParams(raw({ comfortableLeadGoals: 1 })).ok).toBe(false);
    expect(validateParams(raw({ comfortableLeadGoals: 2.5 })).ok).toBe(false);
    expect(validateParams(raw({ comfortableLeadGoals: 5 })).ok).toBe(true);
  });
});

const state = testGame();
// The fixtures of the first rounds, with the seeds varied, so some sides get a 2-goal lead.
const inputs: MatchInput[] = [];
for (const fixture of state.fixtures.slice(0, 40)) {
  const input = fixtureInput(state, fixture);
  for (let k = 0; k < 50; k++) {
    inputs.push({ ...input, seed: (input.seed + k * 7919) >>> 0, fixtureId: `${fixture.id}-${k}` });
  }
}

/** Regulation-or-added position of an event, comparable across the two halves. */
const moment = (e: MatchEvent) => e.minute * 10 + (e.added ?? 0);

/** The moment the first 2-goal lead began, or undefined when no side ever had one. */
function firstTwoGoalLead(result: MatchResult): number | undefined {
  for (const e of result.events) {
    if (e.type === 'goal' && Math.abs(e.score[0] - e.score[1]) >= 2) return moment(e);
  }
  return undefined;
}

/**
 * Chances (shots of the stats: open-play chances, free kicks and penalties, goals included) a
 * side created while it already led by 2 or more, summed over both sides.
 */
function chancesLeadingByTwo(result: MatchResult): number {
  const score: Record<Side, number> = { home: 0, away: 0 };
  const other = (side: Side): Side => (side === 'home' ? 'away' : 'home');
  let count = 0;
  for (const e of result.events) {
    const created =
      e.type === 'chance' ||
      e.type === 'penaltyAwarded' ||
      (e.type === 'goal' && e.kind !== 'penalty');
    if (created && score[e.side] - score[other(e.side)] >= 2) count += 1;
    if (e.type === 'goal') score[e.side] += 1;
  }
  return count;
}

describe('simulateMatch with "tirar o pé"', () => {
  it('the neutral factor changes nothing, whatever comfortableLeadGoals is', () => {
    for (const input of inputs.slice(0, 200)) {
      const base = simulateMatch(input, neutral);
      expect(simulateMatch(input, relaxed(1, 3))).toEqual(base);
      expect(simulateMatch(input, relaxed(1, 5))).toEqual(base);
    }
  });

  it('with 0.85, a match in which nobody led by 2 is the same, event by event', () => {
    let checked = 0;
    for (const input of inputs) {
      const base = simulateMatch(input, neutral);
      if (firstTwoGoalLead(base) !== undefined) continue;
      expect(simulateMatch(input, relaxed(0.85))).toEqual(base);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(500);
  });

  it('with 0.85, a match is the same up to the goal that made a 2-goal lead', () => {
    let checked = 0;
    for (const input of inputs) {
      const base = simulateMatch(input, neutral);
      const from = firstTwoGoalLead(base);
      if (from === undefined) continue;
      const other = simulateMatch(input, relaxed(0.85));
      const upTo = (r: MatchResult) => r.events.filter((e) => moment(e) <= from);
      expect(upTo(other)).toEqual(upTo(base));
      checked += 1;
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('with 0.85, the side leading by 2 or more creates fewer chances', () => {
    let base = 0;
    let lowered = 0;
    for (const input of inputs) {
      base += chancesLeadingByTwo(simulateMatch(input, neutral));
      lowered += chancesLeadingByTwo(simulateMatch(input, relaxed(0.85)));
    }
    expect(base).toBeGreaterThan(500);
    // About 14% fewer per minute at a power of 70 (exp(0.14 × −10.5 / 10) ≈ 0.86).
    expect(lowered / base).toBeLessThan(0.95);
  });
});
