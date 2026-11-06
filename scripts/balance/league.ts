import {
  SEASON_ROUNDS,
  endSeason,
  getStandings,
  newGame,
  playRound,
  seedFromString,
  startNextSeason,
} from '../../app/src/engine/index.ts';
import type {
  AiProfile,
  ClubDef,
  ClubId,
  ClubSize,
  GameParams,
  GameState,
  MatchResult,
  RoundInput,
  StandingRow,
} from '../../app/src/engine/index.ts';
import { balanceIdentitySource } from './identity.ts';
import { robotRoundInput } from './robot.ts';

/*
 * The league part of the /balance (balance-targets.md, "Como o /balance mede"): season `i` is a
 * new career of the 20 clubs with the seed `seedFromString(`balance-${seed}-${i}`)`, squads
 * generated from scratch, and the 38 rounds played in order through `playRound`, so condition,
 * injuries, suspensions, morale and the fans thermometer carry from one round to the next. Every
 * club is played by the AI, or one of them by the robot coach (robot.ts).
 *
 * A season is reduced to a small record of counts (`SeasonRecord`), the same in a worker thread
 * or in the main one; metrics.ts turns the records into the report. With `--chain N` (T-017) a
 * career plays N seasons in a row, turned by the engine (`runCareer`).
 */

/** Year of the careers (the calendar of season 1). */
export const BALANCE_YEAR = 2026;
/** The round after which the "fuga do Z4" looks at the table (balance-targets.md, decision 9). */
export const Z4_ROUND = 30;
/** Positions of the relegation zone and of the G4. */
export const Z4_FROM = 17;
export const G4_TO = 4;
/**
 * Clubs of the "clube fraco" cut: the weakest of the career's ladder (decision 9). In a `--chain`
 * run, those of season 1 for the whole career (balance-targets.md, "Recorte de cada métrica na
 * cadeia"; decision 15).
 */
export const WEAK_CLUBS = 4;
/**
 * Clubs of the "6 mais fortes" cut: the strongest of the career's ladder, the second reading of
 * "campeão grande" and "grande rebaixado" (clubes-serie-a.md, "Pedido ao developer", item 4).
 */
export const STRONG_CLUBS = 6;
/**
 * Clubs of each end of the ladder in the drift lock of a `--chain` run (decision 15): the 4
 * strongest against the 4 weakest of season 1.
 */
export const DRIFT_LADDER_CLUBS = 4;
/** "6 a 8 pontos atrás do 16º" (decision 9). */
export const Z4_GAP = { min: 6, max: 8 } as const;
/** A starter below this condition marks a tired sheet (ia-clubes.md, "Pedido ao developer" 3). */
export const TIRED_STARTER_CONDITION = 75;
/**
 * The revelation's pool in a `--chain` run (temporada.md, "Prêmios"; decision 14 of
 * balance-targets.md): players of at most this age in the season played...
 */
export const REVELATION_MAX_AGE = 21;
/** ...with at least half of the rounds rated (the awards' minimum, 19 games). */
export const AWARD_MIN_GAMES = SEASON_ROUNDS / 2;

/** Sums over the matches of a season (or of many). */
export interface MatchTally {
  matches: number;
  goals: number;
  nilNil: number;
  draws: number;
  homeWins: number;
  /** Winning margin of 3 or more ("goleada") and of 5 or more. */
  margin3: number;
  margin5: number;
  /** `"home×away"` → matches. */
  scores: Record<string, number>;
  yellows: number;
  reds: number;
  secondYellows: number;
  injuries: number;
  injuryRounds: number;
  penalties: number;
  penaltyGoals: number;
  /** Substitutions of both sides. */
  subs: number;
}

/** The sheets the AI took to the pitch, by profile: posture and pressure counts. */
export interface SheetTally {
  sheets: number;
  highPressure: number;
  /** Sheets with at least one starter below {@link TIRED_STARTER_CONDITION} of condition. */
  tiredStarter: number;
  byProfile: Partial<Record<AiProfile, Record<string, number>>>;
}

/** Every club's thermometer after every round. */
export interface FansTally {
  n: number;
  sum: number;
  sumSq: number;
  below20: number;
  above90: number;
}

/** The table side of a season. */
export interface TableRecord {
  champion: ClubId;
  championPoints: number;
  championSize: ClubSize;
  seventeenthPoints: number;
  /** At least one big club finished in the relegation zone. */
  bigRelegated: boolean;
  /** At least one of the WEAK_CLUBS weakest clubs at the start finished in the G4. */
  weakInG4: boolean;
  /** The champion is one of the STRONG_CLUBS strongest clubs at the start. */
  strongChampion: boolean;
  /** At least one of the STRONG_CLUBS strongest clubs at the start finished in the Z4. */
  strongRelegated: boolean;
  /** Clubs in the Z4 after round Z4_ROUND, and how many of them finished out of it. */
  z4: number;
  z4Escaped: number;
  /** The same, only for those 6 to 8 points behind the 16th after round Z4_ROUND. */
  z4Gap: number;
  z4GapEscaped: number;
}

/**
 * The `strength` of the 20 clubs at the start of a season (balance-targets.md, "Virada de
 * temporada"): the mean, the standard deviation (population, over the 20) and the gap from the
 * 1st to the 20th; and the two gaps of the drift lock (decision 15): the mean of the big clubs
 * minus that of the others, and the mean of the DRIFT_LADDER_CLUBS strongest minus that of the
 * DRIFT_LADDER_CLUBS weakest, both of season 1.
 */
export interface StrengthRecord {
  mean: number;
  sd: number;
  range: number;
  sizeGap: number;
  ladderGap: number;
}

/**
 * The clubs a season of a career is cut by: the weakest and the strongest of the ladder (decision
 * 9 and clubes-serie-a.md, item 4) and the two ends of the drift lock (decision 15). In a
 * `--chain` run they are those of season 1, for the whole career.
 */
export interface LadderCut {
  weakest: readonly ClubId[];
  strongest: readonly ClubId[];
  driftWeakest: readonly ClubId[];
  driftStrongest: readonly ClubId[];
}

/**
 * The squads of a season of a `--chain` run (decision 14, the minimal renewal of T-048): the
 * mean age of the players of the 20 squads at the start, the revelation's pool at the end (players
 * of up to REVELATION_MAX_AGE with AWARD_MIN_GAMES rated games), and how many players retired in
 * the turn that closed it (absent for the last season of the chain, which is not turned).
 */
export interface SquadsRecord {
  ageMean: number;
  revelationCandidates: number;
  retired?: number;
}

export interface SeasonRecord {
  index: number;
  /** Season of the career (`--chain`); absent in a single-season run (season 1). */
  season?: number;
  /** The clubs' strength at the start of the season; only in a `--chain` run. */
  strength?: StrengthRecord;
  /** Ages, the revelation's pool and the retirements; only in a `--chain` run. */
  squads?: SquadsRecord;
  /** Club played by the robot coach in this season, if any. */
  robot?: ClubId;
  matches: MatchTally;
  sheets: SheetTally;
  fans: FansTally;
  table: TableRecord;
  /** Final points and position of every club. */
  points: Record<ClubId, number>;
  positions: Record<ClubId, number>;
}

export function emptyMatchTally(): MatchTally {
  return {
    matches: 0,
    goals: 0,
    nilNil: 0,
    draws: 0,
    homeWins: 0,
    margin3: 0,
    margin5: 0,
    scores: {},
    yellows: 0,
    reds: 0,
    secondYellows: 0,
    injuries: 0,
    injuryRounds: 0,
    penalties: 0,
    penaltyGoals: 0,
    subs: 0,
  };
}

/** Adds one match to the tally. */
export function addMatch(
  t: MatchTally,
  result: Pick<MatchResult, 'score' | 'stats' | 'events' | 'newInjuries'>,
): void {
  const [h, a] = result.score;
  t.matches += 1;
  t.goals += h + a;
  if (h === 0 && a === 0) t.nilNil += 1;
  if (h === a) t.draws += 1;
  if (h > a) t.homeWins += 1;
  if (Math.abs(h - a) >= 3) t.margin3 += 1;
  if (Math.abs(h - a) >= 5) t.margin5 += 1;
  const key = `${h}x${a}`;
  t.scores[key] = (t.scores[key] ?? 0) + 1;
  t.yellows += result.stats.home.yellows + result.stats.away.yellows;
  t.reds += result.stats.home.reds + result.stats.away.reds;
  t.injuries += result.newInjuries.length;
  for (const injury of result.newInjuries) t.injuryRounds += injury.rounds;
  for (const e of result.events) {
    if (e.type === 'red' && e.reason === 'secondYellow') t.secondYellows += 1;
    else if (e.type === 'penaltyAwarded') t.penalties += 1;
    else if (e.type === 'goal' && e.kind === 'penalty') t.penaltyGoals += 1;
    else if (e.type === 'substitution') t.subs += 1;
  }
}

/** Sums `b` into `a` (the merge of the seasons, in season order). */
export function mergeMatchTally(a: MatchTally, b: MatchTally): void {
  for (const key of Object.keys(b) as (keyof MatchTally)[]) {
    if (key === 'scores') {
      for (const [score, n] of Object.entries(b.scores))
        a.scores[score] = (a.scores[score] ?? 0) + n;
    } else {
      a[key] += b[key];
    }
  }
}

/** The fans tally of a list of thermometer readings. */
export function addFans(t: FansTally, value: number): void {
  t.n += 1;
  t.sum += value;
  t.sumSq += value * value;
  if (value < 20) t.below20 += 1;
  if (value > 90) t.above90 += 1;
}

/** The weakest clubs of the career's ladder at the start (effective strength; ties by id). */
export function weakestClubs(state: Pick<GameState, 'clubs'>, count = WEAK_CLUBS): ClubId[] {
  return Object.entries(state.clubs)
    .sort(([a, x], [b, y]) => x.strength - y.strength || (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, count)
    .map(([id]) => id);
}

/** The strongest clubs of the career's ladder at the start (effective strength; ties by id). */
export function strongestClubs(state: Pick<GameState, 'clubs'>, count = STRONG_CLUBS): ClubId[] {
  return Object.entries(state.clubs)
    .sort(([a, x], [b, y]) => y.strength - x.strength || (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, count)
    .map(([id]) => id);
}

/**
 * The table record of a season from its final table, the table after round Z4_ROUND, the club
 * sizes and the weakest and strongest clubs at the start.
 */
export function tableRecord(
  final: readonly StandingRow[],
  afterZ4Round: readonly StandingRow[],
  sizes: Readonly<Record<ClubId, ClubSize>>,
  weakest: readonly ClubId[],
  strongest: readonly ClubId[],
): TableRecord {
  const position = new Map(final.map((row) => [row.clubId, row.position]));
  const champion = final[0]!;
  const sixteenth = afterZ4Round[Z4_FROM - 2]!;
  let z4 = 0;
  let z4Escaped = 0;
  let z4Gap = 0;
  let z4GapEscaped = 0;
  for (const row of afterZ4Round) {
    if (row.position < Z4_FROM) continue;
    const escaped = (position.get(row.clubId) ?? Z4_FROM) < Z4_FROM;
    const gap = sixteenth.points - row.points;
    z4 += 1;
    if (escaped) z4Escaped += 1;
    if (gap >= Z4_GAP.min && gap <= Z4_GAP.max) {
      z4Gap += 1;
      if (escaped) z4GapEscaped += 1;
    }
  }
  return {
    champion: champion.clubId,
    championPoints: champion.points,
    championSize: sizes[champion.clubId]!,
    seventeenthPoints: final[Z4_FROM - 1]!.points,
    bigRelegated: final.some((row) => row.position >= Z4_FROM && sizes[row.clubId] === 'big'),
    weakInG4: weakest.some((id) => (position.get(id) ?? Infinity) <= G4_TO),
    strongChampion: strongest.includes(champion.clubId),
    strongRelegated: strongest.some((id) => (position.get(id) ?? 0) >= Z4_FROM),
    z4,
    z4Escaped,
    z4Gap,
    z4GapEscaped,
  };
}

/** What a season needs: the params, the clubs and the base seed. */
export interface BalanceContext {
  readonly params: GameParams;
  readonly clubs: readonly ClubDef[];
  readonly seed: number;
}

/** The career seed of season `index` (balance-targets.md, "Temporadas de liga"). */
export function seasonSeed(seed: number, index: number): number {
  return seedFromString(`balance-${seed}-${index}`);
}

/** The new career of season `index`. A refused setup is a programming error: it throws. */
export function seasonStart(ctx: BalanceContext, index: number): GameState {
  const created = newGame(
    { seed: seasonSeed(ctx.seed, index), year: BALANCE_YEAR, realism: 'full' },
    ctx.clubs,
    ctx.params,
    balanceIdentitySource(),
  );
  if (!created.ok) throw new Error(`newGame refused the balance setup: ${created.error}`);
  return created.value;
}

/** Plays season `index` (with the robot coaching `robot`, if given) and reduces it to a record. */
export function runSeason(ctx: BalanceContext, index: number, robot?: ClubId): SeasonRecord {
  return playSeason(ctx, seasonStart(ctx, index), index, robot).record;
}

/** The ladder cut of a state: its own weakest and strongest clubs (ties by id). */
export function ladderCut(state: Pick<GameState, 'clubs'>): LadderCut {
  return {
    weakest: weakestClubs(state),
    strongest: strongestClubs(state),
    driftWeakest: weakestClubs(state, DRIFT_LADDER_CLUBS),
    driftStrongest: strongestClubs(state, DRIFT_LADDER_CLUBS),
  };
}

/**
 * The strength record of the 20 clubs of a state; the ladder gap between the ends of `cut` (by
 * default the state's own, which is season 1's in season 1).
 */
export function strengthRecord(
  state: Pick<GameState, 'clubs'>,
  cut: Pick<LadderCut, 'driftWeakest' | 'driftStrongest'> = ladderCut(state),
): StrengthRecord {
  const clubs = Object.values(state.clubs);
  const values = clubs.map((c) => c.strength);
  const mean = values.reduce((s, x) => s + x, 0) / values.length;
  const variance = values.reduce((s, x) => s + (x - mean) * (x - mean), 0) / values.length;
  const meanOf = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const strengthOf = (ids: readonly ClubId[]) => ids.map((id) => state.clubs[id]!.strength);
  const big = clubs.filter((c) => c.def.size === 'big').map((c) => c.strength);
  const others = clubs.filter((c) => c.def.size !== 'big').map((c) => c.strength);
  return {
    mean,
    sd: Math.sqrt(variance),
    range: Math.max(...values) - Math.min(...values),
    sizeGap: meanOf(big) - meanOf(others),
    ladderGap: meanOf(strengthOf(cut.driftStrongest)) - meanOf(strengthOf(cut.driftWeakest)),
  };
}

/** A career of `seasons` seasons in a row (`--chain`): its records, season by season. */
export interface CareerRecord {
  index: number;
  seasons: SeasonRecord[];
}

/**
 * Career `index` of a `--chain` run (balance-targets.md, "Cadeia de temporadas"): the same new
 * career as season `index` of a single-season run, then `seasons` seasons in a row through the
 * engine's `endSeason` (no human club) and `startNextSeason`, every club played by the AI. Each
 * record has its season and the clubs' strength at its start. The weakest and strongest clubs are
 * those of season 1 in every season (decision 15). A refused turn is a programming error: it
 * throws.
 */
export function runCareer(ctx: BalanceContext, index: number, seasons: number): CareerRecord {
  const records: SeasonRecord[] = [];
  let state = seasonStart(ctx, index);
  const cut = ladderCut(state);
  for (let season = 1; season <= seasons; season++) {
    const strength = strengthRecord(state, cut);
    const ageMean = squadAgeMean(state);
    const played = playSeason(ctx, state, index, undefined, cut);
    const squads: SquadsRecord = {
      ageMean,
      revelationCandidates: revelationCandidates(played.state),
    };
    if (season === seasons) {
      records.push({ ...played.record, season, strength, squads });
      break;
    }
    const closed = endSeason(played.state, ctx.params, [], balanceIdentitySource());
    if (!closed.ok) throw new Error(`endSeason refused career ${index}: ${closed.error}`);
    const retired = retiredAtTurn(played.state, closed.value.state);
    records.push({ ...played.record, season, strength, squads: { ...squads, retired } });
    const next = startNextSeason(closed.value.state, ctx.params, balanceIdentitySource());
    if (!next.ok) throw new Error(`startNextSeason refused career ${index}: ${next.error}`);
    state = next.value;
  }
  return { index, seasons: records };
}

/** The mean age of the players of the 20 squads. */
export function squadAgeMean(state: Pick<GameState, 'players' | 'squads'>): number {
  const ages = Object.values(state.squads).flatMap((ids) =>
    ids.map((id) => state.players[id]!.age),
  );
  return ages.reduce((s, x) => s + x, 0) / ages.length;
}

/**
 * The revelation's pool at the end of a season: players of the squads of at most
 * REVELATION_MAX_AGE (the age of the season played) with AWARD_MIN_GAMES rated games.
 */
export function revelationCandidates(
  state: Pick<GameState, 'players' | 'squads' | 'seasonStats'>,
): number {
  let n = 0;
  for (const ids of Object.values(state.squads)) {
    for (const id of ids) {
      const rated = state.seasonStats[id]?.ratedGames ?? 0;
      if (state.players[id]!.age <= REVELATION_MAX_AGE && rated >= AWARD_MIN_GAMES) n++;
    }
  }
  return n;
}

/** Players of the squads at round 39 that `endSeason` took out of them (the retirements). */
export function retiredAtTurn(
  before: Pick<GameState, 'squads'>,
  after: Pick<GameState, 'squads'>,
): number {
  let n = 0;
  for (const [clubId, ids] of Object.entries(before.squads)) {
    const now = new Set(after.squads[clubId] ?? []);
    n += ids.filter((id) => !now.has(id)).length;
  }
  return n;
}

/**
 * Plays the 38 rounds of a season from `start` and reduces it to a record; the weakest and
 * strongest clubs are those of `cut` (by default the ladder at `start`).
 */
export function playSeason(
  ctx: BalanceContext,
  start: GameState,
  index: number,
  robot?: ClubId,
  cut: Pick<LadderCut, 'weakest' | 'strongest'> = ladderCut(start),
): { state: GameState; record: SeasonRecord } {
  const { params } = ctx;
  let state = start;
  const { weakest, strongest } = cut;
  const sizes: Record<ClubId, ClubSize> = {};
  for (const [id, club] of Object.entries(state.clubs)) sizes[id] = club.def.size;
  const matches = emptyMatchTally();
  const sheets: SheetTally = { sheets: 0, highPressure: 0, tiredStarter: 0, byProfile: {} };
  const fans: FansTally = { n: 0, sum: 0, sumSq: 0, below20: 0, above90: 0 };
  let afterZ4Round: StandingRow[] | undefined;

  while (state.phase === 'season' && state.round >= 1 && state.round <= 38) {
    const before = state;
    const input: RoundInput =
      robot === undefined
        ? { round: state.round, sheets: {}, commands: {}, fanDecisions: {} }
        : robotRoundInput(state, params, robot);
    const played = playRound(state, params, input);
    if (!played.ok) throw new Error(`playRound refused round ${state.round}: ${played.error}`);
    state = played.value.state;
    for (const result of played.value.report.results) addMatch(matches, result);
    for (const [clubId, sheet] of Object.entries(state.lastSheets)) {
      // Every club plays every round of the Série A, so these are this round's sheets.
      if (clubId === robot) continue;
      const profile = state.clubs[clubId]!.profile;
      const counts = (sheets.byProfile[profile] ??= {});
      for (const key of [sheet.tactic.posture, `pressure-${sheet.tactic.pressure}`]) {
        counts[key] = (counts[key] ?? 0) + 1;
      }
      sheets.sheets += 1;
      if (sheet.tactic.pressure === 'high') sheets.highPressure += 1;
      const tired = sheet.lineup.starters.some(
        (id) => (before.players[id]?.condition ?? 100) < TIRED_STARTER_CONDITION,
      );
      if (tired) sheets.tiredStarter += 1;
    }
    for (const club of Object.values(state.clubs)) addFans(fans, club.fans);
    if (played.value.report.round === Z4_ROUND) afterZ4Round = getStandings(state);
  }

  const final = getStandings(state);
  const points: Record<ClubId, number> = {};
  const positions: Record<ClubId, number> = {};
  for (const row of final) {
    points[row.clubId] = row.points;
    positions[row.clubId] = row.position;
  }
  return {
    state,
    record: {
      index,
      ...(robot === undefined ? {} : { robot }),
      matches,
      sheets,
      fans,
      table: tableRecord(final, afterZ4Round ?? final, sizes, weakest, strongest),
      points,
      positions,
    },
  };
}
