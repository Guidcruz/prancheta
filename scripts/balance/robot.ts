import {
  FORMATIONS,
  FORMATION_SLOTS,
  GOALKEEPER_SLOT,
  HALF_MINUTES,
  IN_MATCH_AI,
  MAX_SUBS,
  attributeOf,
  bestForSlot,
  chanceProbability,
  correctedCondition,
  daysBetween,
  effectiveRating,
  energyDrain,
  // The engine's single entry point for e^x (ADR-0007, rule 9): the robot's expected points use
  // the same exponential as the engine, so a future swap of its implementation reaches both.
  exp,
  goalProbability,
  homeAdvantage,
  isUnavailable,
  naturalFirstEleven,
  pickBench,
  pickCaptainAndTakers,
  prepareRound,
  sectorStrengths,
  simulateMatch,
  strengthsFromRatings,
} from '../../app/src/engine/index.ts';
import type {
  ClubId,
  Formation,
  GameParams,
  GameState,
  HalftimeTalk,
  MatchCommand,
  MatchEvent,
  MatchInput,
  Player,
  PlayerId,
  Position,
  Posture,
  Pressure,
  RoundInput,
  Side,
  TeamSheet,
  TeamStrengths,
} from '../../app/src/engine/index.ts';

/*
 * The good robot coach of the /balance (balance-targets.md, decision 10): a stand-in for the human
 * who plays well, outside the engine, so the report can measure what the coach's decisions are
 * worth. It plays one club as a human coach in the "full" mode (`coaches: 'full'`, so the AI only
 * plays rule 1 for it and every other decision is a command), with the same information the
 * screens give: its own squad, the opponent's last sheet and the score as the match goes.
 *
 * - Sheet: for each of the six formations, the best XI by `eff` (overall × fit × morale ×
 *   condition), with a rotation in the congested weeks (a game 3 days or less before or after);
 *   then the formation, posture and pressure with the most expected points against the opponent
 *   of the round (a Poisson of the engine's chance and finishing formulas, with the energy each
 *   pressure costs over the match).
 * - Half time: the talk with the best effect for the score ("Cobrar" losing, unless two or more
 *   hotheads would lose morale; "Motivar" drawing; "Acalmar" winning).
 * - Second half: the in-match rules a good coach follows (ia-clubes.md, "Durante o jogo", as
 *   commands): the most tired starter off at 60, 70 and 80, attacking from 70 when losing (with
 *   a fresh forward once), "todo mundo no ataque" from 80 losing by 1, "segurar o resultado" from
 *   75 winning by 1, one substitution kept for an injury until 80. The match is simulated again
 *   with the commands so far before each decision, as the live screen does, so every decision
 *   sees only the minutes already played.
 * - Fans: the coach's decisions about the fans up to the cap (`fans.decisionCap`) every round.
 *
 * Pure and deterministic: the same state and params always give the same round input.
 */

/** Below this condition a starter is rested in a congested week, if a rested reserve is good. */
export const ROBOT_REST_CONDITION = 90;
/** The rested reserve must be worth at least this share of the starter's `eff` in the slot. */
export const ROBOT_REST_RATIO = 0.92;
/** A congested week: the club plays again (or played) at most this many days away. */
export const ROBOT_CONGESTED_DAYS = 3;
/** Hotheads on the pitch from which the robot prefers "Motivar" to "Cobrar" when losing. */
export const ROBOT_DEMAND_MAX_HOTHEADS = 1;
/** Goals considered in the Poisson of the expected points (more is negligible). */
const MAX_GOALS = 10;
/** Regulation minutes of a match. */
const MATCH_MINUTES = 2 * HALF_MINUTES;

const POSTURES: readonly Exclude<Posture, 'allOut'>[] = ['defensive', 'balanced', 'attacking'];
const PRESSURES: readonly Pressure[] = ['low', 'medium', 'high'];

const otherSide = (side: Side): Side => (side === 'home' ? 'away' : 'home');

function squadOf(state: GameState, clubId: ClubId): Player[] {
  const players: Player[] = [];
  for (const id of state.squads[clubId] ?? []) {
    const player = state.players[id];
    if (player !== undefined) players.push(player);
  }
  return players;
}

/** Mean energy of a player over the match at a pressure (half of the 90 minutes' drain). */
function meanEnergy(
  player: Player,
  pressure: Pressure,
  inGoal: boolean,
  params: GameParams,
): number {
  const drain = energyDrain(attributeOf(player, 'physical'), pressure, inGoal, params.match);
  return Math.max(0, correctedCondition(player) - (drain * MATCH_MINUTES) / 2);
}

/**
 * Expected points of a side with `own` strengths against `theirs`: goals of each side as a Poisson
 * of 90 minutes of `pChance × pGoal` (the attack's `atk` as the shot against the goalkeeper).
 */
export function expectedPoints(own: TeamStrengths, theirs: TeamStrengths, params: GameParams) {
  const rate = (a: TeamStrengths, d: TeamStrengths) =>
    MATCH_MINUTES *
    chanceProbability(a.power, d.defense, params.match) *
    goalProbability(a.atk, d.goalkeeper, params.match);
  const poisson = (lambda: number) => {
    const p: number[] = [exp(-lambda)];
    for (let k = 1; k <= MAX_GOALS; k++) p.push((p[k - 1]! * lambda) / k);
    return p;
  };
  const scored = poisson(rate(own, theirs));
  const conceded = poisson(rate(theirs, own));
  let win = 0;
  let draw = 0;
  for (let g = 0; g <= MAX_GOALS; g++) {
    for (let c = 0; c <= MAX_GOALS; c++) {
      const p = scored[g]! * conceded[c]!;
      if (g > c) win += p;
      else if (g === c) draw += p;
    }
  }
  return 3 * win + draw;
}

/**
 * The XI of `formation` by `eff` at the corrected condition, by the engine's "natural primeiro"
 * (`naturalFirstEleven`; ADR-0022, item 5): the same algorithm and tie-break as the AI, so the
 * "robô vence a IA" target measures the robot's decisions, not the lineup algorithm. In slot
 * order; fewer only if they run out.
 */
function elevenByEff(available: readonly Player[], formation: Formation): Player[] {
  const eleven: Player[] = [];
  for (const player of naturalFirstEleven(available, formation, (p, slot) =>
    effectiveRating(p, slot, correctedCondition(p)),
  )) {
    if (player === undefined) break;
    eleven.push(player);
  }
  return eleven;
}

/** Rests the tired starters of a congested week for rested reserves that keep the level. */
function rotate(eleven: Player[], available: readonly Player[], formation: Formation): Player[] {
  const slots = FORMATION_SLOTS[formation];
  const out = [...eleven];
  const used = new Set(out.map((p) => p.id));
  for (let i = 0; i < out.length; i++) {
    const starter = out[i]!;
    if (correctedCondition(starter) >= ROBOT_REST_CONDITION) continue;
    const slot = slots[i]!;
    const floor = ROBOT_REST_RATIO * effectiveRating(starter, slot, correctedCondition(starter));
    let best: Player | undefined;
    let bestEff = floor;
    for (const player of available) {
      if (used.has(player.id) || correctedCondition(player) < ROBOT_REST_CONDITION) continue;
      const eff = effectiveRating(player, slot, correctedCondition(player));
      if (eff >= bestEff) {
        best = player;
        bestEff = eff;
      }
    }
    if (best === undefined) continue;
    used.add(best.id);
    out[i] = best;
  }
  return out;
}

/** Whether the club plays within ROBOT_CONGESTED_DAYS of this round, before or after. */
export function congestedRound(state: GameState, clubId: ClubId): boolean {
  const dates = state.fixtures
    .filter((f) => f.homeId === clubId || f.awayId === clubId)
    .sort((a, b) => a.round - b.round);
  const index = dates.findIndex((f) => f.round === state.round);
  if (index < 0) return false;
  const near = (other: number) => {
    const fixture = dates[other];
    if (fixture === undefined) return false;
    const days = daysBetween(dates[index]!.date, fixture.date);
    return days !== undefined && Math.abs(days) <= ROBOT_CONGESTED_DAYS;
  };
  return near(index - 1) || near(index + 1);
}

/**
 * A sheet as the kick-off plays it (partida.md, "Valor desconhecido na entrada"): a posture that
 * is not a pre-match one (`allOut` from a damaged save, or anything else) is `balanced`.
 */
export function asKickoffSheet(sheet: TeamSheet): TeamSheet {
  const posture: unknown = sheet.tactic.posture;
  if ((POSTURES as readonly unknown[]).includes(posture)) return sheet;
  return { ...sheet, tactic: { ...sheet.tactic, posture: 'balanced' } };
}

/**
 * The opponent as the pre-match screen shows him: his last sheet, else the AI's sheet now, with
 * the posture the kick-off would play ({@link asKickoffSheet}).
 */
function opponentStrengths(
  state: GameState,
  params: GameParams,
  match: MatchInput,
  side: Side,
): TeamStrengths | undefined {
  const opponent = match[otherSide(side)];
  const home = otherSide(side) === 'home' && !match.neutral ? homeOf(match, params) : 0;
  for (const given of [state.lastSheets[opponent.clubId], opponent.sheet]) {
    if (given === undefined) continue;
    const sheet = asKickoffSheet(given);
    const energy: Record<PlayerId, number> = {};
    const slots = FORMATION_SLOTS[sheet.lineup.formation] ?? [];
    sheet.lineup.starters.forEach((id, i) => {
      const player = state.players[id];
      if (player !== undefined && slots[i] !== undefined) {
        energy[id] = meanEnergy(player, sheet.tactic.pressure, i === GOALKEEPER_SLOT, params);
      }
    });
    const result = sectorStrengths(opponent.players, sheet, { home, energy }, params);
    if (result.ok) return result.value;
  }
  return undefined;
}

function homeOf(match: MatchInput, params: GameParams): number {
  return homeAdvantage({ fans: match.home.fans, derby: match.derby }, params);
}

/**
 * The robot's sheet for its match of the round: the formation, XI and tactic with the most
 * expected points (see the header); the suggestion when no formation fills 11.
 */
export function robotSheet(
  state: GameState,
  params: GameParams,
  match: MatchInput,
  side: Side,
): TeamSheet {
  const own = match[side];
  const theirs = opponentStrengths(state, params, match, side);
  const available = squadOf(state, own.clubId).filter((p) => !isUnavailable(p));
  const congested = congestedRound(state, own.clubId);
  const home = side === 'home' && !match.neutral ? homeOf(match, params) : 0;
  let best: { sheet: TeamSheet; points: number } | undefined;
  for (const formation of FORMATIONS) {
    let eleven = elevenByEff(available, formation);
    if (eleven.length < 11) continue;
    if (congested) eleven = rotate(eleven, available, formation);
    const slots = FORMATION_SLOTS[formation];
    for (const pressure of PRESSURES) {
      const ratings = eleven.map((p, i) =>
        effectiveRating(p, slots[i]!, meanEnergy(p, pressure, i === GOALKEEPER_SLOT, params)),
      );
      for (const posture of POSTURES) {
        const tactic = { posture, pressure };
        const strengths = strengthsFromRatings(formation, tactic, ratings, { home }, params.match);
        const points = theirs === undefined ? 0 : expectedPoints(strengths, theirs, params);
        if (best === undefined || points > best.points) {
          const ids = new Set(eleven.map((p) => p.id));
          const bench = pickBench(available.filter((p) => !ids.has(p.id)));
          best = {
            points,
            sheet: {
              lineup: {
                formation,
                starters: eleven.map((p) => p.id),
                bench: bench.map((p) => p.id),
                ...pickCaptainAndTakers(eleven),
              },
              tactic,
            },
          };
        }
      }
    }
  }
  return best?.sheet ?? own.sheet;
}

/** The robot's side of the match at the end of a regulation minute of the second half. */
interface MatchView {
  readonly over: boolean;
  readonly own: number;
  readonly other: number;
  readonly posture: Posture;
  readonly pressure: Pressure;
  /** The occupant of each slot (undefined = empty), in formation order. */
  readonly slots: readonly (PlayerId | undefined)[];
  readonly energy: ReadonlyMap<PlayerId, number>;
  readonly bench: readonly Player[];
  readonly subs: number;
  readonly chaseSubDone: boolean;
}

/** Position of an event in the timeline of minutes played (1-based), with the first half's added time. */
function timeline(event: Pick<MatchEvent, 'minute' | 'added' | 'half'>, firstAdded: number) {
  return event.half === 1
    ? event.minute + (event.added ?? 0)
    : HALF_MINUTES + firstAdded + (event.minute - HALF_MINUTES) + (event.added ?? 0);
}

/**
 * What the robot sees after `minute` (a regulation minute of the second half): the events up to
 * it, the score, its tactic, who is in each slot, the energy (the engine's drain from the
 * condition, minute by minute with the pressure of the moment) and the bench left.
 */
function viewAt(
  input: MatchInput,
  side: Side,
  events: readonly MatchEvent[],
  minute: number,
  params: GameParams,
): MatchView {
  const team = input[side];
  const byId = new Map(team.players.map((p) => [p.id, p]));
  const slots: (PlayerId | undefined)[] = [...team.sheet.lineup.starters];
  const slotOf = new Map(slots.map((id, i) => [id!, i]));
  const enteredAt = new Map<PlayerId, number>();
  const used = new Set<PlayerId>(slots.filter((id): id is PlayerId => id !== undefined));
  const firstAdded = events.find((e) => e.type === 'stoppage' && e.half === 1);
  const added = firstAdded?.type === 'stoppage' ? firstAdded.minutes : 0;
  const end = timeline({ minute, half: 2 }, added);
  const pressureFrom: { at: number; pressure: Pressure }[] = [
    { at: 1, pressure: team.sheet.tactic.pressure },
  ];
  let posture: Posture = team.sheet.tactic.posture;
  let own = 0;
  let other = 0;
  let over = false;
  let subs = 0;
  let chaseSubDone = false;
  for (const e of events) {
    const at = timeline(e, added);
    if (e.half === 2 && at > end) break;
    if (e.type === 'fulltime') over = true;
    if (e.type === 'goal') {
      if (e.side === side) own += 1;
      else other += 1;
    }
    if (!('side' in e) || e.side !== side) continue;
    if (e.type === 'tacticChange') {
      posture = e.posture;
      pressureFrom.push({ at, pressure: e.pressure });
    } else if (e.type === 'substitution') {
      const index = slotOf.get(e.out);
      if (index !== undefined) {
        slots[index] = e.in;
        slotOf.set(e.in, index);
      }
      enteredAt.set(e.in, at);
      used.add(e.in);
      subs += 1;
      if (e.reason === 'tactical') chaseSubDone = true;
    } else if (e.type === 'red' || e.type === 'injury') {
      const index = slotOf.get(e.player);
      if (index !== undefined && slots[index] === e.player) slots[index] = undefined;
    }
  }
  const pressureAt = (t: number) => {
    let pressure = pressureFrom[0]!.pressure;
    for (const change of pressureFrom) if (change.at <= t) pressure = change.pressure;
    return pressure;
  };
  const energy = new Map<PlayerId, number>();
  slots.forEach((id, i) => {
    if (id === undefined) return;
    const player = byId.get(id);
    if (player === undefined) return;
    let value = correctedCondition(player);
    const physical = attributeOf(player, 'physical');
    for (let t = enteredAt.get(id) ?? 1; t <= end; t++) {
      value -= energyDrain(physical, pressureAt(t), i === GOALKEEPER_SLOT, params.match);
    }
    energy.set(id, Math.max(0, value));
  });
  const bench = team.sheet.lineup.bench
    .map((id) => byId.get(id))
    .filter((p): p is Player => p !== undefined && !used.has(p.id) && !isUnavailable(p));
  return {
    over,
    own,
    other,
    posture,
    pressure: pressureAt(end),
    slots,
    energy,
    bench,
    subs,
    chaseSubDone,
  };
}

/** The half-time talk for the score at the interval (see the header). */
export function robotTalk(own: number, other: number, hotheads: number): HalftimeTalk {
  if (own < other) return hotheads > ROBOT_DEMAND_MAX_HOTHEADS ? 'motivate' : 'demand';
  return own === other ? 'motivate' : 'calm';
}

/** The robot's decisions after `minute`, as commands for that minute (see the header). */
function decide(
  view: MatchView,
  input: MatchInput,
  side: Side,
  minute: number,
  params: GameParams,
): MatchCommand[] {
  const commands: MatchCommand[] = [];
  const team = input[side];
  const byId = new Map(team.players.map((p) => [p.id, p]));
  const positions: readonly Position[] = FORMATION_SLOTS[team.sheet.lineup.formation];
  const kept = minute < IN_MATCH_AI.keepSubUntil ? 1 : 0;
  const canSub = view.subs < MAX_SUBS - kept && view.bench.length > 0;
  const starters = new Set(team.sheet.lineup.starters);
  let subbed = false;

  if (canSub && (IN_MATCH_AI.fatigueMinutes as readonly number[]).includes(minute)) {
    const tired = view.slots
      .map((id, index) => ({ id, index }))
      .filter((s): s is { id: PlayerId; index: number } => s.id !== undefined && starters.has(s.id))
      .filter((s) => (view.energy.get(s.id) ?? 100) < params.ai.subEnergy)
      .sort((a, b) => view.energy.get(a.id)! - view.energy.get(b.id)! || a.index - b.index);
    for (const { id, index } of tired) {
      const starter = byId.get(id)!;
      const slot = positions[index]!;
      const reserve = bestForSlot(view.bench, slot);
      if (reserve === undefined) continue;
      const now = effectiveRating(starter, slot, view.energy.get(id)!);
      if (effectiveRating(reserve, slot) < params.ai.rotationMinRatio * now) continue;
      commands.push({ minute, side, kind: 'substitution', out: id, in: reserve.id });
      subbed = true;
      break;
    }
  }

  const margin = view.own - view.other;
  if (minute >= IN_MATCH_AI.allOutFrom && margin === -IN_MATCH_AI.oneGoal) {
    if (view.posture !== 'allOut')
      commands.push({ minute, side, kind: 'preset', preset: 'allOut' });
  } else if (minute >= IN_MATCH_AI.chaseFrom && margin < 0) {
    if (view.posture !== 'attacking' && view.posture !== 'allOut') {
      commands.push({ minute, side, kind: 'tactic', posture: 'attacking' });
    }
  } else if (minute >= IN_MATCH_AI.holdFrom && margin === IN_MATCH_AI.oneGoal) {
    if (view.posture !== 'defensive' || view.pressure !== 'low') {
      commands.push({ minute, side, kind: 'preset', preset: 'holdResult' });
    }
  }

  if (minute >= IN_MATCH_AI.chaseFrom && margin < 0 && canSub && !subbed && !view.chaseSubDone) {
    const forwards = view.bench.filter((p) => p.position === 'AM' || p.position === 'ST');
    let target: { id: PlayerId; index: number; eff: number } | undefined;
    for (let index = 0; index < view.slots.length; index++) {
      const id = view.slots[index];
      const slot = positions[index]!;
      if (id === undefined || (slot !== 'AM' && slot !== 'ST')) continue;
      const eff = effectiveRating(byId.get(id)!, slot, view.energy.get(id) ?? 100);
      if (target === undefined || eff < target.eff) target = { id, index, eff };
    }
    const reserve = target && bestForSlot(forwards, positions[target.index]!);
    if (target !== undefined && reserve !== undefined) {
      commands.push({ minute, side, kind: 'substitution', out: target.id, in: reserve.id });
    }
  }
  return commands;
}

/**
 * The robot's commands for its match (see the header): the half-time talk by the score, then the
 * decisions after each regulation minute of the second half, simulating again whenever it adds one.
 */
export function robotCommands(input: MatchInput, side: Side, params: GameParams): MatchCommand[] {
  const commands: MatchCommand[] = [];
  let result = simulateMatch(input, params, commands);
  const half = result.events.find((e) => e.type === 'halftime');
  if (half === undefined || half.type !== 'halftime') return commands;
  const own = side === 'home' ? half.score[0] : half.score[1];
  const other = side === 'home' ? half.score[1] : half.score[0];
  const atHalf = viewAt(input, side, result.events, HALF_MINUTES, params);
  const byId = new Map(input[side].players.map((p) => [p.id, p]));
  const hotheads = atHalf.slots.filter((id) => id && byId.get(id)?.trait === 'hothead').length;
  commands.push({
    minute: HALF_MINUTES,
    side,
    kind: 'halftimeTalk',
    talk: robotTalk(own, other, hotheads),
  });
  result = simulateMatch(input, params, commands);
  for (let minute = HALF_MINUTES + 1; minute <= MATCH_MINUTES; minute++) {
    const view = viewAt(input, side, result.events, minute, params);
    if (view.over) break;
    const decided = decide(view, input, side, minute, params);
    if (decided.length === 0) continue;
    commands.push(...decided);
    result = simulateMatch(input, params, commands);
  }
  return commands;
}

/**
 * The `playRound` input of a round with the robot coaching `clubId`: its sheet, its commands, the
 * "full" mode and the fans decisions up to the cap. Without a match of the club in the round (or
 * after round 38), the plain AI round.
 */
export function robotRoundInput(state: GameState, params: GameParams, clubId: ClubId): RoundInput {
  const plain: RoundInput = { round: state.round, sheets: {}, commands: {}, fanDecisions: {} };
  const fixture = state.fixtures.find(
    (f) => f.round === state.round && (f.homeId === clubId || f.awayId === clubId),
  );
  if (fixture === undefined) return plain;
  const coaches = { [clubId]: 'full' as const };
  const plan = prepareRound(state, params, { coaches });
  if (!plan.ok) return plain;
  const match = plan.value.matches.find((m) => m.fixtureId === fixture.id);
  if (match === undefined) return plain;
  const side: Side = fixture.homeId === clubId ? 'home' : 'away';
  const sheet = robotSheet(state, params, match, side);
  const input: MatchInput = { ...match, [side]: { ...match[side], sheet } };
  return {
    round: state.round,
    sheets: { [clubId]: sheet },
    coaches,
    commands: { [fixture.id]: robotCommands(input, side, params) },
    fanDecisions: { [clubId]: params.fans.decisionCap },
  };
}
