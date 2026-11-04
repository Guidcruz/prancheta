import { FORMATIONS, FORMATION_SLOTS } from '../formations.ts';
import type { MatchParams } from '../params.ts';
import { attributeOf, fit, type Player } from '../players.ts';
import {
  FORMATION_SECTORS,
  GOALKEEPER_SLOT,
  POSTURE_EFFECTS,
  PRESSURE_EFFECTS,
  conditionMultiplier,
  fillEmptyGoal,
  moraleMultiplier,
  strengthsFromRatings,
  type Sector,
  type StrengthTactic,
  type TeamStrengths,
} from '../strength.ts';
import type { EngineWarning, Formation, Position, Posture, Pressure, Side } from '../types.ts';
import type { TeamInput } from './types.ts';

/*
 * A team on the pitch during a match: who is in each slot, their energy and what they did. The
 * match loop (simulate.ts) reads and updates it minute by minute; the summary (summary.ts) turns
 * the appearances into ratings, minutes and markers.
 */

/** A player who took the pitch, and everything the summary needs from their match. */
export interface Appearance {
  readonly player: Player;
  readonly side: Side;
  /** Energy on the pitch, 0..100; starts at the player's condition. */
  energy: number;
  /** Attributes the match reads, through `attributeOf` ("Atributo ausente"). */
  readonly finishing: number;
  readonly passing: number;
  readonly physical: number;
  /** Regulation minutes on the pitch. */
  minutes: number;
  goals: number;
  assists: number;
  /** Saves made while in goal. */
  saves: number;
  /** Goals conceded while in goal or in a defence slot. */
  conceded: number;
  yellows: number;
  reds: number;
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
  /** Everyone who took the pitch, in order of entry (starters by slot first). */
  readonly appearances: Appearance[];
  /** `home(t)` of `T(t)`: 0 for the away side and on neutral ground. */
  home: number;
  /** Day form, in points, added to `Power` and `Defense` (drawn at kick-off). */
  dayForm: number;
  /** `halftimeBoost(t)` of `T(t)`: 0 in the first half. */
  halftimeBoost: number;
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
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(POSTURE_EFFECTS, value);
}

function isPressure(value: unknown): value is Pressure {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PRESSURE_EFFECTS, value);
}

function appearance(player: Player, side: Side): Appearance {
  return {
    player,
    side,
    energy: Math.min(100, Math.max(0, player.condition)),
    finishing: attributeOf(player, 'finishing'),
    passing: attributeOf(player, 'passing'),
    physical: attributeOf(player, 'physical'),
    minutes: 0,
    goals: 0,
    assists: 0,
    saves: 0,
    conceded: 0,
    yellows: 0,
    reds: 0,
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
 * match through a bug or a damaged save; replacing injured or suspended starters is T-010):
 * - unknown formation → `4-4-2`; unknown posture → `balanced`; unknown pressure → `medium`;
 * - a starter who is not in the squad, a repeated starter or a missing one → empty slot;
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
      const app = appearance(player, side);
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
    appearances,
    home: 0,
    dayForm: 0,
    halftimeBoost: 0,
    goals: 0,
    shots: 0,
    onTarget: 0,
  };
}

/**
 * Strengths of the team now (partida.md, "Forças de setor"): the effective rating of each
 * occupied slot with the current energy, the formation, the tactic and `T(t)` (home advantage,
 * empty slots, half-time talk). The day form is not in here: it is added to `Power` and
 * `Defense` where they are compared.
 */
export function currentStrengths(
  team: TeamState,
  match: Pick<MatchParams, 'midWeight' | 'missingPlayerPenalty'>,
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
    { home: team.home, halftimeBoost: team.halftimeBoost },
    match,
  );
}
