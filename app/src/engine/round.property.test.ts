import { describe, expect, it } from 'vitest';
import type { ClubState, GameState } from './game.ts';
import { RATING_RANGE, RECENT_RATINGS_MAX, type Player } from './players.ts';
import { playRound } from './round.ts';
import { Rng, seedFromString } from './rng.ts';
import { testGame } from './testing/match.ts';
import { testParams } from './testing/params.ts';
import type { ClubId, PlayerId } from './types.ts';

/*
 * Bounds between rounds (US-010 "limites", US-026 "fica sempre entre 0 e 100"; T-014): seasons of
 * 38 rounds from random starting states (morale, thermometer and streaks at the edges or anywhere,
 * fatigue), with random coach decisions every round (beyond the cap too) and both realism modes.
 * After every round: morale, condition and thermometer within 0..100, the form with at most 5
 * ratings of 3 to 10, the streaks non-negative integers, and nothing NaN.
 */
const params = testParams();
const SEASONS = 6;

function randomStart(seed: number): GameState {
  const rng = new Rng(seedFromString(`round-property-${seed}`));
  const base = testGame(seed);
  const pick = () => {
    const k = rng.int(0, 3);
    return k === 0 ? 0 : k === 1 ? 100 : rng.next() * 100;
  };
  const players: Record<PlayerId, Player> = {};
  for (const [id, p] of Object.entries(base.players)) {
    players[id] = {
      ...p,
      morale: pick(),
      condition: 40 + rng.next() * 60,
      benchStreak: rng.int(0, 6),
    };
  }
  const clubs: Record<ClubId, ClubState> = {};
  for (const [id, c] of Object.entries(base.clubs)) {
    clubs[id] = { ...c, fans: pick(), idolBenchStreak: rng.int(0, 3) };
  }
  return {
    ...base,
    players,
    clubs,
    rules: { realism: seed % 2 === 0 ? 'full' : 'simplified' },
  };
}

function problems(state: GameState, round: number): string[] {
  const out: string[] = [];
  const within = (x: number, min: number, max: number) =>
    Number.isFinite(x) && x >= min && x <= max;
  const count = (x: number) => Number.isInteger(x) && x >= 0;
  for (const [id, p] of Object.entries(state.players)) {
    const at = `round ${round}, ${id}`;
    if (!within(p.morale, 0, 100)) out.push(`${at}: morale ${p.morale}`);
    if (!within(p.condition, 0, 100)) out.push(`${at}: condition ${p.condition}`);
    if (p.recentRatings.length > RECENT_RATINGS_MAX)
      out.push(`${at}: ${p.recentRatings.length} ratings`);
    for (const r of p.recentRatings) {
      if (!within(r, RATING_RANGE.min, RATING_RANGE.max)) out.push(`${at}: rating ${r}`);
    }
    if (!count(p.benchStreak)) out.push(`${at}: benchStreak ${p.benchStreak}`);
  }
  for (const [id, c] of Object.entries(state.clubs)) {
    if (!within(c.fans, 0, 100)) out.push(`round ${round}, ${id}: fans ${c.fans}`);
    if (!count(c.idolBenchStreak)) out.push(`round ${round}, ${id}: idol ${c.idolBenchStreak}`);
  }
  return out;
}

describe('properties between rounds: every state within its bounds', () => {
  it(
    `${SEASONS} seasons from random states, with random decisions and both realisms`,
    { timeout: 120_000 },
    () => {
      const found: string[] = [];
      for (let seed = 1; seed <= SEASONS; seed++) {
        const rng = new Rng(seedFromString(`round-property-decisions-${seed}`));
        let state = randomStart(seed);
        const clubIds = Object.keys(state.clubs);
        for (let round = 1; round <= 38; round++) {
          const fanDecisions: Record<ClubId, number> = {};
          for (const id of clubIds) if (rng.next() < 0.3) fanDecisions[id] = rng.next() * 20 - 10;
          const played = playRound(state, params, {
            round,
            sheets: {},
            commands: {},
            fanDecisions,
          });
          if (!played.ok) throw new Error(`playRound ${round}: ${played.error}`);
          state = played.value.state;
          found.push(...problems(state, round));
        }
      }
      expect(found).toEqual([]);
    },
  );
});
