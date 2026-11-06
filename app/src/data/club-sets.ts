import type { ClubDef } from '../engine/index.ts';
import serieA2026 from './clubs.serie-a.json';

/*
 * The sets of club data, each identified by its base season (US-066; docs/02-architecture.md,
 * 4.2, "Dados de referência dos clubes no save"). The base season is the year played with the set:
 * a new career takes the most recent set, and its season 1 is that year (decision D4). A career
 * keeps the club definitions it started with (`ClubState.def`, frozen in the save; ADR-0006), so a
 * new set changes only careers created after it.
 *
 * The yearly batch (US-067) adds a file and one entry here; each entry passes the full check of
 * US-001 (club-sets.test.ts, also in `npm run content:check`), and no two share a base season.
 */

/** A set of club data and the season it is the reference of. */
export interface ClubSet {
  /** The year played with this set: season 1 of a career created with it (D4). */
  readonly baseSeason: number;
  readonly clubs: readonly ClubDef[];
}

/** Every set in the game, in any order (the newest is chosen by its base season). */
export const CLUB_SETS: readonly ClubSet[] = [
  // Strength from the 2026 reference table, titles up to 2025 (docs/design/clubes-serie-a.md).
  { baseSeason: 2026, clubs: serieA2026 as unknown as readonly ClubDef[] },
];

/** The set with the highest base season, or `undefined` when there is none. */
export function latestClubSet(sets: readonly ClubSet[] = CLUB_SETS): ClubSet | undefined {
  let latest: ClubSet | undefined;
  for (const set of sets) {
    if (latest === undefined || set.baseSeason > latest.baseSeason) latest = set;
  }
  return latest;
}
