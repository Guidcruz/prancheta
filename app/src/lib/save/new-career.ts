import { CLUB_SETS, latestClubSet, type ClubSet } from '../../data/club-sets.ts';
import {
  newGame,
  type GameParams,
  type GameState,
  type IdentitySource,
  type NewGameSetup,
  type Result,
} from '../../engine/index.ts';

/*
 * The game of a new career (US-014, US-066): the most recent set of club data, and season 1 in
 * that set's year (decision D4). The base season goes to `career.baseSeason` of the save and never
 * changes; the engine gets only the club definitions and the year. The application layer (the
 * `CareerService` of T-023) builds the envelope around it.
 */

export interface NewCareerGame {
  /** `career.baseSeason` of the new save. */
  readonly baseSeason: number;
  readonly game: GameState;
}

export type NewCareerError = 'no-club-set' | 'invalid-clubs' | 'invalid-calendar';

/**
 * A new game with the latest of `sets` (by base season) and `year = baseSeason`. The errors are
 * the engine's, plus `no-club-set` for an empty list (a bug of the build). Never throws.
 */
export function newCareerGame(
  setup: Omit<NewGameSetup, 'year'>,
  params: GameParams,
  identities: IdentitySource,
  sets: readonly ClubSet[] = CLUB_SETS,
): Result<NewCareerGame, NewCareerError> {
  const set = latestClubSet(sets);
  if (set === undefined) return { ok: false, error: 'no-club-set' };
  const created = newGame({ ...setup, year: set.baseSeason }, set.clubs, params, identities);
  if (!created.ok) return created;
  return {
    ok: true,
    value: { baseSeason: set.baseSeason, game: created.value },
    warnings: created.warnings,
  };
}
