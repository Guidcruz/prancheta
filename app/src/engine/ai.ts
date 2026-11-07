import { AI_PROFILES } from './clubs.ts';
import { FORMATIONS, FORMATION_SLOTS, PROFILE_FORMATIONS, isFormation } from './formations.ts';
import type { ClubState, GameState } from './game.ts';
import { BENCH_SIZE, emptySheet, type Lineup, type Tactic, type TeamSheet } from './lineup.ts';
import { MARKERS } from './match/rules.ts';
import type { AiParams, GameParams } from './params.ts';
import { attributeOf, fit, type Player } from './players.ts';
import { Rng, seedFromString } from './rng.ts';
import { bestForSlot, correctedCondition, selectionValue, winsTie } from './selection.ts';
import {
  GOALKEEPER_SLOT,
  STARTERS_COUNT,
  effectiveRating,
  isAvailable,
  resolveStarters,
  shownEleven,
  type LineupProblem,
  type ShownState,
} from './strength.ts';
import type {
  AiProfile,
  ClubId,
  Formation,
  PlayerId,
  Position,
  Pressure,
  Result,
} from './types.ts';

/*
 * The AI before the match (docs/design/ia-clubes.md, "Perfis na 1a" and "Escalação"; T-011):
 * the lineup (greedy pick, rotation, bench, captain and takers), the tactic by profile (formation,
 * posture, pressure) and `validateLineup`. The in-match rules ("Durante o jogo") are T-012.
 *
 * Pure. Only the chaotic profile draws (formation, posture and pressure, ia-clubes.md), from its
 * own stream `${seed}-s${season}-r${round}-ai-${clubId}`, three draws in this order: formation
 * (`Rng.int(0, 5)` over FORMATIONS), posture (`Rng.next()` over CHAOTIC_POSTURE_WEIGHTS), pressure
 * (`Rng.next()` over CHAOTIC_PRESSURE_WEIGHTS). The pressure is drawn even when the tired-team
 * rule then makes it low, so the consumption is fixed. The other profiles never touch an Rng, and
 * neither does the coach's club (`controller: 'human'`), which plays as `traditional`.
 */

/**
 * Where the club plays the match it is preparing for: `neutral` when the state has no fixture
 * between the two clubs in the current round (or there is no opponent), so nobody gets the home
 * points.
 */
export type Venue = 'home' | 'away' | 'neutral';

/** Posture of the pre-match tactic (`allOut` is only a match command). */
export type PreMatchPosture = Tactic['posture'];

/**
 * Posture rule of each non-chaotic profile (ia-clubes.md, "Perfis na 1a"), with
 * `Δ = own strength + home points − opponent strength − opponent home points`:
 * attacking when `Δ ≥ attackingFrom`, defensive when `Δ ≤ defensiveUpTo` (only away when
 * `defensiveOnlyAway`), balanced otherwise. Rule constants, not /balance knobs.
 */
export const PROFILE_POSTURE: {
  readonly [P in Exclude<AiProfile, 'chaotic'>]: {
    readonly attackingFrom?: number;
    readonly defensiveUpTo: number;
    readonly defensiveOnlyAway?: boolean;
  };
} = {
  ambitious: { attackingFrom: -2, defensiveUpTo: -10 },
  academy: { attackingFrom: 0, defensiveUpTo: -8 },
  seller: { defensiveUpTo: -6 },
  traditional: { defensiveUpTo: -4, defensiveOnlyAway: true },
};

/**
 * Pressure of each non-chaotic profile at home and elsewhere (ia-clubes.md: the ambitious one
 * presses high at home, medium away). Neutral ground is not "em casa", so it takes `elsewhere`.
 */
export const PROFILE_PRESSURE: {
  readonly [P in Exclude<AiProfile, 'chaotic'>]: {
    readonly home: Pressure;
    readonly elsewhere: Pressure;
  };
} = {
  ambitious: { home: 'high', elsewhere: 'medium' },
  academy: { home: 'high', elsewhere: 'high' },
  seller: { home: 'medium', elsewhere: 'medium' },
  traditional: { home: 'medium', elsewhere: 'medium' },
};

/** The chaotic posture draw: attacking 50%, balanced 30%, defensive 20%, in this order. */
export const CHAOTIC_POSTURE_WEIGHTS: readonly (readonly [PreMatchPosture, number])[] = [
  ['attacking', 0.5],
  ['balanced', 0.3],
  ['defensive', 0.2],
];

/** The chaotic pressure draw: high 50%, medium 30%, low 20%, in this order. */
export const CHAOTIC_PRESSURE_WEIGHTS: readonly (readonly [Pressure, number])[] = [
  ['high', 0.5],
  ['medium', 0.3],
  ['low', 0.2],
];

/**
 * Line of each natural position for the bench rule ("pelo menos 1 de defesa, 1 de meio e 1 de
 * ataque"): CB and FB defend, DM and AM are midfield, ST attacks.
 */
export const BENCH_LINES: { readonly [P in Position]: 'gk' | 'def' | 'mid' | 'atk' } = {
  GK: 'gk',
  CB: 'def',
  FB: 'def',
  DM: 'mid',
  AM: 'mid',
  ST: 'atk',
};

/** Profile as the AI reads it: an unknown one (damaged save, bug) plays as `traditional`. */
function knownProfile(profile: AiProfile): AiProfile {
  return AI_PROFILES.includes(profile) ? profile : 'traditional';
}

/** The club's preferred formations that are known; none left → the traditional pair. */
function preferredFormations(club: ClubState): readonly Formation[] {
  const known = (club.preferredFormations ?? []).filter(isFormation);
  return known.length > 0 ? known : PROFILE_FORMATIONS.traditional;
}

/** Available players of a club (neither injured nor suspended), in squad order. */
function availablePlayers(state: Pick<GameState, 'players' | 'squads'>, clubId: ClubId): Player[] {
  const players: Player[] = [];
  for (const id of state.squads[clubId] ?? []) {
    const player = state.players[id];
    if (player !== undefined && isAvailable(player)) players.push(player);
  }
  return players;
}

/**
 * The XI of a formation (ia-clubes.md, "Escalação", steps 3 and 4):
 * 1. slot by slot in formation order (GOL, ZAG, LAT, VOL, MEI, ATA), the available player not yet
 *    chosen with the highest selection value (ties: higher overall, younger, lower ID); a slot
 *    with no natural player takes the best of any position, with the fit. **Without an available
 *    goalkeeper** the goal is filled last: first the 10 outfield slots, then the goal takes the
 *    best for goal (`fit` 0.40) of those left, so the best outfield player is not sent to goal;
 * 2. rotation, in slot order: a starter with condition below `ai.rotationCondition` gives way to
 *    the best player left for his slot **among those with condition of at least
 *    `ai.rotationCondition`**, when that one's selection value is at least `ai.rotationMinRatio`
 *    of his. A rested player is not picked again for another slot (he may go to the bench).
 * With fewer than 11 available the last slots stay empty (`partida.md`, "Casos de borda"); without
 * a goalkeeper the goal still gets one of them (the last left), so the goal is never the empty
 * slot and `starters` stays in slot order.
 */
export function pickEleven(
  available: readonly Player[],
  formation: Formation,
  ai: Pick<AiParams, 'rotationCondition' | 'rotationMinRatio'>,
): { starters: Player[]; rested: Player[] } {
  const slots = FORMATION_SLOTS[formation];
  const chosen = new Set<PlayerId>();
  const placed: (Player | undefined)[] = slots.map(() => undefined);
  const take = (index: number): boolean => {
    const best = bestForSlot(available, slots[index]!, (p) => chosen.has(p.id));
    if (best === undefined) return false;
    chosen.add(best.id);
    placed[index] = best;
    return true;
  };
  if (available.some((p) => p.position === 'GK')) {
    for (let i = 0; i < slots.length; i++) if (!take(i)) break;
  } else {
    // Goal last; with 10 or fewer available, one is kept for the goal.
    const outfield = Math.min(slots.length - 1, available.length - 1);
    for (let i = 0; i < outfield; i++) take(i + 1);
    take(GOALKEEPER_SLOT);
  }
  const starters: Player[] = [];
  for (const player of placed) {
    if (player === undefined) break;
    starters.push(player);
  }

  const rested: Player[] = [];
  const restedIds = new Set<PlayerId>();
  for (let i = 0; i < starters.length; i++) {
    const starter = starters[i]!;
    if (!(correctedCondition(starter) < ai.rotationCondition)) continue;
    const slot = slots[i]!;
    const reserve = bestForSlot(
      available,
      slot,
      (p) =>
        chosen.has(p.id) || restedIds.has(p.id) || correctedCondition(p) < ai.rotationCondition,
    );
    if (reserve === undefined) continue;
    if (selectionValue(reserve, slot) < ai.rotationMinRatio * selectionValue(starter, slot)) {
      continue;
    }
    chosen.delete(starter.id);
    chosen.add(reserve.id);
    restedIds.add(starter.id);
    rested.push(starter);
    starters[i] = reserve;
  }
  return { starters, rested };
}

/** Sum of the effective ratings of the XI in its slots (the formation choice compares it). */
function effSum(starters: readonly Player[], formation: Formation): number {
  const slots = FORMATION_SLOTS[formation];
  let sum = 0;
  for (let i = 0; i < starters.length; i++) sum += effectiveRating(starters[i]!, slots[i]!);
  return sum;
}

/** Players ranked by overall, then younger, then lower ID (stable on full ties). */
export function byOverall(players: readonly Player[]): Player[] {
  return players
    .map((player, index) => ({ player, index }))
    .sort((a, b) =>
      winsTie(a.player, a.index, b.player, b.index)
        ? -1
        : winsTie(b.player, b.index, a.player, a.index)
          ? 1
          : a.index - b.index,
    )
    .map(({ player }) => player);
}

/**
 * The bench (ia-clubes.md, "Escalação", step 5): 1 goalkeeper and 6 outfield players.
 * - The goalkeeper of highest overall among those left. A second goalkeeper only comes in when
 *   there are not enough outfield players to fill the bench.
 * - The outfield players: first the best (overall) of each line not yet on the bench (BENCH_LINES:
 *   defence, midfield, attack), then the best of the rest.
 * - Order: the goalkeeper, then by overall (ties: younger, lower ID). No goalkeeper left → 7
 *   outfield players; fewer than 7 left → all of them.
 */
export function pickBench(rest: readonly Player[]): Player[] {
  const ranked = byOverall(rest);
  const taken = new Set<PlayerId>();
  const goalkeeper = ranked.find((p) => p.position === 'GK');
  if (goalkeeper !== undefined) taken.add(goalkeeper.id);
  const outfield = ranked.filter((p) => p.position !== 'GK');
  for (const line of ['def', 'mid', 'atk'] as const) {
    if (taken.size >= BENCH_SIZE) break;
    const best = outfield.find((p) => !taken.has(p.id) && BENCH_LINES[p.position] === line);
    if (best !== undefined) taken.add(best.id);
  }
  // Outfield players first; the other goalkeepers only when they run out.
  for (const player of [...outfield, ...ranked.filter((p) => p.position === 'GK')]) {
    if (taken.size >= BENCH_SIZE) break;
    taken.add(player.id);
  }
  const others = ranked.filter((p) => p !== goalkeeper && taken.has(p.id));
  return goalkeeper === undefined ? others : [goalkeeper, ...others];
}

/**
 * Captain and takers among the starters (ia-clubes.md, "Escalação", step 6; partida.md, "Capitão
 * e cobradores", for the ties): captain = the leader of highest overall, else the oldest; penalty
 * = highest `finishing`; free kick = highest `technique` (attributes through `attributeOf`). Ties
 * keep the first in slot order. Each list has one player (none without starters): when he leaves
 * the pitch the match applies the same rule to who is there.
 */
export function pickCaptainAndTakers(
  starters: readonly Player[],
): Pick<Lineup, 'captains' | 'penaltyTakers' | 'freeKickTakers'> {
  let leader: Player | undefined;
  let oldest: Player | undefined;
  let penalty: Player | undefined;
  let freeKick: Player | undefined;
  for (const player of starters) {
    if (player.trait === 'leader' && (leader === undefined || player.overall > leader.overall)) {
      leader = player;
    }
    if (oldest === undefined || player.age > oldest.age) oldest = player;
    if (
      penalty === undefined ||
      attributeOf(player, 'finishing') > attributeOf(penalty, 'finishing')
    ) {
      penalty = player;
    }
    if (
      freeKick === undefined ||
      attributeOf(player, 'technique') > attributeOf(freeKick, 'technique')
    ) {
      freeKick = player;
    }
  }
  const captain = leader ?? oldest;
  return {
    captains: captain === undefined ? [] : [captain.id],
    penaltyTakers: penalty === undefined ? [] : [penalty.id],
    freeKickTakers: freeKick === undefined ? [] : [freeKick.id],
  };
}

/**
 * "Força" of a set of starters in their slots for `Δ` (balance-targets.md; ia-clubes.md, "Força
 * no Δ"): `overall × fit` summed over the occupied slots and **divided by 11**, so an empty slot
 * counts as 0 and a team with fewer than 11 sees itself (and is seen) weaker. With 11 starters it
 * is the displayed strength, `teamStrength`, to the bit.
 */
function shownStrength(
  eleven: readonly { player: Pick<Player, 'position' | 'overall'>; slot: Position }[],
): number {
  let sum = 0;
  for (const { player, slot } of eleven) sum += player.overall * fit(player.position, slot);
  return sum / STARTERS_COUNT;
}

/**
 * The opponent's strength for `Δ`: his displayed strength without a lineup, from the same XI that
 * `teamStrength` reads (`shownEleven`: his last sheet, `lastSheets`, or before round 1 the best
 * fresh XI of his available players), with an empty slot as 0. Undefined for an unknown club.
 */
function opponentStrength(state: ShownState, opponentId: ClubId): number | undefined {
  const eleven = shownEleven(state, opponentId);
  return eleven === undefined ? undefined : shownStrength(eleven);
}

/**
 * The match the club prepares for: the fixture of the current round between the two clubs (or,
 * without `opponentId`, the club's fixture of the current round). Neutral when there is none.
 */
function nextMatch(
  state: Pick<GameState, 'fixtures' | 'round'>,
  clubId: ClubId,
  opponentId: ClubId | undefined,
): { opponentId: ClubId | undefined; venue: Venue } {
  for (const f of state.fixtures ?? []) {
    if (f.round !== state.round) continue;
    if (f.homeId === clubId && (opponentId === undefined || f.awayId === opponentId)) {
      return { opponentId: f.awayId, venue: 'home' };
    }
    if (f.awayId === clubId && (opponentId === undefined || f.homeId === opponentId)) {
      return { opponentId: f.homeId, venue: 'away' };
    }
  }
  return { opponentId, venue: 'neutral' };
}

/** `Δ = own + home points − opponent − opponent's home points` (ia-clubes.md, MARKERS.homePoints). */
export function strengthDelta(own: number, opponent: number, venue: Venue): number {
  const home = venue === 'home' ? MARKERS.homePoints : 0;
  const away = venue === 'away' ? MARKERS.homePoints : 0;
  return own + home - opponent - away;
}

function drawWeighted<T>(rng: Rng, weights: readonly (readonly [T, number])[]): T {
  let u = rng.next();
  for (const [value, weight] of weights) {
    if (u < weight) return value;
    u -= weight;
  }
  return weights[weights.length - 1]![0];
}

/**
 * The pre-match tactic of a profile (ia-clubes.md, "Perfis na 1a"): posture from `Δ` and the
 * venue, pressure from the venue; the chaotic profile draws both from `rng` (posture first). Then
 * "cansaço manda na pressão": with the mean condition of the XI below `ai.tiredTeamCondition`,
 * the pressure is low in every profile. `meanCondition` undefined (no starters) skips that rule.
 * An unknown profile plays as `traditional`.
 *
 * The overloads make `rng` required whenever the profile may be chaotic, so the compiler refuses
 * a chaotic call without it. Never throws: a chaotic call that still arrives without `rng` (only
 * through a cast) plays as `traditional`.
 */
export function profileTactic(
  profile: Exclude<AiProfile, 'chaotic'>,
  delta: number,
  venue: Venue,
  meanCondition: number | undefined,
  ai: Pick<AiParams, 'tiredTeamCondition'>,
  rng?: Rng,
): Tactic;
export function profileTactic(
  profile: AiProfile,
  delta: number,
  venue: Venue,
  meanCondition: number | undefined,
  ai: Pick<AiParams, 'tiredTeamCondition'>,
  rng: Rng,
): Tactic;
export function profileTactic(
  profile: AiProfile,
  delta: number,
  venue: Venue,
  meanCondition: number | undefined,
  ai: Pick<AiParams, 'tiredTeamCondition'>,
  rng?: Rng,
): Tactic {
  let known = knownProfile(profile);
  if (known === 'chaotic' && rng === undefined) known = 'traditional';
  let posture: PreMatchPosture;
  let pressure: Pressure;
  if (known === 'chaotic' && rng !== undefined) {
    posture = drawWeighted(rng, CHAOTIC_POSTURE_WEIGHTS);
    pressure = drawWeighted(rng, CHAOTIC_PRESSURE_WEIGHTS);
  } else {
    const rule = PROFILE_POSTURE[known === 'chaotic' ? 'traditional' : known];
    const defensive = delta <= rule.defensiveUpTo && (!rule.defensiveOnlyAway || venue === 'away');
    if (rule.attackingFrom !== undefined && delta >= rule.attackingFrom) posture = 'attacking';
    else if (defensive) posture = 'defensive';
    else posture = 'balanced';
    const press = PROFILE_PRESSURE[known === 'chaotic' ? 'traditional' : known];
    pressure = venue === 'home' ? press.home : press.elsewhere;
  }
  if (meanCondition !== undefined && meanCondition < ai.tiredTeamCondition) pressure = 'low';
  return { posture, pressure };
}

/** Seed of the chaotic draws of a club before the match of the current round. */
export function aiSeed(
  state: Pick<GameState, 'seed' | 'season' | 'round'>,
  clubId: ClubId,
): number {
  return seedFromString(`${state.seed}-s${state.season}-r${state.round}-ai-${clubId}`);
}

/** Options of {@link suggestSheet}. */
export interface SuggestOptions {
  /**
   * `'human'` for the coach's club ("Sugerir escalação", a coach who did not pick a lineup, a
   * human who did not confirm online): the profile is read as `traditional`, whatever the club's
   * profile, and no Rng is created; the formation still comes from the club's two preferred ones
   * (ia-clubes.md, "Clube do técnico humano"). Default `'ai'`.
   */
  readonly controller?: 'ai' | 'human';
  /**
   * The formation of the sheet, for the coach's "Sugerir escalação" on the lineup screen
   * (decision 6 of the CEO in T-029; docs/02-architecture.md, 4.1): with `controller: 'human'`
   * and a known formation, the XI ({@link pickEleven}) and the bench ({@link pickBench}) are
   * picked in it, without choosing between the club's two preferred ones. Captain, takers and
   * tactic come out as without it. Ignored, without a warning, with `controller: 'ai'` or an
   * unknown value.
   */
  readonly formation?: Formation;
}

/** What `suggestSheet` reads from the state (`lastSheets` for the opponent's strength, T-013). */
export type SuggestState = Pick<
  GameState,
  'seed' | 'season' | 'round' | 'clubs' | 'players' | 'squads' | 'fixtures'
> &
  Partial<Pick<GameState, 'lastSheets'>>;

/**
 * The AI's team sheet for a club's next match (docs/02-architecture.md, 4.1; ia-clubes.md): also
 * the "Sugerir escalação" of the coach and the sheet of a human club that never confirmed one.
 *
 * - Formation: of the club's two preferred formations, the one whose XI (picked as
 *   {@link pickEleven} does) has the highest sum of `eff`; a tie keeps the first. The chaotic
 *   profile draws one of the six instead.
 * - Bench, captain and takers: {@link pickBench} and {@link pickCaptainAndTakers}.
 * - Tactic: {@link profileTactic} with `Δ` from the displayed strength of this XI and the
 *   opponent's (`teamStrength` without a lineup) and the venue of the fixture between them in the
 *   current round (home points: `MARKERS.homePoints`, as the `zebra` marker). Without an
 *   opponent (none given and no fixture this round) `Δ = 0` on neutral ground.
 *
 * - The coach's club (`options.controller = 'human'`) plays as `traditional` (SuggestOptions);
 *   with `options.formation` its XI and bench are picked in that formation.
 *
 * Never throws: fewer than 11 available players give a shorter `starters` (the match plays with
 * empty slots, partida.md), and an unknown club gets an empty sheet in the first formation,
 * balanced, medium. An unknown profile plays as `traditional` without a warning (the match warns,
 * once per side). The same state, club and options always give the same sheet.
 */
export function suggestSheet(
  state: SuggestState,
  params: Pick<GameParams, 'ai'>,
  clubId: ClubId,
  opponentId?: ClubId,
  options: SuggestOptions = {},
): TeamSheet {
  const club = state.clubs[clubId];
  if (club === undefined) return emptySheet();
  const profile: AiProfile =
    options.controller === 'human' ? 'traditional' : knownProfile(club.profile);
  const rng = profile === 'chaotic' ? new Rng(aiSeed(state, clubId)) : undefined;
  const available = availablePlayers(state, clubId);

  let formation: Formation;
  let starters: Player[];
  if (rng !== undefined) {
    formation = FORMATIONS[rng.int(0, FORMATIONS.length - 1)]!;
    starters = pickEleven(available, formation, params.ai).starters;
  } else if (options.controller === 'human' && isFormation(options.formation)) {
    formation = options.formation;
    starters = pickEleven(available, formation, params.ai).starters;
  } else {
    const preferred = preferredFormations(club);
    formation = preferred[0]!;
    starters = pickEleven(available, formation, params.ai).starters;
    let best = effSum(starters, formation);
    for (const other of preferred.slice(1)) {
      const xi = pickEleven(available, other, params.ai).starters;
      const sum = effSum(xi, other);
      if (sum > best) {
        formation = other;
        starters = xi;
        best = sum;
      }
    }
  }

  const inXi = new Set(starters.map((p) => p.id));
  const bench = pickBench(available.filter((p) => !inXi.has(p.id)));

  const match = nextMatch(state, clubId, opponentId);
  const slots = FORMATION_SLOTS[formation];
  const own = shownStrength(starters.map((player, i) => ({ player, slot: slots[i]! })));
  const opponent =
    match.opponentId === undefined ? undefined : opponentStrength(state, match.opponentId);
  const delta = opponent === undefined ? 0 : strengthDelta(own, opponent, match.venue);
  const venue = opponent === undefined ? 'neutral' : match.venue;
  let meanCondition: number | undefined;
  if (starters.length > 0) {
    let sum = 0;
    for (const p of starters) sum += correctedCondition(p);
    meanCondition = sum / starters.length;
  }
  const tactic =
    rng === undefined
      ? profileTactic(
          profile === 'chaotic' ? 'traditional' : profile,
          delta,
          venue,
          meanCondition,
          params.ai,
        )
      : profileTactic(profile, delta, venue, meanCondition, params.ai, rng);

  return {
    lineup: {
      formation,
      starters: starters.map((p) => p.id),
      bench: bench.map((p) => p.id),
      ...pickCaptainAndTakers(starters),
    },
    tactic,
  };
}

/** Why `validateLineup` refused a sheet: the problem and whether it is in the XI or the bench. */
export type SheetProblem = LineupProblem & { readonly part: 'starters' | 'bench' };

type ValidateBase = Result<
  TeamSheet,
  'wrong-club' | 'unavailable' | 'duplicate' | 'wrong-count' | 'no-formation'
>;
/** `Result` of {@link validateLineup}, with the `detail` typed. */
export type ValidateLineupResult =
  | Extract<ValidateBase, { ok: true }>
  | (Extract<ValidateBase, { ok: false }> & { detail: SheetProblem });

/**
 * Checks a team sheet of a club before it reaches the match (docs/02-architecture.md, 4.1;
 * ia-clubes.md, "Validação da ficha"): what the lineup screen and the online server accept. The
 * sheet is valid when the XI is valid and the bench has at most 7 available players of the club,
 * nobody repeated; the rest the match fixes by itself. Refuses with the first problem found, the
 * XI before the bench, saying the part (`starters` or `bench`):
 * 1. the XI, with the reasons and order of `sectorStrengths`: a known formation (`no-formation`),
 *    `min(11, available players of the squad)` starters (`wrong-count`: 11, or all the available
 *    ones when the squad has 1 to 10, as `suggestSheet` lines them up; with nobody available, 11,
 *    so no sheet is valid and an empty XI is `wrong-count`), then each starter in slot
 *    order: repeated (`duplicate`), not in the club's squad (`wrong-club`), injured or suspended
 *    (`unavailable`);
 * 2. the bench: at most BENCH_SIZE players (`wrong-count`), then each one in order: a starter or
 *    repeated (`duplicate`), not in the squad (`wrong-club`), injured or suspended (`unavailable`).
 *    A bench with fewer than 7, empty or without a goalkeeper is valid.
 *
 * **Does not check** the captain and taker lists (the match takes the first of each list who is
 * on the pitch, otherwise its own rule: partida.md, "Capitão e cobradores") nor the tactic (an
 * unknown posture or pressure becomes balanced or medium in the match, with a warning: "Valor
 * desconhecido na entrada"). An unknown club has an empty squad, so its first starter is
 * `wrong-club`. Returns the same sheet when valid.
 */
export function validateLineup(
  state: Pick<GameState, 'players' | 'squads'>,
  clubId: ClubId,
  sheet: TeamSheet,
): ValidateLineupResult {
  const squadIds = state.squads[clubId] ?? [];
  const squad = new Set(squadIds);
  const lookup = (id: PlayerId) => (squad.has(id) ? state.players[id] : undefined);
  let available = 0;
  for (const id of squad) {
    const player = state.players[id];
    if (player !== undefined && isAvailable(player)) available += 1;
  }
  // Fewer than 11 available: exactly all of them. None at all (an unknown club has an empty
  // squad): 11 still, so an unknown club's first starter is `wrong-club` and an empty XI of a
  // club with nobody available is `wrong-count` (the match ends that one as abandoned).
  const count = available === 0 ? STARTERS_COUNT : Math.min(STARTERS_COUNT, available);
  const resolved = resolveStarters(sheet.lineup, lookup, true, count);
  if ('reason' in resolved) {
    return { ok: false, error: resolved.reason, detail: { ...resolved, part: 'starters' } };
  }
  const refuse = (problem: LineupProblem): ValidateLineupResult => ({
    ok: false,
    error: problem.reason,
    detail: { ...problem, part: 'bench' },
  });
  const { bench } = sheet.lineup;
  if (bench.length > BENCH_SIZE) return refuse({ reason: 'wrong-count', count: bench.length });
  const seen = new Set<PlayerId>(sheet.lineup.starters);
  for (const id of bench) {
    if (seen.has(id)) return refuse({ reason: 'duplicate', player: id });
    seen.add(id);
    const player = lookup(id);
    if (player === undefined) return refuse({ reason: 'wrong-club', player: id });
    if (!isAvailable(player)) return refuse({ reason: 'unavailable', player: id });
  }
  return { ok: true, value: sheet, warnings: [] };
}
