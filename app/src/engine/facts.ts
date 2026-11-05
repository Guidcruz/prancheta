import type { Fixture } from './fixtures.ts';
import type { MatchResult } from './match/types.ts';
import { SEASON_ROUNDS } from './params.ts';
import type { Player } from './players.ts';
import {
  POINTS,
  RELEGATION_SPOTS,
  standingsHistory,
  type StandingRow,
  type StandingsState,
} from './standings.ts';
import type { ClubId, PlayerId } from './types.ts';

/*
 * Facts of a round for the content layer (docs/design/temporada.md, "Fatos da tabela para o
 * content-writer"; docs/02-architecture.md, 4.1, `Fact`; T-013). The engine emits typed facts,
 * never text (ADR-0007, rule 5): `lib/content` picks the templates. Every fact is derived from the
 * tables after this round and the one before (`standingsHistory`) and from the round's results.
 *
 * Reading of the definitions, where temporada.md leaves the detail open (registered in the T-013
 * report for the game-designer):
 * - before round 1 there is no table yet: nobody leads and nobody is in the Z4, so round 1 gives
 *   `leadership took` for the leader and `enteredZ4` for the last four;
 * - `leadership`: `took` (rounds 1) for a new leader and `lost` for the previous one (rounds = how
 *   many rounds in a row he had led); `kept` with the rounds in a row, this one included;
 * - `unbeaten` / `winless`: the current run of the club, every round it is at least
 *   {@link UNBEATEN_MIN_GAMES} / {@link WINLESS_MIN_GAMES};
 * - `championClinched` / `relegatedClinched`: once, in the round it becomes true. The leader is
 *   champion when his lead over the 2nd is greater than `3 × rounds left`; a club is relegated
 *   when the 16th is more than `3 × rounds left` points ahead of it. A tie in that count decides
 *   nothing until the last round, when the table decides everything;
 * - `topScorerOfRound`: every player with the round's most goals (real goals, at least 1), in
 *   the order of their first goal;
 * - `decisiveLastRound`: in the report of round 37, `title` when the champion is still open and
 *   `relegation` when at least one relegation spot is;
 * - `suspended` / `injured`: the new suspensions and injuries of the round, with the games (or
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
  | { readonly kind: 'championClinched' | 'relegatedClinched'; readonly clubId: ClubId }
  | { readonly kind: 'topScorerOfRound'; readonly playerId: PlayerId; readonly goals: number }
  | { readonly kind: 'decisiveLastRound'; readonly stakes: 'title' | 'relegation' }
  | { readonly kind: 'suspended' | 'injured'; readonly playerId: PlayerId; readonly games: number };

/** "invencibilidade (N jogos sem perder, N ≥ 5)" (temporada.md). */
export const UNBEATEN_MIN_GAMES = 5;
/** "jejum (N jogos sem vencer, N ≥ 4)" (temporada.md). */
export const WINLESS_MIN_GAMES = 4;

/** Rounds in a row (ending at `round`) that `clubId` led the table. */
function leadStreak(history: readonly StandingRow[][], round: number, clubId: ClubId): number {
  let rounds = 0;
  for (let k = round; k >= 1 && history[k]![0]?.clubId === clubId; k--) rounds++;
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

/** Current unbeaten and winless runs of every club, from its played fixtures in round order. */
function runs(
  fixtures: readonly Fixture[],
  round: number,
): Map<ClubId, { unbeaten: number; winless: number }> {
  const out = new Map<ClubId, { unbeaten: number; winless: number }>();
  const played = fixtures
    .filter((f) => f.result !== undefined && f.round <= round)
    .sort((a, b) => a.round - b.round);
  for (const f of played) {
    const [home, away] = f.result!.score;
    for (const [id, own, other] of [
      [f.homeId, home, away],
      [f.awayId, away, home],
    ] as const) {
      const run = out.get(id) ?? { unbeaten: 0, winless: 0 };
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
  const history = standingsHistory(state, round);
  const now = history[round] ?? [];
  const before = history[round - 1] ?? [];

  // Leadership.
  const leader = now[0]?.clubId;
  const previous = round > 1 ? before[0]?.clubId : undefined;
  if (leader !== undefined) {
    if (leader === previous) {
      facts.push({
        kind: 'leadership',
        clubId: leader,
        change: 'kept',
        rounds: leadStreak(history, round, leader),
      });
    } else {
      facts.push({ kind: 'leadership', clubId: leader, change: 'took', rounds: 1 });
      if (previous !== undefined) {
        facts.push({
          kind: 'leadership',
          clubId: previous,
          change: 'lost',
          rounds: leadStreak(history, round - 1, previous),
        });
      }
    }
  }

  // Z4.
  const zoneNow = relegationZone(now, round);
  const zoneBefore = new Set(relegationZone(before, round - 1));
  for (const id of zoneNow) if (!zoneBefore.has(id)) facts.push({ kind: 'enteredZ4', clubId: id });
  const zoneNowSet = new Set(zoneNow);
  for (const row of now) {
    if (zoneBefore.has(row.clubId) && !zoneNowSet.has(row.clubId)) {
      facts.push({ kind: 'leftZ4', clubId: row.clubId });
    }
  }

  // Runs, in table order.
  const clubRuns = runs(state.fixtures, round);
  for (const row of now) {
    const run = clubRuns.get(row.clubId);
    if (run === undefined) continue;
    if (run.unbeaten >= UNBEATEN_MIN_GAMES) {
      facts.push({ kind: 'unbeaten', clubId: row.clubId, games: run.unbeaten });
    }
    if (run.winless >= WINLESS_MIN_GAMES) {
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
  for (const [playerId, n] of goals) {
    if (n === most) facts.push({ kind: 'topScorerOfRound', playerId, goals: n });
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
