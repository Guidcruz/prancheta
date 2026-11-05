import type { Fact } from './facts.ts';
import type { MatchEvent, MatchMarker, MatchResult } from './match/types.ts';
import type { RoundReport } from './round.ts';
import type { FixtureId, PlayerId } from './types.ts';

/*
 * The round's report kept outside the state (docs/02-architecture.md, 4.1, "Relatório da rodada
 * fora do estado"; T-049). `playRound` returns the whole `RoundReport`, which the screens and the
 * content read at once, and the state no longer carries it. What the application keeps comes from
 * two pure projections:
 * - `roundRecap(report)`: the round summary after reopening the app (`CareerSave.career.lastRound`)
 *   and, online, `round_results.report_gz`. Per match, the events, the score, the stats and the
 *   small fields; the per-player maps the round already applied to `players` and `seasonStats`
 *   (ratings, minutes, energy, conceded, yellow counts, injuries, suspensions) and the warnings
 *   stay out;
 * - `matchSheet(result)`: the match sheet of a fixture already played (US-019), with only the
 *   events a sheet shows and the rating of the best on the pitch. The sheet on the screen is
 *   `Fixture.result` (`MatchSummary`) + `MatchSheet`.
 * Neither changes its input nor shares a mutable array with it.
 */

/** One match of a {@link RoundRecap}: the lean part of a `MatchResult`. */
export interface MatchRecap {
  readonly fixtureId: FixtureId;
  readonly score: readonly [number, number];
  readonly events: readonly MatchEvent[];
  readonly stats: MatchResult['stats'];
  readonly motm?: PlayerId;
  /** The rating of the best on the pitch (the match sheet, US-019); absent without `motm`. */
  readonly motmRating?: number;
  readonly markers: readonly MatchMarker[];
  readonly attendance: number;
}

/** The round report as kept outside the state: no per-player maps, no warnings. */
export interface RoundRecap {
  readonly season: number;
  readonly round: number;
  /** The 10 matches, in fixture order (as in the report). */
  readonly results: readonly MatchRecap[];
  readonly facts: readonly Fact[];
}

/** The events a match sheet shows (US-019). */
export type MatchSheetEvent = Extract<
  MatchEvent,
  { type: 'goal' | 'penaltyMissed' | 'yellow' | 'red' | 'injury' | 'substitution' }
>;

/** The match sheet of a played fixture: `Fixture.result` + this (US-019). */
export interface MatchSheet {
  readonly fixtureId: FixtureId;
  /** Only goals, missed penalties, cards, injuries and substitutions, in match order. */
  readonly events: readonly MatchSheetEvent[];
  readonly motmRating?: number;
}

/** The event types a {@link MatchSheet} keeps. */
export const MATCH_SHEET_EVENTS: readonly MatchSheetEvent['type'][] = [
  'goal',
  'penaltyMissed',
  'yellow',
  'red',
  'injury',
  'substitution',
];

const SHEET_EVENTS: ReadonlySet<MatchEvent['type']> = new Set(MATCH_SHEET_EVENTS);

function isSheetEvent(event: MatchEvent): event is MatchSheetEvent {
  return SHEET_EVENTS.has(event.type);
}

/** The rating of the best on the pitch: absent without `motm` or when he has no rating. */
function motmRatingOf(result: MatchResult | MatchRecap): number | undefined {
  if ('ratings' in result) {
    if (result.motm === undefined || !Object.hasOwn(result.ratings, result.motm)) return undefined;
    return result.ratings[result.motm] ?? undefined;
  }
  return result.motmRating;
}

/** The lean form of one match (see {@link RoundRecap}). */
function matchRecap(result: MatchResult): MatchRecap {
  const motmRating = motmRatingOf(result);
  return {
    fixtureId: result.fixtureId,
    score: [result.score[0], result.score[1]],
    events: [...result.events],
    stats: { home: { ...result.stats.home }, away: { ...result.stats.away } },
    ...(result.motm === undefined ? {} : { motm: result.motm }),
    ...(motmRating === undefined ? {} : { motmRating }),
    markers: [...result.markers],
    attendance: result.attendance,
  };
}

/**
 * The round report in the form kept outside the state (docs/02-architecture.md, 4.1): per match
 * `fixtureId`, `score`, `events`, `stats`, `motm`, `motmRating`, `markers` and `attendance`, and
 * the round's `facts`. Pure; absent optional fields are left out, so the recap is JSON-exact.
 */
export function roundRecap(report: RoundReport): RoundRecap {
  return {
    season: report.season,
    round: report.round,
    results: report.results.map(matchRecap),
    facts: [...report.facts],
  };
}

/**
 * The match sheet of a played fixture (US-019; docs/02-architecture.md, 4.1): the sheet events
 * ({@link MATCH_SHEET_EVENTS}) in match order and the rating of the best on the pitch. Accepts the
 * full result (right after the round) or its recap (the last round, after reopening the app): both
 * give the same sheet.
 */
export function matchSheet(result: MatchResult | MatchRecap): MatchSheet {
  const motmRating = motmRatingOf(result);
  return {
    fixtureId: result.fixtureId,
    events: result.events.filter(isSheetEvent),
    ...(motmRating === undefined ? {} : { motmRating }),
  };
}
