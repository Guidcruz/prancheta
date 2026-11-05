import type { Fixture } from './fixtures.ts';
import type { MatchResult } from './match/types.ts';
import { SEASON_ROUNDS } from './params.ts';
import type { Player } from './players.ts';
import {
  POINTS,
  RELEGATION_SPOTS,
  roundTables,
  type StandingRow,
  type StandingsState,
} from './standings.ts';
import type { ClubId, PlayerId } from './types.ts';

/*
 * Facts of a round for the content layer (docs/design/temporada.md, "Fatos da tabela para o
 * content-writer"; docs/02-architecture.md, 4.1, `Fact`; T-013). The engine emits typed facts,
 * never text (ADR-0007, rule 5): `lib/content` picks the templates. Every fact is derived from the
 * tables after this round and the one before, the leader after each round (`roundTables`) and the
 * round's results. Rule of temporada.md: only what changed or became a milestone; a run that goes
 * on is not news every week.
 * - `leadership took` (rounds 1) for a new leader, also the first one at round 1; `lost` with it,
 *   for the previous leader, with the rounds in a row he led (never at round 1); `kept` only at
 *   the milestones: the rounds in a row, this one included, at 5, 10, 15, …;
 * - `enteredZ4` / `leftZ4`: from round 2 on, who came into or left the last four;
 * - series milestones, "the minimum, then every 5": `unbeaten` at 5, 10, 15, … games without
 *   losing; `winless` at 4, 9, 14, … games without winning;
 * - end of a series (CEO, 2026-11-05), once, in the round it ends, by the table's score (an
 *   abandoned match by the awarded one): `unbeatenEnded` when the club loses after N ≥ 5 games
 *   without losing, `winlessEnded` when it wins after N ≥ 4 without winning; `games` is N (the
 *   game that ended it does not count), with the `round` and the `opponentId` of that game. The
 *   end has priority: in that round the club has no `unbeaten` nor `winless`;
 * - `championClinched` / `relegatedClinched`: once, in the round it becomes true. The leader is
 *   champion when his lead over the 2nd is greater than `3 × rounds left`; a club is relegated
 *   when the 16th is more than `3 × rounds left` points ahead of it. A tie in that count decides
 *   nothing until the last round, when the table decides everything;
 * - `topScorerOfRound`: the players with the round's most real goals, only when that is 2 or
 *   more; every one level at the top, in the order of their first goal;
 * - `decisiveLastRound`: in the report of round 37, `title` when the champion is still open and
 *   `relegation` when at least one relegation spot is;
 * - `suspended` / `injured`: every new suspension and injury of the round, with the games (or
 *   rounds) the player will miss.
 */

/** A fact of the table or of the round (docs/02-architecture.md, 4.1). */
export type Fact =
  | {
      readonly kind: 'leadership';
      readonly clubId: ClubId;
      readonly change: 'took' | 'lost' | 'kept';
      readonly rounds: number;
    }
  | { readonly kind: 'enteredZ4' | 'leftZ4'; readonly clubId: ClubId }
  | { readonly kind: 'unbeaten' | 'winless'; readonly clubId: ClubId; readonly games: number }
  | {
      /** `games`: the run that ended, without the game that ended it; `opponentId`: that game's. */
      readonly kind: 'unbeatenEnded' | 'winlessEnded';
      readonly clubId: ClubId;
      readonly games: number;
      readonly round: number;
      readonly opponentId: ClubId;
    }
  | { readonly kind: 'championClinched' | 'relegatedClinched'; readonly clubId: ClubId }
  | { readonly kind: 'topScorerOfRound'; readonly playerId: PlayerId; readonly goals: number }
  | { readonly kind: 'decisiveLastRound'; readonly stakes: 'title' | 'relegation' }
  | { readonly kind: 'suspended' | 'injured'; readonly playerId: PlayerId; readonly games: number };

/** "invencibilidade": the first milestone, 5 games without losing (temporada.md). */
export const UNBEATEN_MIN_GAMES = 5;
/** "jejum": the first milestone, 4 games without winning (temporada.md). */
export const WINLESS_MIN_GAMES = 4;
/** "liderança manteve": the first milestone, 5 rounds in a row at the top (temporada.md). */
export const LEADERSHIP_MIN_ROUNDS = 5;
/** After the first milestone, a run is a fact again every this many (temporada.md). */
export const MILESTONE_STEP = 5;
/** `topScorerOfRound` only when the most goals of the round reach this (temporada.md). */
export const TOP_SCORER_MIN_GOALS = 2;

/** A run is a milestone at its minimum and then every MILESTONE_STEP (5, 10, 15 or 4, 9, 14). */
export function isMilestone(run: number, minimum: number): boolean {
  return run >= minimum && (run - minimum) % MILESTONE_STEP === 0;
}

/** Rounds in a row (ending at `round`) that `clubId` led the table. */
function leadStreak(
  leaders: readonly (ClubId | undefined)[],
  round: number,
  clubId: ClubId,
): number {
  let rounds = 0;
  for (let k = round; k >= 1 && leaders[k] === clubId; k--) rounds++;
  return rounds;
}

/** The last {@link RELEGATION_SPOTS} of a table; nobody before round 1. */
function relegationZone(table: readonly StandingRow[], round: number): ClubId[] {
  if (round < 1) return [];
  return table.slice(Math.max(0, table.length - RELEGATION_SPOTS)).map((row) => row.clubId);
}

/** The most points a club can still win after `round`. */
const pointsLeft = (round: number) => POINTS.win * (SEASON_ROUNDS - round);

function championClinched(table: readonly StandingRow[], round: number): boolean {
  if (round < 1 || table.length === 0) return false;
  if (round >= SEASON_ROUNDS) return true;
  const second = table[1];
  return second === undefined || table[0]!.points - second.points > pointsLeft(round);
}

/** Clubs already relegated after `round`, in table order. */
function relegated(table: readonly StandingRow[], round: number): ClubId[] {
  if (round < 1) return [];
  const zone = Math.max(0, table.length - RELEGATION_SPOTS);
  const rows = table.slice(zone);
  if (round >= SEASON_ROUNDS) return rows.map((row) => row.clubId);
  const safe = table[zone - 1];
  if (safe === undefined) return [];
  return rows.filter((row) => safe.points - row.points > pointsLeft(round)).map((r) => r.clubId);
}

/** A club's runs after its last played fixture, and how that fixture ended the runs before it. */
interface ClubRuns {
  unbeaten: number;
  winless: number;
  /** The run without losing that this round's defeat ended (0 when none). */
  unbeatenEnded: number;
  /** The run without winning that this round's win ended (0 when none). */
  winlessEnded: number;
  /** The opponent of the club's last fixture of this round. */
  opponentId?: ClubId;
}

/**
 * Current unbeaten and winless runs of every club, from its played fixtures in round order (the
 * table's score: an abandoned match counts with the awarded one), and the runs that a fixture of
 * `round` ended.
 */
function runs(fixtures: readonly Fixture[], round: number): Map<ClubId, ClubRuns> {
  const out = new Map<ClubId, ClubRuns>();
  const played = fixtures
    .filter((f) => f.result !== undefined && f.round <= round)
    .sort((a, b) => a.round - b.round);
  for (const f of played) {
    const [home, away] = f.result!.score;
    for (const [id, opponentId, own, other] of [
      [f.homeId, f.awayId, home, away],
      [f.awayId, f.homeId, away, home],
    ] as const) {
      const run = out.get(id) ?? { unbeaten: 0, winless: 0, unbeatenEnded: 0, winlessEnded: 0 };
      const thisRound = f.round === round;
      run.unbeatenEnded = thisRound && own < other ? run.unbeaten : 0;
      run.winlessEnded = thisRound && own > other ? run.winless : 0;
      if (thisRound) run.opponentId = opponentId;
      run.unbeaten = own >= other ? run.unbeaten + 1 : 0;
      run.winless = own > other ? 0 : run.winless + 1;
      out.set(id, run);
    }
  }
  return out;
}

/**
 * The facts of `round`, already applied to `state` (its fixtures have the round's results and
 * its players the new suspensions). `results` are the round's matches in fixture order.
 */
export function roundFacts(
  state: StandingsState & { readonly players: Readonly<Record<PlayerId, Player>> },
  round: number,
  results: readonly MatchResult[],
): Fact[] {
  const facts: Fact[] = [];
  const { before, now, leaders } = roundTables(state, round);

  // Leadership.
  const leader = now[0]?.clubId;
  const previous = round > 1 ? before[0]?.clubId : undefined;
  if (leader !== undefined) {
    if (leader === previous) {
      const rounds = leadStreak(leaders, round, leader);
      if (isMilestone(rounds, LEADERSHIP_MIN_ROUNDS)) {
        facts.push({ kind: 'leadership', clubId: leader, change: 'kept', rounds });
      }
    } else {
      facts.push({ kind: 'leadership', clubId: leader, change: 'took', rounds: 1 });
      if (previous !== undefined) {
        facts.push({
          kind: 'leadership',
          clubId: previous,
          change: 'lost',
          rounds: leadStreak(leaders, round - 1, previous),
        });
      }
    }
  }

  // Z4, from round 2 on (there is no zone before the first game).
  const zoneNow = round > 1 ? relegationZone(now, round) : [];
  const zoneBefore = new Set(relegationZone(before, round - 1));
  for (const id of zoneNow) if (!zoneBefore.has(id)) facts.push({ kind: 'enteredZ4', clubId: id });
  const zoneNowSet = new Set(zoneNow);
  for (const row of now) {
    if (zoneBefore.has(row.clubId) && !zoneNowSet.has(row.clubId)) {
      facts.push({ kind: 'leftZ4', clubId: row.clubId });
    }
  }

  // Runs, in table order. The end of a run has priority over the milestones of that club.
  const clubRuns = runs(state.fixtures, round);
  for (const row of now) {
    const run = clubRuns.get(row.clubId);
    if (run === undefined) continue;
    const { clubId } = row;
    const opponentId = run.opponentId ?? '';
    let ended = false;
    if (run.unbeatenEnded >= UNBEATEN_MIN_GAMES) {
      facts.push({ kind: 'unbeatenEnded', clubId, games: run.unbeatenEnded, round, opponentId });
      ended = true;
    }
    if (run.winlessEnded >= WINLESS_MIN_GAMES) {
      facts.push({ kind: 'winlessEnded', clubId, games: run.winlessEnded, round, opponentId });
      ended = true;
    }
    if (ended) continue;
    if (isMilestone(run.unbeaten, UNBEATEN_MIN_GAMES)) {
      facts.push({ kind: 'unbeaten', clubId: row.clubId, games: run.unbeaten });
    }
    if (isMilestone(run.winless, WINLESS_MIN_GAMES)) {
      facts.push({ kind: 'winless', clubId: row.clubId, games: run.winless });
    }
  }

  // Clinched.
  if (championClinched(now, round) && !championClinched(before, round - 1)) {
    facts.push({ kind: 'championClinched', clubId: now[0]!.clubId });
  }
  const wasRelegated = new Set(relegated(before, round - 1));
  for (const id of relegated(now, round)) {
    if (!wasRelegated.has(id)) facts.push({ kind: 'relegatedClinched', clubId: id });
  }

  // Top scorers of the round.
  const goals = new Map<PlayerId, number>();
  for (const result of results) {
    for (const event of result.events) {
      if (event.type === 'goal') goals.set(event.scorer, (goals.get(event.scorer) ?? 0) + 1);
    }
  }
  let most = 0;
  for (const n of goals.values()) if (n > most) most = n;
  if (most >= TOP_SCORER_MIN_GOALS) {
    for (const [playerId, n] of goals) {
      if (n === most) facts.push({ kind: 'topScorerOfRound', playerId, goals: n });
    }
  }

  // The last round decides something.
  if (round === SEASON_ROUNDS - 1) {
    if (!championClinched(now, round)) facts.push({ kind: 'decisiveLastRound', stakes: 'title' });
    if (relegated(now, round).length < Math.min(RELEGATION_SPOTS, now.length)) {
      facts.push({ kind: 'decisiveLastRound', stakes: 'relegation' });
    }
  }

  // New suspensions and injuries, in match order.
  for (const result of results) {
    for (const { player } of result.newSuspensions) {
      const games = state.players[player]?.suspendedGames;
      if (games !== undefined && games > 0)
        facts.push({ kind: 'suspended', playerId: player, games });
    }
    for (const { player } of result.newInjuries) {
      const games = state.players[player]?.injuryRounds;
      if (games !== undefined && games > 0)
        facts.push({ kind: 'injured', playerId: player, games });
    }
  }
  return facts;
}
