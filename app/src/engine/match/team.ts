import { AI_PROFILES } from '../clubs.ts';
import { FORMATIONS, FORMATION_SLOTS } from '../formations.ts';
import { BENCH_SIZE } from '../lineup.ts';
import { clamp } from '../math.ts';
import type { MatchParams } from '../params.ts';
import { attributeOf, fit, type Player } from '../players.ts';
import { correctedCondition, kickoffBench, replaceUnavailable, winsTie } from '../selection.ts';
import {
  FORMATION_SECTORS,
  GOALKEEPER_SLOT,
  POSTURES,
  PRESSURE_EFFECTS,
  conditionMultiplier,
  fillEmptyGoal,
  moraleMultiplier,
  strengthsFromRatings,
  type Sector,
  type StrengthTactic,
  type TeamStrengths,
} from '../strength.ts';
import type {
  AiProfile,
  EngineWarning,
  Formation,
  Position,
  Posture,
  Pressure,
  Side,
} from '../types.ts';
import { FREE_KICK_GOAL_MULT, SUSPENSION, goalProbability, penaltyProbability } from './rules.ts';
import type { HalftimeChoice, TeamInput } from './types.ts';

/*
 * A team on the pitch during a match: who is in each slot, their energy and what they did. The
 * match loop (simulate.ts) reads and updates it minute by minute; the summary (summary.ts) turns
 * the appearances into ratings, minutes and markers.
 */

/** A player who took the pitch, and everything the summary needs from their match. */
export interface Appearance {
  readonly player: Player;
  readonly side: Side;
  /** Took the pitch at kick-off (a starter); false for a substitute (rule 2 never takes him off). */
  readonly starter: boolean;
  /** Energy on the pitch, 0..100; starts at the player's condition. */
  energy: number;
  /** Attributes the match reads, through `attributeOf` ("Atributo ausente"). */
  readonly finishing: number;
  readonly passing: number;
  readonly technique: number;
  readonly physical: number;
  /** Accumulated yellows before the match (`Player.yellowCount`, corrected to 0..2). */
  readonly yellowCount: number;
  /** Regulation minutes on the pitch. */
  minutes: number;
  goals: number;
  assists: number;
  /** Saves made while in goal. */
  saves: number;
  /** Goals conceded while in goal or in a defence slot. */
  conceded: number;
  /** Yellows of this match: 0 or 1 (a second yellow is a red with reason `secondYellow`). */
  yellows: number;
  reds: number;
  /** Why he was sent off, when he was. */
  redReason?: 'direct' | 'secondYellow';
  /** False once he left the pitch (red card, injury or substitution); he never comes back. */
  onPitch: boolean;
}

/** One of the 11 slots of the formation; `app` is undefined when the slot is empty. */
export interface Slot {
  readonly position: Position;
  readonly sector: Sector;
  app: Appearance | undefined;
  /**
   * `overall × fit(natural, slot) × moraleMult` of the occupant (0 when empty): the part of the
   * effective rating that does not change during the match. Times `condMult(energy)` it is
   * `effectiveRating` bit for bit (same operations, same order). Set it with {@link occupy}.
   */
  ratingBase: number;
}

export interface TeamState {
  readonly side: Side;
  readonly input: TeamInput;
  formation: Formation;
  tactic: StrengthTactic;
  readonly slots: Slot[];
  /** Scratch list of the 11 effective ratings, reused every minute. */
  readonly ratings: (number | undefined)[];
  /** Scratch list of who is in each slot when the cards and injuries step begins. */
  readonly order: (Appearance | undefined)[];
  /** Everyone who took the pitch, in order of entry (starters by slot first). */
  readonly appearances: Appearance[];
  /**
   * Reserves who can still come on, in the order of the sheet: the first {@link BENCH_SIZE} of
   * `lineup.bench` that are in the squad, available and not starters, without the one who took an
   * unavailable starter's slot at kick-off (he is already on the pitch) and without anyone who
   * already came on.
   */
  readonly bench: Player[];
  /** Substitutions made so far (at most `MAX_SUBS`). */
  subs: number;
  /** The AI already made rule 3's substitution (ia-clubes.md, "Durante o jogo"; once a match). */
  chased: boolean;
  /**
   * The profile the match plays by (the half-time talk without a choice; the in-match rules of
   * T-012): an unknown one plays as `traditional` (partida.md, "Casos de borda"), and so does the
   * coach's club, `controller: 'human'` (ia-clubes.md, "Clube do técnico humano").
   */
  readonly profile: AiProfile;
  /** Fans thermometer, 0..100 (corrected at kick-off). */
  readonly fans: number;
  /**
   * `home(t)`: 0 for the away side and on neutral ground. It enters `T(t)`, the shot of the
   * home side and the eff of its goalkeeper when he defends (partida.md, decision "a").
   */
  home: number;
  /** Day form, in points, added to `Power` and `Defense` (drawn at kick-off). */
  dayForm: number;
  /** `halftimeBoost(t)` of `T(t)`: 0 in the first half. */
  halftimeBoost: number;
  /** The half-time talk, once it was given (the second half of "Acalmar" has fewer yellows). */
  talk: HalftimeChoice | undefined;
  goals: number;
  shots: number;
  onTarget: number;
}

/** Strengths of a team with nobody at all on the pitch (never with a valid lineup). */
const NO_STRENGTH: TeamStrengths = {
  goalkeeper: 0,
  def: 0,
  mid: 0,
  atk: 0,
  power: 0,
  defense: 0,
  factor: 0,
};

function isFormation(value: unknown): value is Formation {
  return typeof value === 'string' && (FORMATIONS as readonly string[]).includes(value);
}

function isPosture(value: unknown): value is Posture {
  return typeof value === 'string' && (POSTURES as readonly string[]).includes(value);
}

function isPressure(value: unknown): value is Pressure {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PRESSURE_EFFECTS, value);
}

/** True for a finite number within [min, max]. */
function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && value >= min && value <= max;
}

function appearance(
  player: Player,
  side: Side,
  starter: boolean,
  warnings: EngineWarning[],
): Appearance {
  const energy = correctedCondition(player);
  if (!inRange(player.condition, 0, 100)) {
    warnings.push({
      code: 'player-invalid-condition',
      detail: { side, player: player.id, condition: String(player.condition) },
    });
  }
  let yellowCount = player.yellowCount;
  const maxCount = SUSPENSION.yellowLimit - 1;
  if (!(Number.isInteger(yellowCount) && inRange(yellowCount, 0, maxCount))) {
    warnings.push({
      code: 'player-invalid-yellow-count',
      detail: { side, player: player.id, yellowCount: String(yellowCount) },
    });
    yellowCount = clamp(Math.floor(yellowCount), 0, maxCount);
  }
  return {
    player,
    side,
    starter,
    energy,
    finishing: attributeOf(player, 'finishing'),
    passing: attributeOf(player, 'passing'),
    technique: attributeOf(player, 'technique'),
    physical: attributeOf(player, 'physical'),
    yellowCount,
    minutes: 0,
    goals: 0,
    assists: 0,
    saves: 0,
    conceded: 0,
    yellows: 0,
    reds: 0,
    onPitch: true,
  };
}

/** Puts `app` in `slot` (or empties it) and refreshes the cached part of its rating. */
export function occupy(slot: Slot, app: Appearance | undefined): void {
  slot.app = app;
  slot.ratingBase =
    app === undefined
      ? 0
      : app.player.overall *
        fit(app.player.position, slot.position) *
        moraleMultiplier(app.player.morale);
}

/**
 * The team at kick-off, from its sheet. Never throws: a sheet that cannot be played as given is
 * played as well as possible, with a warning for each fix (an invalid sheet only reaches the
 * match through a bug or a damaged save):
 * - unknown formation → `4-4-2`; unknown posture → `balanced`; unknown pressure → `medium`;
 *   unknown profile → `traditional` (one warning per side for each);
 * - `controller: 'human'` → the profile is read as `traditional`, without a warning;
 * - fans or a player's condition that is NaN or outside 0..100 → clipped (NaN to 0);
 * - a starter who is not in the squad, a repeated starter or a missing one → empty slot;
 * - an injured or suspended starter → the best available bench player for his slot
 *   (`bestForSlot`: the highest selection value, ties by higher overall, then younger, then
 *   lower ID; ia-clubes.md, "Escalação"), in slot order; without one, an empty slot;
 * - a player's `yellowCount` outside 0..2 or not an integer → clipped;
 * - an empty goalkeeper slot → the outfield player with the highest `physical` goes in goal
 *   (`fillEmptyGoal`) and his slot is the empty one.
 */
export function kickoffTeam(side: Side, input: TeamInput, warnings: EngineWarning[]): TeamState {
  const { lineup, tactic } = input.sheet;
  let formation: Formation = lineup.formation;
  if (!isFormation(formation)) {
    warnings.push({
      code: 'lineup-unknown-formation',
      detail: { side, formation: String(formation) },
    });
    formation = FORMATIONS[0]!;
  }
  let posture: Posture = tactic.posture;
  if (!isPosture(posture)) {
    warnings.push({ code: 'tactic-unknown-posture', detail: { side, posture: String(posture) } });
    posture = 'balanced';
  }
  let pressure: Pressure = tactic.pressure;
  if (!isPressure(pressure)) {
    warnings.push({
      code: 'tactic-unknown-pressure',
      detail: { side, pressure: String(pressure) },
    });
    pressure = 'medium';
  }

  let profile: AiProfile = input.profile;
  if (!AI_PROFILES.includes(profile)) {
    warnings.push({ code: 'team-unknown-profile', detail: { side, profile: String(profile) } });
    profile = 'traditional';
  }
  // The coach's club: the AI decides for him as `traditional` (ia-clubes.md, "Clube do técnico
  // humano"), whatever the club's profile; no warning, it is the rule.
  if (input.controller === 'human') profile = 'traditional';
  let fans = input.fans;
  if (!inRange(fans, 0, 100)) {
    warnings.push({ code: 'team-invalid-fans', detail: { side, fans: String(fans) } });
    fans = clamp(fans, 0, 100);
  }

  const positions = FORMATION_SLOTS[formation];
  const sectors = FORMATION_SECTORS[formation];
  const byId = new Map<string, Player>();
  for (const player of input.players) byId.set(player.id, player);
  if (lineup.starters.length !== positions.length) {
    warnings.push({ code: 'lineup-wrong-count', detail: { side, count: lineup.starters.length } });
  }
  const used = new Set<string>();
  const occupants: (Player | undefined)[] = positions.map((_, i) => {
    const id = lineup.starters[i];
    if (id === undefined) return undefined;
    if (used.has(id)) {
      warnings.push({ code: 'lineup-duplicate-player', detail: { side, player: id } });
      return undefined;
    }
    const player = byId.get(id);
    if (player === undefined) {
      warnings.push({ code: 'lineup-unknown-player', detail: { side, player: id } });
      return undefined;
    }
    used.add(id);
    return player;
  });
  // Injured or suspended starters: the best available reserve takes the slot. The bench is the
  // first BENCH_SIZE of the sheet (partida.md, "Substituições"); the rest is never used.
  if (lineup.bench.length > BENCH_SIZE) {
    warnings.push({ code: 'lineup-bench-too-long', detail: { side, count: lineup.bench.length } });
  }
  const bench = kickoffBench(lineup.bench, byId, used);
  replaceUnavailable(occupants, positions, bench, (player, reserve) => {
    warnings.push({
      code: 'lineup-unavailable-player',
      detail: {
        side,
        player: player.id,
        ...(reserve === undefined ? {} : { replacement: reserve.id }),
      },
    });
  });
  const filled = fillEmptyGoal(occupants);
  if (filled.vacated !== undefined) {
    const keeper = filled.slots[GOALKEEPER_SLOT]!;
    warnings.push({ code: 'goalkeeper-from-outfield', detail: { side, player: keeper.id } });
  }

  const appearances: Appearance[] = [];
  const slots: Slot[] = positions.map((position, i) => {
    const slot: Slot = { position, sector: sectors[i]!, app: undefined, ratingBase: 0 };
    const player = filled.slots[i];
    if (player !== undefined) {
      const app = appearance(player, side, true, warnings);
      appearances.push(app);
      occupy(slot, app);
    }
    return slot;
  });
  return {
    side,
    input,
    formation,
    tactic: { posture, pressure },
    slots,
    ratings: new Array<number | undefined>(slots.length).fill(undefined),
    order: new Array<Appearance | undefined>(slots.length).fill(undefined),
    appearances,
    bench,
    subs: 0,
    chased: false,
    profile,
    fans,
    home: 0,
    dayForm: 0,
    halftimeBoost: 0,
    talk: undefined,
    goals: 0,
    shots: 0,
    onTarget: 0,
  };
}

/**
 * `eff` of `player` in a slot of `position` with `energy` (partida.md, "Nota efetiva"), with the
 * same operations as {@link occupy} and {@link currentStrengths}, so a player in a slot gets
 * the same number bit for bit.
 */
export function slotEff(player: Player, position: Position, energy: number): number {
  return (
    player.overall *
    fit(player.position, position) *
    moraleMultiplier(player.morale) *
    conditionMultiplier(energy)
  );
}

/** `eff` of the player in slot `index` now (0 for an empty slot). */
export function currentEff(team: TeamState, index: number): number {
  const slot = team.slots[index]!;
  return slot.app === undefined ? 0 : slot.ratingBase * conditionMultiplier(slot.app.energy);
}

/**
 * A substitution (partida.md, "Substituições"): the player in slot `index` leaves for good, and
 * `reserve` (one of `team.bench`) takes **his** slot with his own condition. Counts one
 * substitution. The caller checks the limit and that `reserve` is on the bench.
 */
export function substitute(
  team: TeamState,
  index: number,
  reserve: Player,
  warnings: EngineWarning[],
): void {
  const slot = team.slots[index]!;
  if (slot.app !== undefined) slot.app.onPitch = false;
  const app = appearance(reserve, team.side, false, warnings);
  team.appearances.push(app);
  occupy(slot, app);
  team.bench.splice(team.bench.indexOf(reserve), 1);
  team.subs += 1;
}

/**
 * Formation change during the match (partida.md, "Troca de formação durante o jogo"):
 * 1. in the slot order of the current formation, each player on the pitch takes the first free
 *    slot of the new one with the **same position** as the slot he is in (so whoever is in goal
 *    stays there, even an outfield player);
 * 2. in the slot order of the new formation, each slot still free gets, among those left over,
 *    the one with the highest `eff` there (energy and morale of the moment); ties by higher
 *    overall, then younger, then lower ID (`winsTie`);
 * 3. with N on the pitch, exactly 11 − N slots stay empty: the last free ones of step 2.
 * The same formation is not a change: nothing moves. Returns whether the formation changed.
 */
export function changeFormation(team: TeamState, formation: Formation): boolean {
  if (formation === team.formation) return false;
  const positions = FORMATION_SLOTS[formation];
  const sectors = FORMATION_SECTORS[formation];
  const placed: (Appearance | undefined)[] = new Array<Appearance | undefined>(
    positions.length,
  ).fill(undefined);
  const leftover: Appearance[] = [];
  for (const slot of team.slots) {
    const app = slot.app;
    if (app === undefined) continue;
    let target = -1;
    for (let j = 0; j < positions.length; j++) {
      if (placed[j] === undefined && positions[j] === slot.position) {
        target = j;
        break;
      }
    }
    if (target >= 0) placed[target] = app;
    else leftover.push(app);
  }
  for (let j = 0; j < positions.length && leftover.length > 0; j++) {
    if (placed[j] !== undefined) continue;
    let best = 0;
    let bestValue = slotEff(leftover[0]!.player, positions[j]!, leftover[0]!.energy);
    for (let k = 1; k < leftover.length; k++) {
      const app = leftover[k]!;
      const value = slotEff(app.player, positions[j]!, app.energy);
      if (
        value > bestValue ||
        (value === bestValue && winsTie(app.player, k, leftover[best]!.player, best))
      ) {
        best = k;
        bestValue = value;
      }
    }
    placed[j] = leftover[best];
    leftover.splice(best, 1);
  }
  team.formation = formation;
  for (let j = 0; j < positions.length; j++) {
    const slot: Slot = {
      position: positions[j]!,
      sector: sectors[j]!,
      app: undefined,
      ratingBase: 0,
    };
    occupy(slot, placed[j]);
    team.slots[j] = slot;
  }
  return true;
}

/**
 * Strengths of the team now (partida.md, "Forças de setor"): the effective rating of each
 * occupied slot with the current energy, the formation, the tactic and `T(t)` (home advantage,
 * empty slots, half-time talk). The day form is not in here: it is added to `Power` and
 * `Defense` where they are compared. `home` replaces `home(t)` (the possession uses 0).
 */
export function currentStrengths(
  team: TeamState,
  match: Pick<MatchParams, 'midWeight' | 'missingPlayerPenalty' | 'allOutPower' | 'allOutDef'>,
  home: number = team.home,
): TeamStrengths {
  if (team.slots[GOALKEEPER_SLOT]!.app === undefined) return NO_STRENGTH;
  const { slots, ratings } = team;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!;
    ratings[i] =
      slot.app === undefined ? undefined : slot.ratingBase * conditionMultiplier(slot.app.energy);
  }
  return strengthsFromRatings(
    team.formation,
    team.tactic,
    ratings,
    { home, halftimeBoost: team.halftimeBoost },
    match,
  );
}

/**
 * `pGoal` of an open-play chance shot by the player in `slot` of `team` against the goalkeeper of
 * `opponent` (partida.md, "Chance de oportunidade e finalização" and "Mando na finalização"):
 * - `shot = finishing × fit × moraleMult × condMult × (1 + home(team))`;
 * - `gkEff = eff of the opponent's goalkeeper × (1 + home(opponent))`, where the eff is
 *   `TeamStrengths.goalkeeper` (no `T(t)`: missing players and the half-time talk never reach the
 *   finish, only the home factor does).
 * The away side and both sides on neutral ground have `home = 0`, so the factor is 1.
 */
export function openPlayGoalProbability(
  team: TeamState,
  slot: Slot,
  opponent: TeamState,
  theirs: Pick<TeamStrengths, 'goalkeeper'>,
  match: Pick<MatchParams, 'conversion' | 'kFinish'>,
): number {
  const shooter = slot.app!;
  const shot =
    shooter.finishing *
    fit(shooter.player.position, slot.position) *
    moraleMultiplier(shooter.player.morale) *
    conditionMultiplier(shooter.energy) *
    (1 + team.home);
  return goalProbability(shot, theirs.goalkeeper * (1 + opponent.home), match);
}

/** Players on the pitch now. */
export function playersOnPitch(team: TeamState): number {
  let count = 0;
  for (const slot of team.slots) if (slot.app !== undefined) count += 1;
  return count;
}

/**
 * Takes the player in slot `index` off the pitch for good without a substitute (red card, or an
 * injury with no substitution left): his slot stays empty ("Vaga vazia"). When it is the goal, the
 * outfield player with the highest `physical` goes in goal and **his** slot is the empty one
 * (partida.md, "Casos de borda": goalkeeper sent off or injured without a substitution).
 */
export function leavePitch(team: TeamState, index: number): void {
  const slot = team.slots[index]!;
  if (slot.app !== undefined) slot.app.onPitch = false;
  occupy(slot, undefined);
  if (index !== GOALKEEPER_SLOT) return;
  const filled = fillEmptyGoal(team.slots.map((s) => s.app?.player));
  if (filled.vacated === undefined) return;
  const from = team.slots[filled.vacated]!;
  const keeper = from.app;
  occupy(from, undefined);
  occupy(team.slots[GOALKEEPER_SLOT]!, keeper);
}

/**
 * Who takes a set piece (partida.md, "Capitão e cobradores"): the first of the coach's ordered
 * list who is on the pitch; with no list, or nobody of it on the pitch, the player on the pitch
 * with the highest `attribute` (`finishing` for penalties, `technique` for free kicks); ties keep
 * the first in slot order. Undefined only with nobody on the pitch.
 */
export function setPieceTaker(
  team: TeamState,
  list: readonly string[],
  attribute: 'finishing' | 'technique',
): number | undefined {
  for (const id of list) {
    const index = team.slots.findIndex((s) => s.app?.player.id === id);
    if (index >= 0) return index;
  }
  let best: number | undefined;
  let bestValue = -1;
  team.slots.forEach((slot, i) => {
    if (slot.app !== undefined && slot.app[attribute] > bestValue) {
      best = i;
      bestValue = slot.app[attribute];
    }
  });
  return best;
}

/**
 * The captain on the pitch now (partida.md, "Capitão e cobradores"): the first of the coach's
 * list who is on the pitch; otherwise the leader on the pitch (the one with the highest overall,
 * as in ia-clubes.md, "Escalação"), otherwise the oldest; ties keep the first in slot order.
 */
export function captainOnPitch(team: TeamState): Appearance | undefined {
  for (const id of team.input.sheet.lineup.captains) {
    const slot = team.slots.find((s) => s.app?.player.id === id);
    if (slot !== undefined) return slot.app;
  }
  let leader: Appearance | undefined;
  let oldest: Appearance | undefined;
  for (const { app } of team.slots) {
    if (app === undefined) continue;
    if (
      app.player.trait === 'leader' &&
      (leader === undefined || app.player.overall > leader.player.overall)
    ) {
      leader = app;
    }
    if (oldest === undefined || app.player.age > oldest.player.age) oldest = app;
  }
  return leader ?? oldest;
}

/**
 * `pGoal` of a penalty taken by the player in `slot` of `team` (partida.md, table "Tipo" and
 * "Mando na finalização"): `clamp(0.78 + 0.004 × (finishing × (1 + home(team)) − gkEff × (1 +
 * home(opponent))), 0.60, 0.92)`, with the taker's own `finishing` (no fit, morale nor energy:
 * the formula reads the attribute) and the eff of the opponent's goalkeeper.
 */
export function penaltyGoalProbability(
  team: TeamState,
  slot: Slot,
  opponent: TeamState,
  theirs: Pick<TeamStrengths, 'goalkeeper'>,
): number {
  const taker = slot.app!;
  return penaltyProbability(
    taker.finishing * (1 + team.home),
    theirs.goalkeeper * (1 + opponent.home),
  );
}

/**
 * `pGoal` of a direct free kick taken by the player in `slot` (partida.md, table "Tipo"): the
 * open-play `pGoal` with `technique` in place of `finishing`, home factor included and clamped,
 * then `× 0.45`.
 */
export function freeKickGoalProbability(
  team: TeamState,
  slot: Slot,
  opponent: TeamState,
  theirs: Pick<TeamStrengths, 'goalkeeper'>,
  match: Pick<MatchParams, 'conversion' | 'kFinish'>,
): number {
  const taker = slot.app!;
  const shot =
    taker.technique *
    fit(taker.player.position, slot.position) *
    moraleMultiplier(taker.player.morale) *
    conditionMultiplier(taker.energy) *
    (1 + team.home);
  return (
    goalProbability(shot, theirs.goalkeeper * (1 + opponent.home), match) * FREE_KICK_GOAL_MULT
  );
}
