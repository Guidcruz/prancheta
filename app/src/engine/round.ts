import { suggestSheet } from './ai.ts';
import { clubIdol, expectedPoints, fansDelta, fansVenue, IDOL_BENCH, winlessRuns } from './fans.ts';
import { roundFacts, type Fact } from './facts.ts';
import { daysBetween, type Fixture } from './fixtures.ts';
import type { ClubState, GameState } from './game.ts';
import type { TeamSheet } from './lineup.ts';
import { clamp } from './math.ts';
import { simulateMatch } from './match/simulate.ts';
import type {
  MatchCommand,
  MatchGoal,
  MatchInput,
  MatchResult,
  MatchSummary,
  TeamInput,
} from './match/types.ts';
import { SEASON_ROUNDS, type GameParams } from './params.ts';
import { RECENT_RATINGS_MAX, type Player } from './players.ts';
import { fail, ok } from './result.ts';
import { seedFromString } from './rng.ts';
import { isUnavailable } from './selection.ts';
import { roundTables, type StandingRow } from './standings.ts';
import type {
  ClubId,
  ClubSize,
  EngineWarning,
  FixtureId,
  PlayerId,
  Result,
  Side,
} from './types.ts';
import { ENGINE_VERSION } from './version.ts';

/*
 * A league round (docs/02-architecture.md, 4.1 "Rodada" and the flow "Rodada na carreira";
 * docs/design/temporada.md, "Ordem do processamento de uma rodada"; US-012; T-013).
 *
 * `prepareRound` builds the 10 matches of the current round: the AI's sheets (`suggestSheet`),
 * the coach's sheet or the suggestion for him, the seeds and the stadiums. `playRound` prepares
 * the same plan, simulates the 10 matches (with the coach's commands) and applies them, in the
 * order of temporada.md:
 * 1. the sheets (prepareRound);
 * 2. the 10 matches, each with its own seed `${seed}-s${season}-r${round}-${homeId}-${awayId}`,
 *    so they run in any order (ADR-0007, rule 2);
 * 3. the results in the fixtures (the table is derived from them, standings.ts), and the season
 *    stats of each player who took the pitch;
 * 4. the suspensions served and the rounds of injury counted down, then the new ones: 1 game off
 *    `suspendedGames` for every player of a club that played, 1 round off `injuryRounds` for
 *    every player; then `newSuspensions` added, `newInjuries` written and `yellowCounts` merged
 *    (only who took the pitch is in it); `clubAppearances` + 1 for who took the pitch. With the
 *    simplified realism (partida.md, "Modo Realismo simplificado") the new suspensions, the new
 *    injuries and the yellow counters are not written: cards and injuries count in the match only;
 * 5. the round's morale (jogadores.md, "Moral por rodada"; T-014): the result for who took the
 *    pitch, the bench for who expected to play and did not (`benchStreak`), the drift towards the
 *    fans and the "Cobrar" for the hotheads, summed per player (`roundMoraleDeltas`) before the
 *    one clamp to 0..100; the form (`recentRatings`); then the fans thermometer of every club
 *    (fans.ts), with `fanDecisions` and the idol left on the bench (`idolBenchStreak`) for the
 *    human clubs only;
 * 6. the condition: the final energy of who played (the condition of the others), plus
 *    `fatigue.recoveryPerDay` × the days until the next round, up to 100. After round 38 there is
 *    no next round, so no recovery (the next season is T-017's). With the simplified realism
 *    everyone is back to 100 between the games;
 * 7. the facts (facts.ts).
 * Step 8, the save, is the application's.
 *
 * Pure and deterministic: the same state, params and input always give the same state and
 * report; nothing in the input is changed. Never throws on a game situation.
 */

/** How the coach follows his club's match (`CareerSave.career.matchMode`, ADR-0006). */
export type MatchMode = 'full' | 'highlights' | 'result';

/** The modes `RoundInput.coaches` accepts. */
export const MATCH_MODES: readonly MatchMode[] = ['full', 'highlights', 'result'];

/**
 * Input of {@link playRound} (docs/02-architecture.md, 4.1). `coaches` is new in T-013 (the
 * contract had no way to say which club is the coach's when he has no sheet, nor how he follows
 * the match): see {@link RoundInput.coaches}.
 */
export interface RoundInput {
  /** The round the caller expects to play (idempotence). */
  readonly round: number;
  /** The human clubs' sheets; the clubs without one are played by the AI. */
  readonly sheets: Readonly<Partial<Record<ClubId, TeamSheet>>>;
  /** The coach's commands by fixture (only in the career, P6), as he gave them live. */
  readonly commands: Readonly<Partial<Record<FixtureId, readonly MatchCommand[]>>>;
  /**
   * Sum of the coach's decisions about the fans in the round (torcida.md, "Decisões do técnico"),
   * by club, limited to ±fans.decisionCap; the idol left on the bench comes after the cap. Read
   * only for a human club of the round (in `sheets` or `coaches`); any other key, or a value that
   * is not a finite number, is ignored with a warning.
   */
  readonly fanDecisions: Readonly<Partial<Record<ClubId, number>>>;
  /**
   * The clubs with a human coach and how he follows the match (ia-clubes.md, "Clube do técnico
   * humano"). A club here or in `sheets` is human: without a sheet it gets the suggestion of
   * `suggestSheet` with the human option; it plays as `traditional`, with
   * `controller: 'ai'` in `result` ("só resultado": the AI plays rules 1 to 6 for him) and
   * `controller: 'human'` in `full` and `highlights` (only rule 1; the commands are his). A club
   * in `sheets` without a mode here plays as `full`.
   */
  readonly coaches?: Readonly<Partial<Record<ClubId, MatchMode>>>;
}

/**
 * What {@link prepareRound} reads: the same `sheets` and `coaches` as {@link RoundInput}, so the
 * screen can pass the very object it will give to `playRound` and the live match never diverges
 * from the recorded one. Both optional (no human club).
 */
export type RoundSetup = Partial<Pick<RoundInput, 'sheets' | 'coaches'>>;

/** What {@link prepareRound} returns (docs/02-architecture.md, 4.1). */
export interface RoundPlan {
  readonly round: number;
  /** The round's matches, in fixture order, exactly as `playRound` simulates them. */
  readonly matches: readonly MatchInput[];
  /**
   * The sheet the AI suggests for every club of the round: the one it will play for an AI club,
   * and the "Sugerir escalação" of a human club (with the human option, as `traditional`).
   */
  readonly suggested: Readonly<Record<ClubId, TeamSheet>>;
}

/** What a round produced (docs/02-architecture.md, 4.1). */
export interface RoundReport {
  readonly season: number;
  readonly round: number;
  /** The full results of the 10 matches, in fixture order. */
  readonly results: readonly MatchResult[];
  readonly facts: readonly Fact[];
}

/**
 * The season numbers of a player (`GameState.seasonStats`), summed match by match by `playRound`.
 * Only who took the pitch this season has an entry. The end of the season (T-017) reads them for
 * the awards and the evolution and then clears them (temporada.md, "Fim de temporada").
 */
export interface PlayerSeasonStats {
  /** Matches in which he took the pitch (also only in added time). */
  readonly games: number;
  /** Regulation minutes (partida.md, "Minutos jogados"). */
  readonly minutes: number;
  /** Real goals (an abandoned match keeps them). */
  readonly goals: number;
  readonly assists: number;
  readonly yellows: number;
  readonly reds: number;
  /** Sum of his match ratings, and how many matches had one (the mean is the awards'). */
  readonly ratingSum: number;
  readonly ratedGames: number;
  /**
   * Real goals conceded with him on the pitch in the goal or in a defence slot
   * (`MatchResult.conceded`). The best goalkeeper award reads it only for natural goalkeepers:
   * `conceded / games` (temporada.md, "Fim de temporada").
   */
  readonly conceded: number;
}

/**
 * Stadium capacity by size, when the club list has none (torcida.md, "Casos de borda";
 * clubes-serie-a.md): big 45,000, medium 30,000, small 15,000.
 */
export const DEFAULT_STADIUM_CAPACITY: { readonly [S in ClubSize]: number } = {
  big: 45_000,
  medium: 30_000,
  small: 15_000,
};

/**
 * The round's morale (jogadores.md, "Moral por rodada"; rule constants, not /balance knobs):
 * - who took the pitch (also only in added time): +3 / 0 / −3 for a win / draw / defeat of his
 *   club, × 2 in a derby (both sides);
 * - who expected to play and did not take the pitch, from the 2nd round in a row
 *   (`benchStreak` ≥ 2): −2 per round. "Expected to play" = `overall ≥ mean overall of the
 *   club's kick-off XI − 3`; an injured or suspended player does not expect to play;
 * - the "Cobrar" half-time talk: −3 for every hothead on the pitch at the half-time whistle;
 * - a hothead suffers the bench twice; a professional suffers only half of each negative
 *   component of result (the defeat) and of bench, one by one, never of the sum;
 * - the drift towards the fans, the same for everyone (ADR-0005), professional included:
 *   `clamp(thermometer − morale, −fans.moraleDrift, +fans.moraleDrift)` ({@link moraleDrift}).
 * Every line reads the morale and the thermometer of the start of the round (jogadores.md, "Como
 * o motor lê a tabela"), so the order of the lines does not change the result.
 */
export const ROUND_MORALE = {
  demandTalkHothead: -3,
  win: 3,
  draw: 0,
  loss: -3,
  derbyMult: 2,
  benched: -2,
  benchedFromStreak: 2,
  expectedMargin: 3,
  hotheadBenchMult: 2,
  professionalDropMult: 0.5,
} as const;

const EMPTY_STATS: PlayerSeasonStats = {
  games: 0,
  minutes: 0,
  goals: 0,
  assists: 0,
  yellows: 0,
  reds: 0,
  ratingSum: 0,
  ratedGames: 0,
  conceded: 0,
};

/** The season has no round left to play. */
function seasonOver(state: Pick<GameState, 'phase' | 'round'>): boolean {
  return state.phase !== 'season' || !(state.round >= 1 && state.round <= SEASON_ROUNDS);
}

/** `seedFromString(`${seed}-s${season}-r${round}-${homeId}-${awayId}`)` (architecture, 4.1). */
export function matchSeed(
  state: Pick<GameState, 'seed' | 'season' | 'round'>,
  homeId: ClubId,
  awayId: ClubId,
): number {
  return seedFromString(`${state.seed}-s${state.season}-r${state.round}-${homeId}-${awayId}`);
}

/** The human clubs of the round and their mode; unknown clubs and modes are warned. */
function humanModes(
  state: Pick<GameState, 'clubs'>,
  sheets: RoundInput['sheets'],
  coaches: NonNullable<RoundInput['coaches']>,
  warnings: EngineWarning[],
): Map<ClubId, MatchMode> {
  const humans = new Map<ClubId, MatchMode>();
  const add = (clubId: ClubId) => {
    if (humans.has(clubId)) return;
    if (!Object.hasOwn(state.clubs, clubId) || state.clubs[clubId] === undefined) {
      warnings.push({ code: 'round-unknown-club', detail: { clubId } });
      return;
    }
    const mode = Object.hasOwn(coaches, clubId) ? coaches[clubId] : undefined;
    if (mode !== undefined && !MATCH_MODES.includes(mode)) {
      warnings.push({ code: 'round-unknown-mode', detail: { clubId, mode: String(mode) } });
    }
    humans.set(clubId, mode !== undefined && MATCH_MODES.includes(mode) ? mode : 'full');
  };
  // Own keys only: the input comes from outside (the screen, the server), never the prototype.
  for (const clubId of Object.keys(sheets)) if (sheets[clubId] !== undefined) add(clubId);
  for (const clubId of Object.keys(coaches)) if (coaches[clubId] !== undefined) add(clubId);
  return humans;
}

/** Capacity of the home stadium: the club list's, else the default of its size. */
function stadiumCapacity(state: Pick<GameState, 'clubs'>, clubId: ClubId): number | undefined {
  const club = state.clubs[clubId];
  if (club === undefined) return undefined;
  const capacity = club.def.stadium?.capacity;
  if (typeof capacity === 'number' && Number.isFinite(capacity) && capacity > 0) return capacity;
  return DEFAULT_STADIUM_CAPACITY[club.def.size] ?? DEFAULT_STADIUM_CAPACITY.medium;
}

/**
 * The matches of the current round (docs/02-architecture.md, 4.1; flow "Rodada na carreira",
 * step 1): for each fixture of `state.round`, in fixture order, the two `TeamInput`s and the
 * seed, the derby and the home stadium. An AI club plays the sheet of `suggestSheet` (its
 * profile); a human club (`sheets` or `coaches`, see {@link RoundInput.coaches}) plays its sheet
 * or, without one, the suggestion with the human option, always as `traditional`. The sheets are
 * passed as they are: the match fixes and warns about an unavailable starter (partida.md, "Casos
 * de borda"); the screen validates them first with `validateLineup`.
 *
 * `season-over` once round 38 is played (or the phase is not `season`). Warnings:
 * `round-unknown-club` (a sheet or a mode for a club not in the state; ignored) and
 * `round-unknown-mode` (a mode not in MATCH_MODES; the club plays as `full`).
 */
export function prepareRound(
  state: GameState,
  params: GameParams,
  input: RoundSetup = {},
): Result<RoundPlan, 'season-over'> {
  if (seasonOver(state)) return fail('season-over', { season: state.season, round: state.round });
  const sheets = input.sheets ?? {};
  const coaches = input.coaches ?? {};
  const warnings: EngineWarning[] = [];
  const humans = humanModes(state, sheets, coaches, warnings);
  const suggested: Record<ClubId, TeamSheet> = {};
  const matches: MatchInput[] = [];

  const team = (clubId: ClubId, opponentId: ClubId): TeamInput => {
    const club = state.clubs[clubId];
    const mode = humans.get(clubId);
    const suggestion = suggestSheet(state, params, clubId, opponentId, {
      controller: mode === undefined ? 'ai' : 'human',
    });
    suggested[clubId] = suggestion;
    const players: Player[] = [];
    for (const id of state.squads[clubId] ?? []) {
      const player = state.players[id];
      if (player !== undefined) players.push(player);
    }
    const own = mode !== undefined && Object.hasOwn(sheets, clubId) ? sheets[clubId] : undefined;
    return {
      clubId,
      sheet: own ?? suggestion,
      controller: mode === undefined || mode === 'result' ? 'ai' : 'human',
      profile: mode === undefined ? (club?.profile ?? 'traditional') : 'traditional',
      fans: club?.fans ?? params.fans.start,
      players,
    };
  };

  for (const fixture of state.fixtures) {
    if (fixture.round !== state.round) continue;
    const { homeId, awayId } = fixture;
    const capacity = stadiumCapacity(state, homeId);
    matches.push({
      fixtureId: fixture.id,
      seed: matchSeed(state, homeId, awayId),
      home: team(homeId, awayId),
      away: team(awayId, homeId),
      derby: (state.clubs[homeId]?.def.rivals ?? []).includes(awayId),
      neutral: false,
      rules: state.rules,
      ...(capacity === undefined ? {} : { capacity }),
    });
  }
  return ok({ round: state.round, matches, suggested }, warnings);
}

/** The lean result kept in the fixture (`Fixture.result`). */
export function summarizeMatch(result: MatchResult): MatchSummary {
  const goals: MatchGoal[] = [];
  for (const e of result.events) {
    if (e.type !== 'goal') continue;
    goals.push({
      side: e.side,
      scorer: e.scorer,
      ...(e.assist === undefined ? {} : { assist: e.assist }),
      kind: e.kind,
      minute: e.minute,
      ...(e.added === undefined ? {} : { added: e.added }),
    });
  }
  const fulltime = result.events.find((e) => e.type === 'fulltime');
  return {
    score: [result.score[0], result.score[1]],
    abandoned: fulltime?.type === 'fulltime' ? fulltime.abandoned : false,
    goals,
    stats: { home: { ...result.stats.home }, away: { ...result.stats.away } },
    ...(result.motm === undefined ? {} : { motm: result.motm }),
    attendance: result.attendance,
  };
}

/**
 * Who was on the pitch at the half-time whistle, by side: the XI of the kick-off (everyone who
 * took the pitch except who came on as a substitute), then the substitutions, red cards and
 * injuries before the `halftime` event. Empty when the match never reached half time.
 */
function onPitchAtHalftime(match: MatchInput, result: MatchResult): Record<Side, Set<PlayerId>> {
  const sideOf = new Map<PlayerId, Side>();
  for (const p of match.home.players) sideOf.set(p.id, 'home');
  for (const p of match.away.players) if (!sideOf.has(p.id)) sideOf.set(p.id, 'away');
  const cameOn = new Set<PlayerId>();
  for (const e of result.events) if (e.type === 'substitution') cameOn.add(e.in);
  const pitch: Record<Side, Set<PlayerId>> = { home: new Set(), away: new Set() };
  for (const id of Object.keys(result.minutes)) {
    const side = sideOf.get(id);
    if (side !== undefined && !cameOn.has(id)) pitch[side].add(id);
  }
  for (const e of result.events) {
    if (e.type === 'halftime') return pitch;
    if (e.type === 'substitution') {
      pitch[e.side].delete(e.out);
      pitch[e.side].add(e.in);
    } else if (e.type === 'red' || e.type === 'injury') {
      pitch[e.side].delete(e.player);
    }
  }
  return { home: new Set(), away: new Set() };
}

/** One club's match of the round, as the morale and the fans read it. */
interface ClubMatch {
  readonly clubId: ClubId;
  readonly opponentId: ClubId;
  readonly side: Side;
  readonly derby: boolean;
  /** Neutral ground (only the /balance's duels): no venue in the fans' expected points. */
  readonly neutral: boolean;
  /** The club's goals and the opponent's: the awarded score of an abandoned match. */
  readonly scored: number;
  readonly conceded: number;
  /** Who took the pitch for the club, also only in added time (partida.md, "Minutos jogados"). */
  readonly pitch: ReadonlySet<PlayerId>;
  /** Mean overall of the club's kick-off XI; undefined when nobody started. */
  readonly xiMean: number | undefined;
}

/** The round's matches by club: `matches[i]` was played as `results[i]`. */
function clubMatches(
  players: Readonly<Record<PlayerId, Player>>,
  matches: readonly MatchInput[],
  results: readonly MatchResult[],
): Map<ClubId, ClubMatch> {
  const out = new Map<ClubId, ClubMatch>();
  results.forEach((result, i) => {
    const match = matches[i];
    if (match === undefined) return;
    for (const [side, team, other, own] of [
      ['home', match.home, match.away, 0],
      ['away', match.away, match.home, 1],
    ] as const) {
      const squad = new Set(team.players.map((p) => p.id));
      const cameOn = new Set<PlayerId>();
      for (const e of result.events)
        if (e.type === 'substitution' && e.side === side) cameOn.add(e.in);
      const pitch = new Set(Object.keys(result.minutes).filter((id) => squad.has(id)));
      let sum = 0;
      let starters = 0;
      for (const id of pitch) {
        const overall = players[id]?.overall;
        if (cameOn.has(id) || overall === undefined) continue;
        sum += overall;
        starters++;
      }
      out.set(team.clubId, {
        clubId: team.clubId,
        opponentId: other.clubId,
        side,
        derby: match.derby,
        neutral: match.neutral,
        scored: result.score[own],
        conceded: result.score[1 - own]!,
        pitch,
        xiMean: starters > 0 ? sum / starters : undefined,
      });
    }
  });
  return out;
}

/** A count read from the state: a non-negative integer, else 0 (a damaged value starts over). */
const count = (value: number) => (Number.isInteger(value) && value > 0 ? value : 0);

/**
 * The `benchStreak` of every player of a club that played the round (jogadores.md, "Moral por
 * rodada"): rounds in a row in which he expected to play and did not take the pitch. Back to 0
 * when he took the pitch, when he did not expect to play (`overall` below the mean overall of the
 * club's kick-off XI − 3) and when he was injured or suspended (an unavailable player does not
 * expect to play, and the one back from injury starts over: "voltou de lesão: sem mudança").
 */
export function roundBenchStreaks(
  state: Pick<GameState, 'players' | 'squads'>,
  matches: readonly MatchInput[],
  results: readonly MatchResult[],
): Map<PlayerId, number> {
  return benchStreaksOf(state, clubMatches(state.players, matches, results));
}

/** {@link roundBenchStreaks} on the round's matches by club, computed once by the caller. */
function benchStreaksOf(
  state: Pick<GameState, 'players' | 'squads'>,
  clubs: ReadonlyMap<ClubId, ClubMatch>,
): Map<PlayerId, number> {
  const streaks = new Map<PlayerId, number>();
  for (const club of clubs.values()) {
    for (const id of state.squads[club.clubId] ?? []) {
      const p = state.players[id];
      if (p === undefined) continue;
      const expected =
        club.xiMean !== undefined && p.overall >= club.xiMean - ROUND_MORALE.expectedMargin;
      const benched = !club.pitch.has(id) && !isUnavailable(p) && expected;
      streaks.set(id, benched ? count(p.benchStreak) + 1 : 0);
    }
  }
  return streaks;
}

/**
 * The morale deltas of the round, by player, summed before the one clamp to 0..100 (step 5;
 * jogadores.md, "Moral por rodada"; see {@link ROUND_MORALE}): the result for who took the pitch,
 * the bench from the 2nd round in a row ({@link roundBenchStreaks}), the "Cobrar" for the
 * hotheads who heard it, and the drift ({@link moraleDrift}) towards the club's thermometer for
 * every player of the squad, with the morale and the thermometer of the start of the round. The
 * professional's half applies to the result and the bench only. Only the players with a
 * non-zero sum are in the map.
 */
export function roundMoraleDeltas(
  state: Pick<GameState, 'players' | 'squads' | 'clubs'>,
  params: Pick<GameParams, 'fans'>,
  matches: readonly MatchInput[],
  results: readonly MatchResult[],
): Map<PlayerId, number> {
  const clubs = clubMatches(state.players, matches, results);
  return moraleDeltasOf(state, params, clubs, benchStreaksOf(state, clubs), matches, results);
}

/**
 * {@link roundMoraleDeltas} with the round's matches by club and the new bench streaks, computed
 * once by the caller.
 */
function moraleDeltasOf(
  state: Pick<GameState, 'players' | 'squads' | 'clubs'>,
  params: Pick<GameParams, 'fans'>,
  clubs: ReadonlyMap<ClubId, ClubMatch>,
  streaks: ReadonlyMap<PlayerId, number>,
  matches: readonly MatchInput[],
  results: readonly MatchResult[],
): Map<PlayerId, number> {
  const { players } = state;
  const deltas = new Map<PlayerId, number>();
  const add = (p: Player, delta: number) => {
    if (delta !== 0) deltas.set(p.id, (deltas.get(p.id) ?? 0) + delta);
  };
  /** A drop of result or bench: half for a professional (jogadores.md). */
  const drop = (p: Player, delta: number) =>
    add(
      p,
      delta < 0 && p.trait === 'professional' ? delta * ROUND_MORALE.professionalDropMult : delta,
    );
  const drift = params.fans.moraleDrift;

  for (const club of clubs.values()) {
    const outcome =
      club.scored > club.conceded
        ? ROUND_MORALE.win
        : club.scored === club.conceded
          ? ROUND_MORALE.draw
          : ROUND_MORALE.loss;
    const byResult = outcome * (club.derby ? ROUND_MORALE.derbyMult : 1);
    const fans = state.clubs[club.clubId]?.fans;
    for (const id of state.squads[club.clubId] ?? []) {
      const p = players[id];
      if (p === undefined) continue;
      if (club.pitch.has(id)) drop(p, byResult);
      if ((streaks.get(id) ?? 0) >= ROUND_MORALE.benchedFromStreak) {
        drop(p, ROUND_MORALE.benched * (p.trait === 'hothead' ? ROUND_MORALE.hotheadBenchMult : 1));
      }
      if (fans !== undefined) add(p, moraleDrift(fans, p.morale, drift));
    }
  }

  results.forEach((result, i) => {
    const demanded = result.events.filter((e) => e.type === 'halftimeTalk' && e.talk === 'demand');
    if (demanded.length === 0 || matches[i] === undefined) return;
    const pitch = onPitchAtHalftime(matches[i], result);
    for (const e of demanded) {
      if (e.type !== 'halftimeTalk') continue;
      for (const id of pitch[e.side]) {
        const p = players[id];
        if (p?.trait === 'hothead') add(p, ROUND_MORALE.demandTalkHothead);
      }
    }
  });
  return deltas;
}

/**
 * The form after a match (jogadores.md, "Estados que mudam"; display only): the last
 * {@link RECENT_RATINGS_MAX} match ratings, oldest first. A match without a rating ("sem nota",
 * under 15 minutes) leaves it as it was.
 */
export function nextRecentRatings(
  previous: readonly number[],
  rating: number | null | undefined,
): readonly number[] {
  if (typeof rating !== 'number' || !Number.isFinite(rating)) return previous;
  return [...previous, rating].slice(-RECENT_RATINGS_MAX);
}

/**
 * The morale drift towards the thermometer (jogadores.md, "Como o motor lê a tabela"; torcida.md,
 * "Efeitos"): `clamp(fans − morale, −drift, +drift)` with both values of the start of the round,
 * so it never goes past the thermometer (79.5 with the fans at 80 goes to 80.0). The same for
 * every trait (ADR-0005). 0 when either value is not a finite number.
 */
export function moraleDrift(fans: number, morale: number, drift: number): number {
  if (!Number.isFinite(fans) || !Number.isFinite(morale)) return 0;
  return clamp(fans - morale, -drift, drift);
}

/**
 * The fans thermometer of every club that played the round (step 5, after the morale; fans.ts,
 * torcida.md "Fórmula"). Only a human club of the round (`humans`) has decisions: the coach's
 * (`decisions`, capped in fansDelta) and the idol left on the bench, `idolBenchStreak` = rounds in
 * a row in which the idol did not take the pitch while able to (not injured nor suspended), −1
 * from the 2nd (IDOL_BENCH) after the cap. An AI club's streak stays at 0. `state` has the round's
 * results; `before` is the state the round started from (who was injured or suspended); `table`
 * is the table after the round (the one the facts read too); `matches` are the round's matches by
 * club.
 */
function roundFans(
  state: GameState,
  before: Readonly<Record<PlayerId, Player>>,
  params: GameParams,
  matches: ReadonlyMap<ClubId, ClubMatch>,
  table: readonly StandingRow[],
  humans: ReadonlySet<ClubId>,
  decisions: ReadonlyMap<ClubId, number>,
): Record<ClubId, ClubState> {
  const clubs: Record<ClubId, ClubState> = { ...state.clubs };
  const position = new Map(table.map((row) => [row.clubId, row.position]));
  const winless = winlessRuns(state.fixtures, state.round);
  for (const match of matches.values()) {
    const club = state.clubs[match.clubId];
    if (club === undefined) continue;
    const human = humans.has(match.clubId);
    const idol = human ? clubIdol(state.squads[match.clubId] ?? [], before) : undefined;
    const benched = idol !== undefined && !match.pitch.has(idol.id) && !isUnavailable(idol);
    const idolBenchStreak = benched ? count(club.idolBenchStreak) + 1 : 0;
    const idolPenalty = idolBenchStreak >= IDOL_BENCH.fromStreak ? IDOL_BENCH.fans : 0;
    const opponent = state.clubs[match.opponentId];
    const moved = fansDelta(
      {
        fans: club.fans,
        scored: match.scored,
        conceded: match.conceded,
        expected: expectedPoints(
          club.strength,
          opponent?.strength ?? club.strength,
          fansVenue(match, match.side),
        ),
        derby: match.derby,
        winlessRun: winless.get(match.clubId) ?? 0,
        position: position.get(match.clubId),
        clubs: table.length,
        round: state.round,
        decisions: human ? (decisions.get(match.clubId) ?? 0) : 0,
        idol: idolPenalty,
      },
      params.fans,
    );
    clubs[match.clubId] = { ...club, fans: moved.fans, idolBenchStreak };
  }
  return clubs;
}

/** Days from this round to the next one (0 after the last round or with a broken date). */
function recoveryDays(fixtures: readonly Fixture[], round: number): number {
  const today = fixtures.find((f) => f.round === round)?.date;
  const next = fixtures.find((f) => f.round === round + 1)?.date;
  if (today === undefined || next === undefined) return 0;
  const days = daysBetween(today, next);
  return days === undefined || days < 0 ? 0 : days;
}

/** Adds the round's matches to the season stats of each player who took the pitch. */
function addSeasonStats(
  stats: Readonly<Record<PlayerId, PlayerSeasonStats>>,
  results: readonly MatchResult[],
): Record<PlayerId, PlayerSeasonStats> {
  const out: Record<PlayerId, PlayerSeasonStats> = { ...stats };
  for (const result of results) {
    const count = new Map<string, number>();
    const bump = (key: string) => count.set(key, (count.get(key) ?? 0) + 1);
    for (const e of result.events) {
      if (e.type === 'goal') {
        bump(`g${e.scorer}`);
        if (e.assist !== undefined) bump(`a${e.assist}`);
      } else if (e.type === 'yellow') bump(`y${e.player}`);
      else if (e.type === 'red') bump(`r${e.player}`);
    }
    for (const [id, minutes] of Object.entries(result.minutes)) {
      const prev = out[id] ?? EMPTY_STATS;
      const rating = result.ratings[id];
      out[id] = {
        games: prev.games + 1,
        minutes: prev.minutes + minutes,
        goals: prev.goals + (count.get(`g${id}`) ?? 0),
        assists: prev.assists + (count.get(`a${id}`) ?? 0),
        yellows: prev.yellows + (count.get(`y${id}`) ?? 0),
        reds: prev.reds + (count.get(`r${id}`) ?? 0),
        ratingSum: prev.ratingSum + (typeof rating === 'number' ? rating : 0),
        ratedGames: prev.ratedGames + (typeof rating === 'number' ? 1 : 0),
        conceded: prev.conceded + (result.conceded[id] ?? 0),
      };
    }
  }
  return out;
}

/** Steps 3 to 7 of the round, on a copy of the state. */
function applyRound(
  state: GameState,
  params: GameParams,
  plan: RoundPlan,
  results: readonly MatchResult[],
  humans: ReadonlySet<ClubId>,
  decisions: ReadonlyMap<ClubId, number>,
): { state: GameState; report: RoundReport } {
  const round = state.round;
  const simplified = state.rules.realism === 'simplified';
  const byFixture = new Map<FixtureId, MatchResult>();
  for (const result of results) byFixture.set(result.fixtureId, result);

  // 3. Results and season stats.
  const fixtures = state.fixtures.map((f) => {
    const result = f.round === round ? byFixture.get(f.id) : undefined;
    return result === undefined ? f : { ...f, result: summarizeMatch(result) };
  });
  const seasonStats = addSeasonStats(state.seasonStats, results);

  // 4 to 6. Players.
  const energy = new Map<PlayerId, number>();
  const yellows = new Map<PlayerId, number>();
  const injuries = new Map<PlayerId, number>();
  const suspensions = new Map<PlayerId, number>();
  const ratings = new Map<PlayerId, number | null>();
  const tookPitch = new Set<PlayerId>();
  for (const result of results) {
    for (const [id, value] of Object.entries(result.finalEnergy)) energy.set(id, value);
    for (const id of Object.keys(result.minutes)) tookPitch.add(id);
    for (const [id, value] of Object.entries(result.ratings)) ratings.set(id, value);
    // Simplified realism (partida.md, "Modo Realismo simplificado"): the injured leaves the match
    // and is available next round, and the cards neither suspend nor count (`yellowCount` stays
    // as it is, 0 in a simplified career, so no yellow ever triggers a suspension). The cards
    // still count in the season stats and in the table's tie-break.
    if (simplified) continue;
    for (const [id, value] of Object.entries(result.yellowCounts)) yellows.set(id, value);
    for (const { player, rounds } of result.newInjuries) {
      injuries.set(player, Math.max(injuries.get(player) ?? 0, rounds));
    }
    for (const { player, games } of result.newSuspensions) {
      suspensions.set(player, (suspensions.get(player) ?? 0) + games);
    }
  }
  const clubsPlayed = new Set<ClubId>();
  for (const match of plan.matches) {
    clubsPlayed.add(match.home.clubId);
    clubsPlayed.add(match.away.clubId);
  }
  // Computed once and passed on: the matches by club, the bench streaks, the tables.
  const byClub = clubMatches(state.players, plan.matches, results);
  const benchStreaks = benchStreaksOf(state, byClub);
  const morale = moraleDeltasOf(state, params, byClub, benchStreaks, plan.matches, results);
  const recovery = params.match.fatigue.recoveryPerDay * recoveryDays(state.fixtures, round);

  const players: Record<PlayerId, Player> = {};
  for (const [id, p] of Object.entries(state.players)) {
    let injuryRounds = Math.max(0, p.injuryRounds - 1);
    const injured = injuries.get(id);
    if (injured !== undefined) injuryRounds = Math.max(injuryRounds, injured);
    const served = clubsPlayed.has(p.clubId) ? 1 : 0;
    const suspendedGames = Math.max(0, p.suspendedGames - served) + (suspensions.get(id) ?? 0);
    const delta = morale.get(id);
    players[id] = {
      ...p,
      condition: simplified ? 100 : clamp((energy.get(id) ?? p.condition) + recovery, 0, 100),
      morale: delta === undefined ? p.morale : clamp(p.morale + delta, 0, 100),
      injuryRounds,
      suspendedGames,
      yellowCount: yellows.get(id) ?? p.yellowCount,
      recentRatings: nextRecentRatings(p.recentRatings, ratings.get(id)),
      benchStreak: benchStreaks.get(id) ?? p.benchStreak,
      clubAppearances: p.clubAppearances + (tookPitch.has(id) ? 1 : 0),
    };
  }

  // 5, after the morale: the fans of every club, on the table with this round. The tables do
  // not depend on the players nor on the fans, so the facts read the same ones.
  const tables = roundTables({ ...state, fixtures }, round);
  const clubs = roundFans(
    { ...state, fixtures },
    state.players,
    params,
    byClub,
    tables.now,
    humans,
    decisions,
  );

  const lastSheets: Record<ClubId, TeamSheet> = { ...state.lastSheets };
  for (const match of plan.matches) {
    lastSheets[match.home.clubId] = match.home.sheet;
    lastSheets[match.away.clubId] = match.away.sheet;
  }

  // 7. Facts, on the applied state.
  const applied: GameState = {
    ...state,
    engineVersion: ENGINE_VERSION,
    round: round + 1,
    clubs,
    fixtures,
    players,
    lastSheets,
    seasonStats,
  };
  const report: RoundReport = {
    season: state.season,
    round,
    results,
    facts: roundFacts(applied, round, results, tables),
  };
  return { state: applied, report };
}

/**
 * The coach's decisions of the round by club (`RoundInput.fanDecisions`; torcida.md, "Quem pode
 * decidir"), own keys only, and only for a human club of the round (`humans`). Ignored with a
 * warning: a club not in the state (`round-unknown-club`), a club that is not human this round
 * (`round-fan-decision-not-human`) and a value that is not a finite number
 * (`round-invalid-fan-decision`). The cap is fansDelta's.
 */
function fanDecisionsOf(
  state: Pick<GameState, 'clubs'>,
  input: RoundInput['fanDecisions'] | undefined,
  humans: ReadonlySet<ClubId>,
  warnings: EngineWarning[],
): Map<ClubId, number> {
  const out = new Map<ClubId, number>();
  for (const clubId of Object.keys(input ?? {})) {
    const value: unknown = input![clubId];
    if (value === undefined) continue;
    if (!Object.hasOwn(state.clubs, clubId) || state.clubs[clubId] === undefined) {
      warnings.push({ code: 'round-unknown-club', detail: { clubId } });
    } else if (!humans.has(clubId)) {
      warnings.push({ code: 'round-fan-decision-not-human', detail: { clubId } });
    } else if (typeof value !== 'number' || !Number.isFinite(value)) {
      warnings.push({
        code: 'round-invalid-fan-decision',
        detail: { clubId, value: String(value) },
      });
    } else {
      out.set(clubId, value);
    }
  }
  return out;
}

/**
 * Plays the current round (docs/02-architecture.md, 4.1; US-012): {@link prepareRound} with the
 * same input (its sheets and coaches), the 10 matches with `simulateMatch` and the commands of each
 * fixture (the same plan and commands the live screen replayed, so the score is the one the
 * coach saw), then steps 3 to 7 of temporada.md (see the header). Returns the new state (round
 * + 1) and the report, which is not kept in the state (T-049): the application keeps its lean
 * form (`roundRecap`, `matchSheet`; recap.ts).
 *
 * Idempotent: `round-already-played` when `input.round` is a round already played (nothing
 * changes), `season-over` after round 38, `round-not-open` for a round after the current one.
 * Warnings: those of prepareRound, `round-unknown-fixture` for commands of a fixture that is not
 * in the round (ignored), and for `fanDecisions` `round-unknown-club` (a club not in the state),
 * `round-fan-decision-not-human` (a club that is not human this round) and
 * `round-invalid-fan-decision` (not a finite number), all ignored. The matches' own warnings
 * stay in each result.
 */
export function playRound(
  state: GameState,
  params: GameParams,
  input: RoundInput,
): Result<
  { state: GameState; report: RoundReport },
  'round-already-played' | 'round-not-open' | 'season-over'
> {
  if (input.round < state.round) {
    return fail('round-already-played', { round: input.round, next: state.round });
  }
  if (seasonOver(state)) return fail('season-over', { season: state.season, round: state.round });
  if (input.round !== state.round) {
    return fail('round-not-open', { round: input.round, next: state.round });
  }
  const plan = prepareRound(state, params, input);
  if (!plan.ok) return plan;
  const warnings = [...plan.warnings];
  const commands = input.commands ?? {};
  const inRound = new Set(plan.value.matches.map((m) => m.fixtureId));
  for (const fixtureId of Object.keys(commands)) {
    if (!inRound.has(fixtureId)) {
      warnings.push({ code: 'round-unknown-fixture', detail: { fixtureId } });
    }
  }
  // The human clubs, as prepareRound read them (its warnings are already in `warnings`).
  const humans = new Set(humanModes(state, input.sheets ?? {}, input.coaches ?? {}, []).keys());
  const decisions = fanDecisionsOf(state, input.fanDecisions, humans, warnings);
  const results = plan.value.matches.map((match) =>
    simulateMatch(match, params, commands[match.fixtureId]),
  );
  return ok(applyRound(state, params, plan.value, results, humans, decisions), warnings);
}
