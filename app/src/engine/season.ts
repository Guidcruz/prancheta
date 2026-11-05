import type { ClubDef } from './clubs.ts';
import { generateFixtures } from './fixtures.ts';
import { FORMATION_SLOTS } from './formations.ts';
import type { ClubState, GameState } from './game.ts';
import { START_CONDITION, bestEleven, elevenStrength, idNumber } from './generation.ts';
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
 * 5. the summary goes to `pastSeasons` and the phase becomes `seasonEnd` (the title counts from
 *    here, `careerLeagueTitles`).
 *
 * `startNextSeason` (only with `phase: 'seasonEnd'`): season + 1, year + 1, round 1, the new
 * calendar (the only draw, by the new season's stream), `seasonStats` cleared and `lastRound`
 * removed (`lastSheets` stays), the players rested and fit with half of the way of their morale to
 * `fans.start`, the thermometers back to `fans.start` and the strength recalculated from the
 * evolved squads (temporada.md, "Força dos clubes na virada").
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
   * Who retired at the turn and who came up from the academy, in squad order (the minimal
   * renewal, T-048). Always empty in T-017: the fields come now so T-048 keeps the state's shape.
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
// The two functions

/** The season is played to the end and not yet closed: round 39 with `phase: 'season'`. */
function seasonFinished(state: Pick<GameState, 'phase' | 'round'>): boolean {
  return state.phase === 'season' && state.round === SEASON_ROUNDS + 1;
}

/**
 * Closes the season (temporada.md, "Fim de temporada"; see the header for the 5 steps): the
 * summary (champion, relegation zone, awards and the campaign of each club of `humans`) goes to
 * `pastSeasons`, every player evolves and gets a year older, and the phase becomes `seasonEnd`.
 * `humans` are the clubs with a human coach (the career's club; in an online league every club
 * with an owner); without them the summary has no campaign.
 *
 * `params` is reserved (part of the contract, docs/02-architecture.md, 4.1) and not read yet: the
 * end of the season has no parameter in 1a.
 *
 * `season-not-finished` in any other state (before round 39, or already closed): nothing changes,
 * so the evolution and the title never count twice. Warning: `season-unknown-club` for a club of
 * `humans` that is not in the state (ignored); a repeated club counts once.
 */
export function endSeason(
  state: GameState,
  params: GameParams,
  humans: readonly ClubId[] = [],
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
  const campaigns: Record<ClubId, ClubCampaign> = {};
  for (const clubId of campaignClubs) {
    campaigns[clubId] = {
      ...partial.get(clubId)!,
      evolved: evolvedOf(state.squads[clubId] ?? [], state.players, players),
      farewells: [],
      academy: [],
    };
  }

  // 5. The summary and the phase.
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
        players,
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
 *   stream `${seed}-fixtures-${season}`, dates by the new year), `seasonStats` cleared, `lastRound`
 *   removed and `lastSheets` kept;
 * - every player with condition 100, no injury, suspension, yellow card nor bench streak, no form
 *   ("sem jogos") and the morale half of the way to `fans.start` (MORALE_OFFSEASON_PULL), rounded
 *   to hundredths ({@link moraleAtTurn}); age,
 *   overall and attributes already moved in `endSeason`; everything else kept (the idol too);
 * - every club with the thermometer at `fans.start`, `idolBenchStreak` 0 and the strength of its
 *   evolved squad ({@link squadStrength}); profile and formations kept.
 * Nothing else is drawn: the same state always gives the same new season (US-025).
 *
 * `identities` names the players a turn creates; in 1a it creates none. `opts.incoming` (clubs
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

  const players: Record<PlayerId, Player> = {};
  for (const [id, player] of Object.entries(state.players)) {
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

  // `lastRound` is left out, not set to undefined: the state stays JSON-exact.
  const rest: Omit<GameState, 'lastRound'> & { lastRound?: GameState['lastRound'] } = {
    ...state,
  };
  delete rest.lastRound;
  return ok({
    ...rest,
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
