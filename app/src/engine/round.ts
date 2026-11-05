import { suggestSheet } from './ai.ts';
import { roundFacts, type Fact } from './facts.ts';
import { daysBetween, type Fixture } from './fixtures.ts';
import type { GameState } from './game.ts';
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
import type { Player } from './players.ts';
import { fail, ok } from './result.ts';
import { seedFromString } from './rng.ts';
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
 *    (only who took the pitch is in it); `clubAppearances` + 1 for who took the pitch;
 * 5. the round's morale: today only the −3 of "Cobrar" for the hotheads on the pitch at the
 *    half-time whistle (partida.md, "Cobrar e a moral"). The rest of the table of jogadores.md
 *    ("Moral por rodada") and the fans thermometer are T-014, which adds its deltas to the same
 *    per-player sum (`roundMoraleDeltas`) before the one clamp to 0..100;
 * 6. the condition: the final energy of who played (the condition of the others), plus
 *    `fatigue.recoveryPerDay` × the days until the next round, up to 100. After round 38 there is
 *    no next round, so no recovery (the next season is T-017's);
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
  /** Sum of the coach's decisions about the fans (fans.decisionCap); applied by T-014. */
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
 * The season numbers of a player (`GameState.seasonStats`), for the scorers and the awards of the
 * season (temporada.md, "Fim de temporada"; T-017). Only who took the pitch has an entry.
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
 * The deltas of the round's morale that belong to T-013 (jogadores.md, "Moral por rodada"): the
 * "Cobrar" half-time talk takes 3 from every hothead on the pitch at the half-time whistle. A
 * rule constant; the other rows of that table come with T-014.
 */
export const ROUND_MORALE = { demandTalkHothead: -3 } as const;

const EMPTY_STATS: PlayerSeasonStats = {
  games: 0,
  minutes: 0,
  goals: 0,
  assists: 0,
  yellows: 0,
  reds: 0,
  ratingSum: 0,
  ratedGames: 0,
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
    if (state.clubs[clubId] === undefined) {
      warnings.push({ code: 'round-unknown-club', detail: { clubId } });
      return;
    }
    const mode = coaches[clubId];
    if (mode !== undefined && !MATCH_MODES.includes(mode)) {
      warnings.push({ code: 'round-unknown-mode', detail: { clubId, mode: String(mode) } });
    }
    humans.set(clubId, mode !== undefined && MATCH_MODES.includes(mode) ? mode : 'full');
  };
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
  sheets: RoundInput['sheets'] = {},
  coaches: NonNullable<RoundInput['coaches']> = {},
): Result<RoundPlan, 'season-over'> {
  if (seasonOver(state)) return fail('season-over', { season: state.season, round: state.round });
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
    return {
      clubId,
      sheet: (mode === undefined ? undefined : sheets[clubId]) ?? suggestion,
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

/**
 * The morale deltas of the round, by player, summed before the one clamp to 0..100 (step 5). In
 * T-013 only "Cobrar" (ROUND_MORALE.demandTalkHothead for the hotheads who heard it; a professional
 * is never a hothead, so the half rule of jogadores.md does not apply to it); T-014 adds the rest.
 */
export function roundMoraleDeltas(
  players: Readonly<Record<PlayerId, Player>>,
  matches: readonly MatchInput[],
  results: readonly MatchResult[],
): Map<PlayerId, number> {
  const deltas = new Map<PlayerId, number>();
  const add = (id: PlayerId, delta: number) => deltas.set(id, (deltas.get(id) ?? 0) + delta);
  results.forEach((result, i) => {
    const demanded = result.events.filter((e) => e.type === 'halftimeTalk' && e.talk === 'demand');
    if (demanded.length === 0) return;
    const pitch = onPitchAtHalftime(matches[i]!, result);
    for (const e of demanded) {
      if (e.type !== 'halftimeTalk') continue;
      for (const id of pitch[e.side]) {
        if (players[id]?.trait === 'hothead') add(id, ROUND_MORALE.demandTalkHothead);
      }
    }
  });
  return deltas;
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
): { state: GameState; report: RoundReport } {
  const round = state.round;
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
  const tookPitch = new Set<PlayerId>();
  for (const result of results) {
    for (const [id, value] of Object.entries(result.finalEnergy)) energy.set(id, value);
    for (const id of Object.keys(result.minutes)) tookPitch.add(id);
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
  const morale = roundMoraleDeltas(state.players, plan.matches, results);
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
      condition: clamp((energy.get(id) ?? p.condition) + recovery, 0, 100),
      morale: delta === undefined ? p.morale : clamp(p.morale + delta, 0, 100),
      injuryRounds,
      suspendedGames,
      yellowCount: yellows.get(id) ?? p.yellowCount,
      clubAppearances: p.clubAppearances + (tookPitch.has(id) ? 1 : 0),
    };
  }

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
    fixtures,
    players,
    lastSheets,
    seasonStats,
  };
  const report: RoundReport = {
    season: state.season,
    round,
    results,
    facts: roundFacts(applied, round, results),
  };
  return { state: { ...applied, lastRound: report }, report };
}

/**
 * Plays the current round (docs/02-architecture.md, 4.1; US-012): {@link prepareRound} with the
 * input's sheets and coaches, the 10 matches with `simulateMatch` and the commands of each
 * fixture (the same plan and commands the live screen replayed, so the score is the one the
 * coach saw), then steps 3 to 7 of temporada.md (see the header). Returns the new state (round
 * + 1, `lastRound` = the report) and the report.
 *
 * Idempotent: `round-already-played` when `input.round` is a round already played (nothing
 * changes), `season-over` after round 38, `round-not-open` for a round after the current one.
 * Warnings: those of prepareRound, and `round-unknown-fixture` for commands of a fixture that is
 * not in the round (ignored). The matches' own warnings stay in each result.
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
  const plan = prepareRound(state, params, input.sheets ?? {}, input.coaches ?? {});
  if (!plan.ok) return plan;
  const warnings = [...plan.warnings];
  const commands = input.commands ?? {};
  const inRound = new Set(plan.value.matches.map((m) => m.fixtureId));
  for (const fixtureId of Object.keys(commands)) {
    if (!inRound.has(fixtureId)) {
      warnings.push({ code: 'round-unknown-fixture', detail: { fixtureId } });
    }
  }
  const results = plan.value.matches.map((match) =>
    simulateMatch(match, params, commands[match.fixtureId]),
  );
  return ok(applyRound(state, params, plan.value, results), warnings);
}
