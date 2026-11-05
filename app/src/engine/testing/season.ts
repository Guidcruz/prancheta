/**
 * Seasons for the end-of-season tests (T-017): a whole season of the synthetic clubs played by
 * the AI (cached by seed: tests never change it), and a quick "finished" state with made-up
 * season stats, for the rules that do not need real matches.
 *
 * Test-only code: never imported by `index.ts`.
 */
import type { GameState } from '../game.ts';
import { playRound, type PlayerSeasonStats } from '../round.ts';
import type { PlayerId } from '../types.ts';
import { testGame } from './match.ts';
import { testParams } from './params.ts';

const played = new Map<number, GameState>();

/** The 38 rounds of `testGame(seed)` by the AI: the state at round 39, `phase: 'season'`. */
export function playedSeason(seed: number, start: GameState = testGame(seed)): GameState {
  const cached = start === testGame(seed) ? played.get(seed) : undefined;
  if (cached !== undefined) return cached;
  const params = testParams();
  let state = start;
  while (state.phase === 'season' && state.round <= 38) {
    const r = playRound(state, params, {
      round: state.round,
      sheets: {},
      commands: {},
      fanDecisions: {},
    });
    if (!r.ok) throw new Error(`playRound ${state.round}: ${r.error}`);
    state = r.value.state;
  }
  if (start === testGame(seed)) played.set(seed, state);
  return state;
}

/** Season stats with every count at 0 but the given ones. */
export function seasonStats(partial: Partial<PlayerSeasonStats> = {}): PlayerSeasonStats {
  return {
    games: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    yellows: 0,
    reds: 0,
    ratingSum: 0,
    ratedGames: 0,
    conceded: 0,
    ...partial,
  };
}

/** A new game moved to round 39 with exactly these season stats (no match was played). */
export function finishedWith(
  stats: Readonly<Record<PlayerId, PlayerSeasonStats>>,
  start: GameState = testGame(),
): GameState {
  return { ...start, round: 39, seasonStats: stats };
}
