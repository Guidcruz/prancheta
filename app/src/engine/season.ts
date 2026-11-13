import { DEFAULT_STRENGTH, type ClubDef } from './clubs.ts';
import { generateFixtures } from './fixtures.ts';
import { FORMATION_SLOTS } from './formations.ts';
import type { ClubState, GameState } from './game.ts';
import {
  IDOL_MIN_AGE,
  START_CONDITION,
  bestEleven,
  elevenStrength,
  generateAcademy,
} from './generation.ts';
import { clamp, normal } from './math.ts';
import { SEASON_ROUNDS, type GameParams } from './params.ts';
import {
  AGE_RANGE,
  MORALE_RANGE,
  fitAttributesToOverall,
  type IdentitySource,
  type Player,
} from './players.ts';
import { fail, ok } from './result.ts';
import { Rng, seedFromString } from './rng.ts';
import type { PlayerSeasonStats } from './round.ts';
import { idNumber } from './selection.ts';
import { RELEGATION_SPOTS, getStandings, type StandingRow } from './standings.ts';
import type { ClubId, EngineWarning, Formation, PlayerId, Position, Result } from './types.ts';
import { ENGINE_VERSION } from './version.ts';

/*
 * The end of the season and the turn to the next one (docs/design/temporada.md, "Fim de
 * temporada"; docs/design/jogadores.md, "Evolução"; US-025; T-017). Two pure functions:
 *
 * `endSeason` (only at round 39 with `phase: 'season'`), in this order:
 * 1. the final table (`getStandings`): the champion and the relegation zone (17th to 20th);
 * 2. the awards, from `seasonStats` and the ages of the season played;
 * 3. the campaign of every human club (position, points, the board's target, biggest win and
 *    defeat, the club's top scorer);
 * 4. the evolution and the birthday of every player of the 20 clubs (it reads the minutes and the
 *    morale after round 38, and the campaign keeps the overall before and after);
 * 5. the minimal renewal (T-048; temporada.md, "Carreira longa na 1a"): who retires after the
 *    birthday (a draw by age from 33 to 39, always at RETIREMENT_MAX_AGE) leaves the squad (he
 *    stays in `players` until the turn, so the summary screen still has his name and face), a
 *    youth of the academy comes in his place, and a club whose idol retired picks a new one;
 * 6. the summary goes to `pastSeasons` and the phase becomes `seasonEnd` (the title counts from
 *    here, `careerLeagueTitles`).
 *
 * `startNextSeason` (only with `phase: 'seasonEnd'`): season + 1, year + 1, round 1, the new
 * calendar (the only draw, by the new season's stream), `seasonStats` cleared (`lastSheets`
 * stays), the retired players out of `players`, the others rested and fit with half of the way
 * of their morale to `fans.start`, the thermometers back to `fans.start` and the strength
 * recalculated from the evolved squads (temporada.md, "Força dos clubes na virada").
 *
 * Every number is a rule constant of the design documents, not a /balance knob. Pure and
 * deterministic: the same state always gives the same result, the input is never changed, and a
 * game situation never throws (a refused call is a typed error that leaves the state as it was).
 */

/** Minimum games of the rating and goalkeeper awards: half of the 38 rounds (temporada.md). */
export const AWARD_MIN_GAMES = SEASON_ROUNDS / 2;
/** The revelation is at most this old in the season played, before the birthday of the turn. */
export const REVELATION_MAX_AGE = 21;
/** The team of the season is a 4-3-3, natural positions only (temporada.md, "Prêmios"). */
export const TEAM_OF_SEASON_FORMATION: Formation = '4-3-3';
/** At the turn the morale makes this share of the way to `fans.start` (decision 13). */
export const MORALE_OFFSEASON_PULL = 0.5;
/**
 * The morale after the turn is rounded to hundredths (1 / MORALE_TURN_SCALE): the pull halves the
 * morale of the season, whose drift towards the thermometer leaves long real numbers, and kept
 * whole those digits would make the state grow from one season to the next (BUG-A of T-017; at
 * most 0.005 of morale, nothing a match can tell).
 */
export const MORALE_TURN_SCALE = 100;

/** The morale of a player at the turn: half of the way to `fansStart`, rounded and in range. */
export function moraleAtTurn(morale: number, fansStart: number): number {
  const pulled = morale + MORALE_OFFSEASON_PULL * (fansStart - morale);
  const rounded = Math.round(pulled * MORALE_TURN_SCALE) / MORALE_TURN_SCALE;
  return clamp(rounded, MORALE_RANGE.min, MORALE_RANGE.max);
}

/**
 * The retirement of the minimal renewal (decision 14 of balance-targets.md, revised by the CEO on
 * 2026-11-06; temporada.md, "Carreira longa na 1a"), by the age after the birthday of the turn:
 * from RETIREMENT_MIN_AGE to RETIREMENT_MAX_AGE − 1 a chance by age (lower for goalkeepers), at
 * RETIREMENT_MAX_AGE or more always, below RETIREMENT_MIN_AGE never. So nobody plays a season at
 * 40. Rule constants, the "botão a calibrar" of the decision, not /balance parameters.
 */
export const RETIREMENT_MIN_AGE = 33;
export const RETIREMENT_MAX_AGE = 40;
/** Chance of retiring at 33, 34, …, 39: outfield players, then goalkeepers (natural GK). */
export const RETIREMENT_CHANCE: {
  readonly outfield: readonly number[];
  readonly goalkeeper: readonly number[];
} = {
  outfield: [0.05, 0.1, 0.25, 0.35, 0.45, 0.55, 0.7],
  goalkeeper: [0, 0.02, 0.05, 0.1, 0.15, 0.2, 0.3],
};

/** The chance of retiring at the turn for a player of `age` (after the birthday) and position. */
export function retirementChance(age: number, position: Position): number {
  if (age >= RETIREMENT_MAX_AGE) return 1;
  if (age < RETIREMENT_MIN_AGE) return 0;
  const table = position === 'GK' ? RETIREMENT_CHANCE.goalkeeper : RETIREMENT_CHANCE.outfield;
  return table[age - RETIREMENT_MIN_AGE] ?? 0;
}

/** The retirement stream of a player: ``${seed}-s${season}-retirement-${playerId}``. */
export function retirementSeed(
  state: Pick<GameState, 'seed' | 'season'>,
  playerId: PlayerId,
): number {
  return seedFromString(`${state.seed}-s${state.season}-retirement-${playerId}`);
}

/**
 * Whether a player retires at the turn (`player` already a year older): at RETIREMENT_MAX_AGE or
 * more without a draw; below RETIREMENT_MIN_AGE (or at a chance of 0) never, without a draw;
 * otherwise one draw, `rng.chance(p)`, of his own stream ({@link retirementSeed}, `season` = the
 * season played), so the order of the clubs and of the squad never matters.
 */
export function retires(
  state: Pick<GameState, 'seed' | 'season'>,
  player: Pick<Player, 'id' | 'age' | 'position'>,
): boolean {
  const p = retirementChance(player.age, player.position);
  if (p >= 1) return true;
  if (p <= 0) return false;
  return new Rng(retirementSeed(state, player.id)).chance(p);
}

/** The board's target never asks for worse than this position ("não cair"). */
export const TARGET_POSITION_MAX = 16;
/** The board's target: `min(strengthRank + TARGET_MARGIN, TARGET_POSITION_MAX)`. */
export const TARGET_MARGIN = 2;

/**
 * The evolution's rule constants (jogadores.md, "Evolução"): the age curve by `ageEff` (upper
 * bound of each band, inclusive, and its Δ; above the last band, `curveAfter`), the minutes of
 * reference (60% of 38 games of 90 minutes) and the multipliers of minutes (1.0 to 1.2) and of
 * morale (0.9 to 1.1), which only apply to a positive Δ, and the noise of `Normal(0, 1)`.
 */
export const EVOLUTION = {
  curve: [
    [19, 5],
    [21, 4],
    [23, 3],
    [25, 2],
    [27, 1],
    [30, 0],
    [32, -1],
    [34, -2],
  ],
  curveAfter: -3,
  /** `ageEff = age − (peakAge − peakReference)`. */
  peakReference: 27,
  minutesReference: 38 * 90 * 0.6,
  minutesBonus: 0.2,
  moraleBase: 0.9,
  moraleBonus: 0.2,
  noiseSd: 1,
} as const satisfies {
  curve: readonly (readonly [number, number])[];
  curveAfter: number;
  peakReference: number;
  minutesReference: number;
  minutesBonus: number;
  moraleBase: number;
  moraleBonus: number;
  noiseSd: number;
};

// ---------------------------------------------------------------------------------------------
// Summary types (temporada.md, "O que vai para pastSeasons"): ids and numbers only, never names
// (ADR-0012), so a retired name regenerated in the save can never survive here.

/** An award shared by everyone level in all the criteria (top scorer, top assists). */
export interface ScorerAward {
  readonly playerId: PlayerId;
  /** His club in the season (no transfers in 1a; kept for when there is a market). */
  readonly clubId: ClubId;
  readonly goals: number;
}
export interface AssistAward {
  readonly playerId: PlayerId;
  readonly clubId: ClubId;
  readonly assists: number;
}
/** Best player and revelation: the mean rating (`ratingSum / ratedGames`). */
export interface RatingAward {
  readonly playerId: PlayerId;
  readonly clubId: ClubId;
  readonly rating: number;
}
/** Best goalkeeper: goals conceded per game (`conceded / games`). */
export interface GoalkeeperAward {
  readonly playerId: PlayerId;
  readonly clubId: ClubId;
  readonly concededPerGame: number;
}
/** One slot of the team of the season; without ids nobody reached the minimum ("vaga vazia"). */
export interface TeamOfSeasonSlot {
  readonly slot: Position;
  readonly playerId?: PlayerId;
  readonly clubId?: ClubId;
}

/**
 * The awards of a season (temporada.md, "Prêmios"). An empty list or an absent award is "sem
 * vencedor nesta temporada" (nobody reached the minimum).
 */
export interface SeasonAwards {
  readonly topScorers: readonly ScorerAward[];
  readonly topAssists: readonly AssistAward[];
  readonly bestPlayer?: RatingAward;
  readonly revelation?: RatingAward;
  readonly bestGoalkeeper?: GoalkeeperAward;
  /** The 11 slots of the 4-3-3, in formation order. */
  readonly teamOfSeason: readonly TeamOfSeasonSlot[];
}

/** A match of a campaign, from the club's side; an abandoned match counts by its awarded score. */
export interface CampaignMatch {
  readonly round: number;
  readonly opponentId: ClubId;
  readonly home: boolean;
  readonly scored: number;
  readonly conceded: number;
}

/** A player whose overall changed in the evolution, with the overall before and after it. */
export interface PlayerEvolution {
  readonly playerId: PlayerId;
  readonly before: number;
  readonly after: number;
}

/** The campaign of a human club (temporada.md, "Campanha do clube do técnico"). */
export interface ClubCampaign {
  readonly position: number;
  readonly points: number;
  /** `targetPosition` by the strength of the season that ended. */
  readonly target: number;
  /** `position ≤ target`. */
  readonly targetMet: boolean;
  /** Absent without a win (or a defeat). */
  readonly biggestWin?: CampaignMatch;
  readonly biggestDefeat?: CampaignMatch;
  /** Who scored most for the club; level players share it; empty without goals. */
  readonly topScorers: readonly { readonly playerId: PlayerId; readonly goals: number }[];
  /** From the biggest Δ down; ties by the higher new overall, then squad order. */
  readonly evolved: readonly PlayerEvolution[];
  /**
   * Who retired at the turn (in the order of the squad of the season played) and who came up
   * from the academy (in the order they joined the squad, the k of their ids): the minimal
   * renewal (T-048), for the "Despedidas e chegadas da base" of the summary (T-037).
   */
  readonly farewells: readonly PlayerId[];
  readonly academy: readonly PlayerId[];
}

/** One item of `GameState.pastSeasons`, written by `endSeason`. */
export interface SeasonSummary {
  readonly season: number;
  readonly year: number;
  readonly championId: ClubId;
  readonly championPoints: number;
  /** The 17th to the 20th, in order; informative only in 1a (P2). */
  readonly relegationZone: readonly ClubId[];
  readonly awards: SeasonAwards;
  /** By human club id, in the order the caller passed them. */
  readonly campaigns: Readonly<Record<ClubId, ClubCampaign>>;
}

// ---------------------------------------------------------------------------------------------
// Evolution (jogadores.md, "Evolução")

/** The Δ of the age curve for an effective age (jogadores.md, the `ageEff` table). */
export function ageCurve(ageEff: number): number {
  for (const [upTo, delta] of EVOLUTION.curve) if (ageEff <= upTo) return delta;
  return EVOLUTION.curveAfter;
}

/** What the evolution of one player reads (jogadores.md, "Entradas"). */
export type EvolvingPlayer = Pick<
  Player,
  'age' | 'peakAge' | 'growth' | 'morale' | 'overall' | 'potential'
>;

/**
 * The new overall of a player at the end of the season (jogadores.md, "Evolução"), with the
 * noise `noise` already drawn (`Normal(0, 1)`; 0 gives the expected value of the design example):
 *
 *     ageEff = age − (peakAge − 27); Δ = curve(ageEff)
 *     if Δ > 0: Δ = Δ × growth × (1 + 0.2 × min(1, minutes / 2052)) × (0.9 + 0.2 × morale / 100)
 *     Δ = round(Δ + noise); if Δ > 0: Δ = min(Δ, potential − overall)
 *     target = clamp(overall + Δ, 1, 99)
 *
 * `age` is the one of the season that ended and `morale` the one after round 38. The headroom
 * `potential − overall` is never negative in a valid player; a damaged one gets 0.
 */
export function evolutionTarget(player: EvolvingPlayer, minutes: number, noise: number): number {
  const ageEff = player.age - (player.peakAge - EVOLUTION.peakReference);
  let delta: number = ageCurve(ageEff);
  if (delta > 0) {
    const played = Math.min(1, Math.max(0, minutes) / EVOLUTION.minutesReference);
    delta =
      delta *
      player.growth *
      (1 + EVOLUTION.minutesBonus * played) *
      (EVOLUTION.moraleBase + (EVOLUTION.moraleBonus * player.morale) / 100);
  }
  delta = Math.round(delta + noise);
  if (delta > 0) delta = Math.min(delta, Math.max(0, player.potential - player.overall));
  return clamp(player.overall + delta, 1, 99);
}

/** The evolution stream of a player: ``${seed}-s${season}-evolution-${playerId}``. */
export function evolutionSeed(
  state: Pick<GameState, 'seed' | 'season'>,
  playerId: PlayerId,
): number {
  return seedFromString(`${state.seed}-s${state.season}-evolution-${playerId}`);
}

/**
 * The player after the evolution and the birthday (jogadores.md, "Evolução"): the new overall by
 * {@link evolutionTarget} with the noise of his own stream (so the order of processing never
 * matters), the attributes moved to it by `fitAttributesToOverall` (unchanged when the overall
 * does not move) and `age + 1`, capped at AGE_RANGE.max. Nothing else changes (potential,
 * peakAge, growth, trait, shirt).
 */
export function evolvePlayer(
  state: Pick<GameState, 'seed' | 'season'>,
  player: Player,
  minutes: number,
): Player {
  const rng = new Rng(evolutionSeed(state, player.id));
  const noise = normal(rng, 0, EVOLUTION.noiseSd);
  const target = evolutionTarget(player, minutes, noise);
  const attributes =
    target === player.overall
      ? player.attributes
      : fitAttributesToOverall(player.attributes, player.position, target);
  // Capped at AGE_RANGE.max (99, sanity only; some 65 seasons away) so the state never becomes
  // invalid for the validator.
  const age = Math.min(player.age + 1, AGE_RANGE.max);
  return { ...player, overall: target, attributes, age };
}

// ---------------------------------------------------------------------------------------------
// Awards (temporada.md, "Prêmios")

interface Candidate {
  readonly player: Player;
  readonly stats: PlayerSeasonStats;
}

/** "Menor id": the club id, then the number of the player in the club, numerically. */
function compareIds(a: Player, b: Player): number {
  if (a.clubId !== b.clubId) return a.clubId < b.clubId ? -1 : 1;
  const d = idNumber(a, 0) - idNumber(b, 0);
  if (d !== 0) return d;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

const meanRating = (s: PlayerSeasonStats) => (s.ratedGames > 0 ? s.ratingSum / s.ratedGames : 0);

/** Who took the pitch this season and is still in the state, in "menor id" order. */
function candidates(state: Pick<GameState, 'players' | 'seasonStats'>): Candidate[] {
  const out: Candidate[] = [];
  for (const [id, stats] of Object.entries(state.seasonStats)) {
    const player = state.players[id];
    if (player !== undefined) out.push({ player, stats });
  }
  return out.sort((a, b) => compareIds(a.player, b.player));
}

/** The best by `compare` (negative = `a` ahead), or every one level at the top when `share`. */
function best(
  list: readonly Candidate[],
  compare: (a: Candidate, b: Candidate) => number,
): Candidate[] {
  const sorted = [...list].sort((a, b) => compare(a, b) || compareIds(a.player, b.player));
  const top = sorted[0];
  return top === undefined ? [] : sorted.filter((c) => compare(c, top) === 0);
}

/** Best player and revelation: mean rating, more rated games, more minutes, lower id. */
const byRating = (a: Candidate, b: Candidate) =>
  meanRating(b.stats) - meanRating(a.stats) ||
  b.stats.ratedGames - a.stats.ratedGames ||
  b.stats.minutes - a.stats.minutes;

function ratingAward(list: readonly Candidate[]): RatingAward | undefined {
  const winner = best(list, byRating)[0];
  if (winner === undefined) return undefined;
  const { player, stats } = winner;
  return { playerId: player.id, clubId: player.clubId, rating: meanRating(stats) };
}

/**
 * The awards of the season (temporada.md, "Prêmios"), from `seasonStats` and the ages of the
 * season played:
 * - top scorer: at least 1 goal; most goals, then fewer games, then more assists; level in all
 *   share it (the list, in "menor id" order);
 * - top assists: at least 1 assist; most assists, fewer games, more goals; shared the same way;
 * - best player: at least AWARD_MIN_GAMES rated games; the highest mean rating, then more rated
 *   games, more minutes, the lower id;
 * - revelation: the same, at most REVELATION_MAX_AGE years old;
 * - best goalkeeper: natural GK with at least AWARD_MIN_GAMES games; the fewest conceded per game,
 *   then more games, the higher mean rating, the lower id;
 * - team of the season: the 4-3-3 slot by slot in formation order, natural position only, at
 *   least AWARD_MIN_GAMES rated games, as the best player, never the same player twice.
 * Nobody reaching the minimum: no award (absent, an empty list or a slot without ids).
 *
 * In the `seasonEnd` phase the screens read the awards from `pastSeasons.at(-1)`, never from this
 * function: after `endSeason` the ages are a year older (the revelation would change) and, after
 * `startNextSeason`, `seasonStats` is empty.
 */
export function seasonAwards(state: Pick<GameState, 'players' | 'seasonStats'>): SeasonAwards {
  const all = candidates(state);

  const scorers = best(
    all.filter((c) => c.stats.goals >= 1),
    (a, b) =>
      b.stats.goals - a.stats.goals ||
      a.stats.games - b.stats.games ||
      b.stats.assists - a.stats.assists,
  );
  const assisters = best(
    all.filter((c) => c.stats.assists >= 1),
    (a, b) =>
      b.stats.assists - a.stats.assists ||
      a.stats.games - b.stats.games ||
      b.stats.goals - a.stats.goals,
  );
  const rated = all.filter((c) => c.stats.ratedGames >= AWARD_MIN_GAMES);
  const bestPlayer = ratingAward(rated);
  const revelation = ratingAward(rated.filter((c) => c.player.age <= REVELATION_MAX_AGE));
  const keeper = best(
    all.filter((c) => c.player.position === 'GK' && c.stats.games >= AWARD_MIN_GAMES),
    (a, b) =>
      a.stats.conceded / a.stats.games - b.stats.conceded / b.stats.games ||
      b.stats.games - a.stats.games ||
      meanRating(b.stats) - meanRating(a.stats),
  )[0];

  const taken = new Set<PlayerId>();
  const teamOfSeason: TeamOfSeasonSlot[] = FORMATION_SLOTS[TEAM_OF_SEASON_FORMATION].map((slot) => {
    const pick = best(
      rated.filter((c) => c.player.position === slot && !taken.has(c.player.id)),
      byRating,
    )[0];
    if (pick === undefined) return { slot };
    taken.add(pick.player.id);
    return { slot, playerId: pick.player.id, clubId: pick.player.clubId };
  });

  return {
    topScorers: scorers.map(({ player, stats }) => ({
      playerId: player.id,
      clubId: player.clubId,
      goals: stats.goals,
    })),
    topAssists: assisters.map(({ player, stats }) => ({
      playerId: player.id,
      clubId: player.clubId,
      assists: stats.assists,
    })),
    ...(bestPlayer === undefined ? {} : { bestPlayer }),
    ...(revelation === undefined ? {} : { revelation }),
    ...(keeper === undefined
      ? {}
      : {
          bestGoalkeeper: {
            playerId: keeper.player.id,
            clubId: keeper.player.clubId,
            concededPerGame: keeper.stats.conceded / keeper.stats.games,
          },
        }),
    teamOfSeason,
  };
}

// ---------------------------------------------------------------------------------------------
// Board target and campaign (temporada.md, "Expectativa da diretoria" and "Campanha")

/**
 * The position of a club in the order of `ClubState.strength` (1 = strongest; ties by id), or
 * undefined for an unknown club.
 */
export function strengthRank(state: Pick<GameState, 'clubs'>, clubId: ClubId): number | undefined {
  if (!Object.hasOwn(state.clubs, clubId)) return undefined;
  const order = Object.entries(state.clubs)
    .sort(([a, x], [b, y]) => y.strength - x.strength || (a < b ? -1 : a > b ? 1 : 0))
    .map(([id]) => id);
  return order.indexOf(clubId) + 1;
}

/**
 * The board's target (temporada.md, "Expectativa da diretoria"):
 * `min(strengthRank + 2, 16)`, or undefined for an unknown club.
 */
export function targetPosition(
  state: Pick<GameState, 'clubs'>,
  clubId: ClubId,
): number | undefined {
  const rank = strengthRank(state, clubId);
  return rank === undefined ? undefined : Math.min(rank + TARGET_MARGIN, TARGET_POSITION_MAX);
}

/** The club's matches of the season, from its side (by the awarded score of an abandoned one). */
function clubMatches(state: Pick<GameState, 'fixtures'>, clubId: ClubId): CampaignMatch[] {
  const out: CampaignMatch[] = [];
  for (const f of state.fixtures) {
    if (f.result === undefined) continue;
    const home = f.homeId === clubId;
    if (!home && f.awayId !== clubId) continue;
    const [h, a] = f.result.score;
    out.push({
      round: f.round,
      opponentId: home ? f.awayId : f.homeId,
      home,
      scored: home ? h : a,
      conceded: home ? a : h,
    });
  }
  return out;
}

/**
 * The biggest win (`sign` 1) or defeat (−1): the largest margin, then more goals scored (by the
 * winner of that match, the club for a win and the opponent for a defeat), then the earliest
 * round; undefined without one.
 */
function biggest(matches: readonly CampaignMatch[], sign: 1 | -1): CampaignMatch | undefined {
  let found: CampaignMatch | undefined;
  const margin = (m: CampaignMatch) => sign * (m.scored - m.conceded);
  const goals = (m: CampaignMatch) => (sign === 1 ? m.scored : m.conceded);
  for (const m of matches) {
    if (margin(m) <= 0) continue;
    if (
      found === undefined ||
      margin(m) > margin(found) ||
      (margin(m) === margin(found) &&
        (goals(m) > goals(found) || (goals(m) === goals(found) && m.round < found.round)))
    ) {
      found = m;
    }
  }
  return found;
}

/**
 * The campaign of a club in the season (temporada.md, "Campanha do clube do técnico"), from the
 * state at round 39 and the final table. `evolved` is filled by `endSeason`, after the evolution.
 */
function clubCampaign(
  state: GameState,
  table: readonly StandingRow[],
  clubId: ClubId,
): Omit<ClubCampaign, 'evolved' | 'farewells' | 'academy'> | undefined {
  const row = table.find((r) => r.clubId === clubId);
  const target = targetPosition(state, clubId);
  if (row === undefined || target === undefined) return undefined;
  const matches = clubMatches(state, clubId);
  const biggestWin = biggest(matches, 1);
  const biggestDefeat = biggest(matches, -1);
  let top = 0;
  const scorers: { playerId: PlayerId; goals: number }[] = [];
  for (const id of state.squads[clubId] ?? []) {
    const goals = state.seasonStats[id]?.goals ?? 0;
    if (goals <= 0 || goals < top) continue;
    if (goals > top) scorers.length = 0;
    top = goals;
    scorers.push({ playerId: id, goals });
  }
  return {
    position: row.position,
    points: row.points,
    target,
    targetMet: row.position <= target,
    ...(biggestWin === undefined ? {} : { biggestWin }),
    ...(biggestDefeat === undefined ? {} : { biggestDefeat }),
    topScorers: scorers,
  };
}

/** The players of a club whose overall moved: biggest Δ first, then new overall, squad order. */
function evolvedOf(
  squad: readonly PlayerId[],
  before: Readonly<Record<PlayerId, Player>>,
  after: Readonly<Record<PlayerId, Player>>,
): PlayerEvolution[] {
  const list: { id: PlayerId; before: number; after: number; order: number }[] = [];
  squad.forEach((id, order) => {
    const b = before[id];
    const a = after[id];
    if (b === undefined || a === undefined || a.overall === b.overall) return;
    list.push({ id, before: b.overall, after: a.overall, order });
  });
  list.sort(
    (x, y) => y.after - y.before - (x.after - x.before) || y.after - x.after || x.order - y.order,
  );
  return list.map((e) => ({ playerId: e.id, before: e.before, after: e.after }));
}

// ---------------------------------------------------------------------------------------------
// The minimal renewal (T-048; temporada.md, "Carreira longa na 1a"; decision 14)

/** What the renewal of one club did: who left, who came, and the new idol if one was picked. */
interface ClubRenewal {
  readonly squad: readonly PlayerId[];
  readonly farewells: readonly PlayerId[];
  readonly academy: readonly PlayerId[];
  readonly youth: readonly Player[];
  readonly newIdol?: PlayerId;
}

/**
 * The idol picked when the club's one leaves (jogadores.md, "Traço de personalidade"): the rule
 * of the generation applied to the best XI of the moment (`bestEleven` of the squad in its first
 * preferred formation, everyone fit and fresh): the starter of IDOL_MIN_AGE or more with the
 * highest overall; without one, the starter with the highest overall. Ties: the first in the XI's
 * slot order, as the generation's "XI por vaga". Undefined only for an empty squad.
 */
export function pickIdol(squad: readonly Player[], formation: Formation): PlayerId | undefined {
  const eleven = bestEleven(squad, formation).map(({ player }) => player);
  const veterans = eleven.filter((p) => p.age >= IDOL_MIN_AGE);
  const pool = veterans.length > 0 ? veterans : eleven;
  let best: Player | undefined;
  for (const p of pool) if (best === undefined || p.overall > best.overall) best = p;
  return best?.id;
}

/**
 * The renewal of one club after the evolution (`players` already a year older): who
 * {@link retires} leaves the squad, the academy (`generateAcademy`) promotes a youth of the same
 * position for each, at the end of the squad, and, if no idol is left, {@link pickIdol} picks one.
 * Undefined when nobody retires (nothing changes). An id of the squad missing from `players` (a
 * broken state) is never read: it stays where it is, with or without a retirement.
 */
function renewClub(
  state: Pick<GameState, 'seed' | 'season'>,
  clubId: ClubId,
  club: ClubState,
  squadIds: readonly PlayerId[],
  players: Readonly<Record<PlayerId, Player>>,
  params: GameParams,
  identities: IdentitySource,
): ClubRenewal | undefined {
  const farewells = squadIds.filter((id) => {
    const p = players[id];
    return p !== undefined && retires(state, p);
  });
  if (farewells.length === 0) return undefined;
  const leaving = new Set(farewells);
  const stayingIds = squadIds.filter((id) => !leaving.has(id));
  const staying: Player[] = [];
  for (const id of stayingIds) {
    const p = players[id];
    if (p !== undefined) staying.push(p);
  }
  const youth = generateAcademy(
    {
      clubId,
      seed: state.seed,
      season: state.season,
      strength: club.def.strength ?? DEFAULT_STRENGTH,
      positions: farewells.map((id) => players[id]!.position),
      squad: staying,
    },
    params,
    identities,
  );
  const squad = [...staying, ...youth];
  const newIdol = squad.some((p) => p.trait === 'idol')
    ? undefined
    : pickIdol(squad, club.preferredFormations[0]);
  return {
    squad: [...stayingIds, ...youth.map((p) => p.id)],
    farewells,
    academy: youth.map((p) => p.id),
    youth,
    ...(newIdol === undefined ? {} : { newIdol }),
  };
}

// ---------------------------------------------------------------------------------------------
// The two functions

/** The season is played to the end and not yet closed: round 39 with `phase: 'season'`. */
function seasonFinished(state: Pick<GameState, 'phase' | 'round'>): boolean {
  return state.phase === 'season' && state.round === SEASON_ROUNDS + 1;
}

/**
 * Closes the season (temporada.md, "Fim de temporada"; see the header for the 6 steps): the
 * summary (champion, relegation zone, awards and the campaign of each club of `humans`) goes to
 * `pastSeasons`, every player evolves and gets a year older, the squads renew (T-048), and the
 * phase becomes `seasonEnd`. `humans` are the clubs with a human coach (the career's club; in an
 * online league every club with an owner; `[]` in the /balance); without them the summary has no
 * campaign. `identities` names the youth of the academy (ADR-0012).
 *
 * The renewal (docs/02-architecture.md, 4.1, "Renovação mínima dos elencos"): a player who
 * {@link retires} after the birthday leaves `squads` here and stays in `players` until
 * `startNextSeason` (the summary screen shows his name and face even if the app closes in the
 * `seasonEnd` phase); in his place comes a youth of 17 of the same position (`generateAcademy`),
 * at the end of the squad, so the composition 3/5/4/4/4/5 holds. A club left without its idol
 * picks a new one ({@link pickIdol}), whose trait becomes `idol`, and its `idolBenchStreak` goes
 * back to 0. The campaign lists them in `farewells` and `academy`.
 *
 * The end of the season has no parameter of its own in 1a: of `params`, only `players` (the age
 * curve of the youth, `growthMin` and `growthMax`) is read, by the academy.
 *
 * `evolved` in the campaign lists the squad of the season played, so a player who retired after
 * his last evolution is in it too (the summary shows his last overall).
 *
 * `season-not-finished` in any other state (before round 39, or already closed): nothing changes,
 * so the evolution and the title never count twice. Warning: `season-unknown-club` for a club of
 * `humans` that is not in the state (ignored); a repeated club counts once.
 */
export function endSeason(
  state: GameState,
  params: GameParams,
  humans: readonly ClubId[],
  identities: IdentitySource,
): Result<{ state: GameState; summary: SeasonSummary }, 'season-not-finished'> {
  if (!seasonFinished(state)) {
    return fail('season-not-finished', {
      season: state.season,
      round: state.round,
      phase: state.phase,
    });
  }
  const warnings: EngineWarning[] = [];

  // 1. The final table.
  const table = getStandings(state);
  const champion = table[0];
  if (champion === undefined) {
    // No clubs: a broken state, not a game situation the rules can close.
    return fail('season-not-finished', {
      season: state.season,
      round: state.round,
      phase: state.phase,
      reason: 'no-clubs',
    });
  }
  const relegationZone = table.slice(-RELEGATION_SPOTS).map((r) => r.clubId);

  // 2. The awards, with the stats and the ages of the season played.
  const awards = seasonAwards(state);

  // 3. The campaigns (the evolution part after step 4).
  const campaignClubs: ClubId[] = [];
  const partial = new Map<ClubId, Omit<ClubCampaign, 'evolved' | 'farewells' | 'academy'>>();
  for (const clubId of humans) {
    if (partial.has(clubId)) continue;
    const campaign = Object.hasOwn(state.clubs, clubId)
      ? clubCampaign(state, table, clubId)
      : undefined;
    if (campaign === undefined) {
      warnings.push({ code: 'season-unknown-club', detail: { clubId: String(clubId) } });
      continue;
    }
    partial.set(clubId, campaign);
    campaignClubs.push(clubId);
  }

  // 4. Evolution and birthday of every player.
  const players: Record<PlayerId, Player> = {};
  for (const [id, player] of Object.entries(state.players)) {
    players[id] = evolvePlayer(state, player, state.seasonStats[id]?.minutes ?? 0);
  }

  // 5. The renewal of the squads, club by club (each from its own streams).
  const squads: Record<ClubId, readonly PlayerId[]> = { ...state.squads };
  const renewals = new Map<ClubId, ClubRenewal>();
  const newIdolClubs: [ClubId, ClubState][] = [];
  for (const [clubId, club] of Object.entries(state.clubs)) {
    const renewal = renewClub(
      state,
      clubId,
      club,
      state.squads[clubId] ?? [],
      players,
      params,
      identities,
    );
    if (renewal === undefined) continue;
    renewals.set(clubId, renewal);
    squads[clubId] = renewal.squad;
    for (const youth of renewal.youth) players[youth.id] = youth;
    if (renewal.newIdol !== undefined) {
      players[renewal.newIdol] = { ...players[renewal.newIdol]!, trait: 'idol' };
      newIdolClubs.push([clubId, { ...club, idolBenchStreak: 0 }]);
    }
  }
  // The clubs only change when one picked a new idol (its streak back to 0).
  const clubs =
    newIdolClubs.length === 0
      ? state.clubs
      : { ...state.clubs, ...Object.fromEntries(newIdolClubs) };

  const campaigns: Record<ClubId, ClubCampaign> = {};
  for (const clubId of campaignClubs) {
    const renewal = renewals.get(clubId);
    campaigns[clubId] = {
      ...partial.get(clubId)!,
      evolved: evolvedOf(state.squads[clubId] ?? [], state.players, players),
      farewells: renewal?.farewells ?? [],
      academy: renewal?.academy ?? [],
    };
  }

  // 6. The summary and the phase.
  const summary: SeasonSummary = {
    season: state.season,
    year: state.year,
    championId: champion.clubId,
    championPoints: champion.points,
    relegationZone,
    awards,
    campaigns,
  };
  return ok(
    {
      state: {
        ...state,
        engineVersion: ENGINE_VERSION,
        phase: 'seasonEnd',
        clubs,
        players,
        squads,
        pastSeasons: [...state.pastSeasons, summary],
      },
      summary,
    },
    warnings,
  );
}

/**
 * The strength of a club for the new season (temporada.md, "Força dos clubes na virada"): the
 * "Força" of the best XI of the whole squad in its first preferred formation, as the generation
 * picks it (`bestEleven`, everyone fit and fresh), unrounded, without the ladder nor any
 * renormalisation. Undefined for an unknown club.
 *
 * The screens read `ClubState.strength`, never this function: in the `seasonEnd` phase the squad
 * has already evolved, so it gives the next season's number while `strength` (and the board's
 * target of the summary) is still the one of the season that ended.
 */
export function squadStrength(
  state: Pick<GameState, 'clubs' | 'players' | 'squads'>,
  clubId: ClubId,
): number | undefined {
  const club = state.clubs[clubId];
  if (club === undefined || !Object.hasOwn(state.clubs, clubId)) return undefined;
  const squad: Player[] = [];
  for (const id of state.squads[clubId] ?? []) {
    const p = state.players[id];
    if (p !== undefined) squad.push(p);
  }
  return elevenStrength(bestEleven(squad, club.preferredFormations[0]));
}

/** A player at the turn (temporada.md, "A virada: jogadores"). */
function playerAtTurn(player: Player, fansStart: number): Player {
  return {
    ...player,
    condition: START_CONDITION,
    injuryRounds: 0,
    suspendedGames: 0,
    yellowCount: 0,
    benchStreak: 0,
    recentRatings: [],
    morale: moraleAtTurn(player.morale, fansStart),
  };
}

/**
 * The turn to the next season (temporada.md, "startNextSeason" and the tables of "A virada"):
 * - season + 1, year + 1, round 1, `phase: 'season'`, the calendar of the new season (its own
 *   stream `${seed}-fixtures-${season}`, dates by the new year), `seasonStats` cleared and
 *   `lastSheets` kept;
 * - the players retired by `endSeason` (in no squad) leave `players`, so in the `season` phase
 *   every player is in exactly one squad (T-048);
 * - every player with condition 100, no injury, suspension, yellow card nor bench streak, no form
 *   ("sem jogos") and the morale half of the way to `fans.start` (MORALE_OFFSEASON_PULL), rounded
 *   to hundredths ({@link moraleAtTurn}); age,
 *   overall and attributes already moved in `endSeason`; everything else kept (the idol too);
 * - every club with the thermometer at `fans.start`, `idolBenchStreak` 0 and the strength of its
 *   evolved squad ({@link squadStrength}); profile and formations kept.
 * Nothing else is drawn: the same state always gives the same new season (US-025).
 *
 * `identities` names the players a turn creates; in 1a it creates none here (the academy youth
 * come in `endSeason`), and stays for the clubs of `opts.incoming`. `opts.incoming` (clubs
 * coming up from the Série B) has no game rule until the CEO approves that list (temporada.md,
 * "Acesso da Série B (futuro)"): a non-empty list is refused with `invalid-clubs`.
 *
 * Errors, each leaving the state as it was: `season-not-ended` outside `phase: 'seasonEnd'`,
 * `invalid-clubs` (the incoming clubs, or a broken club set for the calendar) and
 * `invalid-calendar` (the new year outside YEAR_RANGE, or broken season weeks).
 */
export function startNextSeason(
  state: GameState,
  params: GameParams,
  identities: IdentitySource,
  opts: { readonly incoming?: readonly ClubDef[] } = {},
): Result<GameState, 'season-not-ended' | 'invalid-clubs' | 'invalid-calendar'> {
  if (state.phase !== 'seasonEnd') {
    return fail('season-not-ended', { season: state.season, phase: state.phase });
  }
  if (opts.incoming !== undefined && opts.incoming.length > 0) {
    return fail('invalid-clubs', { reason: 'incoming-not-supported' });
  }
  const season = state.season + 1;
  const year = state.year + 1;
  const fixtures = generateFixtures(
    { seed: state.seed, season, year, clubIds: Object.keys(state.clubs) },
    params.season,
  );
  if (!fixtures.ok) {
    return fixtures.error === 'invalid-calendar'
      ? fail('invalid-calendar', fixtures.detail)
      : fail('invalid-clubs', { reason: fixtures.error, detail: fixtures.detail });
  }

  const inSquad = new Set(Object.values(state.squads).flat());
  const players: Record<PlayerId, Player> = {};
  for (const [id, player] of Object.entries(state.players)) {
    if (!inSquad.has(id)) continue;
    players[id] = playerAtTurn(player, params.fans.start);
  }
  const turned = { clubs: state.clubs, players, squads: state.squads };
  const clubs: Record<ClubId, ClubState> = {};
  for (const [id, club] of Object.entries(state.clubs)) {
    clubs[id] = {
      ...club,
      fans: params.fans.start,
      idolBenchStreak: 0,
      strength: squadStrength(turned, id) ?? club.strength,
    };
  }

  return ok({
    ...state,
    engineVersion: ENGINE_VERSION,
    season,
    year,
    round: 1,
    phase: 'season',
    clubs,
    players,
    fixtures: fixtures.value,
    seasonStats: {},
  });
}

/**
 * The league titles of a club in the career (temporada.md, "Títulos da carreira"; US-068): the
 * base season's `def.titles.league` plus the seasons of `pastSeasons` it won. Undefined for an
 * unknown club. The only source, for the screens and the templates alike.
 */
export function careerLeagueTitles(
  state: Pick<GameState, 'clubs' | 'pastSeasons'>,
  clubId: ClubId,
): number | undefined {
  if (!Object.hasOwn(state.clubs, clubId)) return undefined;
  const club = state.clubs[clubId];
  if (club === undefined) return undefined;
  return club.def.titles.league + state.pastSeasons.filter((s) => s.championId === clubId).length;
}
