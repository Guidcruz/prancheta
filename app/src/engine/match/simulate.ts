import { elevenStrength } from '../generation.ts';
import { clamp, normal } from '../math.ts';
import type { GameParams, MatchParams } from '../params.ts';
import { Rng } from '../rng.ts';
import { GOALKEEPER_SLOT, homeAdvantage, type TeamStrengths } from '../strength.ts';
import type { EngineWarning, PlayerId, Side } from '../types.ts';
import {
  AI_HALFTIME_TALK,
  ASSIST_WEIGHTS,
  BIG_CHANCE_P_GOAL,
  HALFTIME_TALKS,
  HALF_MINUTES,
  INJURY_FATIGUE_WEIGHT,
  INJURY_SEVERITIES,
  MAX_PLAYER_CARD_MULT,
  MIN_PLAYERS_ON_PITCH,
  MISS_OUTCOMES,
  POSSESSION,
  SHOOTER_WEIGHTS,
  STOPPAGE,
  SUSPENSION,
  WEIGHT_ATTRIBUTE_SCALE,
  abandonedScore,
  attendance,
  chanceProbability,
  energyDrain,
  halftimeBoost,
  injuryProbability,
  playerCardMult,
  redProbability,
  scoreState,
  sideCardRates,
  yellowProbability,
} from './rules.ts';
import {
  bestOnPitch,
  cardConsequences,
  playerRatings,
  resultMarkers,
  winnerOf,
  type GoalRecord,
} from './summary.ts';
import {
  captainOnPitch,
  currentStrengths,
  freeKickGoalProbability,
  kickoffTeam,
  leavePitch,
  openPlayGoalProbability,
  penaltyGoalProbability,
  playersOnPitch,
  setPieceTaker,
  type Appearance,
  type Slot,
  type TeamState,
} from './team.ts';
import type {
  ChanceKind,
  HalftimeTalk,
  InjurySeverity,
  MatchEvent,
  MatchInput,
  MatchResult,
  MissOutcome,
} from './types.ts';

/*
 * The match, minute by minute (docs/design/partida.md, "Visão geral do cálculo"; T-009, T-010).
 *
 * One Rng per match, seeded with `input.seed`, and a fixed order of draws (partida.md,
 * "Determinismo"; the goldens of simulate.golden.test.ts pin it):
 * 1. kick-off: day form of the home side, then of the away side (6 draws each, `normal`); a side
 *    with fewer than 7 on the pitch ends the match right there (step 6);
 * 2. each minute, home side first, then away side: chance (1 draw); if there is one, its kind
 *    (1: penalty `match.penaltyShare`, direct free kick `match.freeKickShare`, else open play);
 *    - open play: shooter (1), goal (1), then the miss outcome (1) or, on a goal, whether it has
 *      an assist (1) and who gives it (1, when there is someone to give it);
 *    - penalty and free kick: the taker is chosen without a draw (`setPieceTaker`), then goal
 *      (1) and, on a miss, the miss outcome (1); no assist;
 * 3. then, home side first, each player who was on the pitch when the step began, in slot
 *    order: one draw that is a direct red, a yellow (a second yellow is a red), an injury or
 *    nothing, in this order of the cumulative probabilities; an injury then draws its severity
 *    (1) and its rounds out (1, `Rng.int`, also when the range has a single value). A player who
 *    leaves the pitch leaves his slot empty (the goalkeeper's is filled from the outfield, without
 *    a draw); a side that falls below 7 ends the match at once (step 6), with no more draws;
 *    then the energy drain of everyone on the pitch (no draw);
 * 4. end of each half: the added time (1), its minutes as in 2 and 3, then the possession noise
 *    (1);
 * 5. half time: the talk of each chaotic side (1 each, home first);
 * 6. full time, or the moment the match is abandoned: the possession noise of the half in
 *    progress, when abandoned (1), then the rating noise of each player with a rating (1 each;
 *    summary.ts).
 *
 * Extension point: T-012 applies the commands (substitutions included, so an injured player can
 * be replaced) at the start of the minute after the one they were given in, and the coach's
 * half-time talk in `halftimeTalk`. Until then a player who leaves is never replaced.
 */

const SIDES: readonly Side[] = ['home', 'away'];

/** Where a minute is: regulation minute, added minute (in added time) and half. */
interface Clock {
  readonly minute: number;
  readonly added?: number;
  readonly half: 1 | 2;
}

/** Index of a weighted draw over `weights` (one draw), or undefined when no weight is positive. */
function weightedIndex(rng: Rng, weights: readonly number[]): number | undefined {
  let total = 0;
  for (const w of weights) if (w > 0) total += w;
  if (!(total > 0)) return undefined;
  let u = rng.next() * total;
  let last: number | undefined;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i]!;
    if (!(w > 0)) continue;
    if (u < w) return i;
    u -= w;
    last = i;
  }
  return last; // rounding at the very end of the range
}

/** How a chance that is not a goal ends (one draw). */
function missOutcome(rng: Rng): MissOutcome {
  let u = rng.next();
  for (const { outcome, share } of MISS_OUTCOMES) {
    if (u < share) return outcome;
    u -= share;
  }
  return MISS_OUTCOMES[MISS_OUTCOMES.length - 1]!.outcome;
}

/**
 * Kind of a chance (partida.md, table "Tipo"; one draw): penalty with `match.penaltyShare`,
 * direct free kick with `match.freeKickShare`, open play ("Jogada") otherwise.
 */
function chanceKind(
  rng: Rng,
  match: Pick<MatchParams, 'penaltyShare' | 'freeKickShare'>,
): ChanceKind {
  const u = rng.next();
  if (u < match.penaltyShare) return 'penalty';
  if (u < match.penaltyShare + match.freeKickShare) return 'freeKick';
  return 'open';
}

/** Severity and rounds out of an injury (partida.md, "Lesões"; two draws). */
function injuryOutcome(rng: Rng): { severity: InjurySeverity; rounds: number } {
  let u = rng.next();
  let row = INJURY_SEVERITIES[INJURY_SEVERITIES.length - 1]!;
  for (const candidate of INJURY_SEVERITIES) {
    if (u < candidate.share) {
      row = candidate;
      break;
    }
    u -= candidate.share;
  }
  return { severity: row.severity, rounds: rng.int(row.minRounds, row.maxRounds) };
}

/** Displayed strength of the kick-off XI (balance-targets.md, "Força"): mean `overall × fit`. */
function displayedStrength(team: TeamState): number {
  const eleven = [];
  for (const slot of team.slots) {
    if (slot.app !== undefined) eleven.push({ player: slot.app.player, slot: slot.position });
  }
  return elevenStrength(eleven);
}

/**
 * Simulates a match (US-008; docs/02-architecture.md, 4.1): the same input and parameters give
 * the same events and result, byte for byte, on every run. Pure: the input is never changed.
 * Never throws because of a game situation; a sheet that cannot be played as given is fixed and
 * reported in `warnings` (team.ts, `kickoffTeam`).
 *
 * Cards, injuries, penalties and free kicks are drawn every minute (T-010); a player sent off or
 * injured leaves his slot empty, since substitutions arrive with the coach's commands (T-012).
 * A side with fewer than 7 on the pitch ends the match (`abandoned`). The half-time talk is the
 * AI's choice for both sides (ia-clubes.md, "Intervalo"), as partida.md says when there is no
 * choice; a leader captain doubles its positive effect.
 */
export function simulateMatch(input: MatchInput, params: GameParams): MatchResult {
  const { match } = params;
  const rng = new Rng(input.seed);
  const warnings: EngineWarning[] = [];
  const events: MatchEvent[] = [];
  const goals: GoalRecord[] = [];
  const newInjuries: { player: PlayerId; rounds: number }[] = [];

  let capacity = input.capacity;
  if (capacity !== undefined && !(Number.isFinite(capacity) && capacity >= 0)) {
    warnings.push({ code: 'match-invalid-capacity', detail: { capacity: String(capacity) } });
    capacity = undefined; // no capacity: the attendance is 0
  }
  const home = kickoffTeam('home', input.home, warnings);
  const away = kickoffTeam('away', input.away, warnings);
  const teams = [home, away] as const;
  const teamOf = (side: Side) => (side === 'home' ? home : away);
  home.home = input.neutral ? 0 : homeAdvantage({ fans: home.fans, derby: input.derby }, params);
  const kickoffStrength = { home: displayedStrength(home), away: displayedStrength(away) };

  const score = (): [number, number] => [home.goals, away.goals];
  const at = (clock: Clock) => ({
    minute: clock.minute,
    ...(clock.added === undefined ? {} : { added: clock.added }),
    half: clock.half,
  });

  /** The side that fell below 7 on the pitch, once the match is abandoned. */
  let abandoned: Side | undefined;
  const checkShort = (team: TeamState) => {
    if (abandoned === undefined && playersOnPitch(team) < MIN_PLAYERS_ON_PITCH) {
      abandoned = team.side;
    }
  };

  // 1. Kick-off: the day form, home then away.
  for (const team of teams) team.dayForm = normal(rng, 0, match.dayFormSd);
  events.push({ ...at({ minute: 0, half: 1 }), importance: 1, type: 'kickoff' });
  for (const team of teams) checkShort(team);

  /**
   * How a shot ends: goal or miss (and, for open play, the assist). `kind` decides the events: a
   * missed penalty is `penaltyMissed`, any other miss is `chance`.
   */
  function finish(
    clock: Clock,
    team: TeamState,
    opponent: TeamState,
    shooterIndex: number,
    kind: ChanceKind,
    pGoal: number,
  ): void {
    const shooter = team.slots[shooterIndex]!.app!;
    team.shots += 1;
    const keeper = opponent.slots[GOALKEEPER_SLOT]!.app;

    if (!rng.chance(pGoal)) {
      const outcome = missOutcome(rng);
      if (outcome === 'saved') {
        team.onTarget += 1;
        if (keeper !== undefined) keeper.saves += 1;
      }
      if (kind === 'penalty') {
        events.push({
          ...at(clock),
          importance: 3,
          type: 'penaltyMissed',
          side: team.side,
          taker: shooter.player.id,
          outcome,
        });
        return;
      }
      const big = pGoal >= BIG_CHANCE_P_GOAL || outcome === 'post';
      events.push({
        ...at(clock),
        importance: big ? 2 : 1,
        type: 'chance',
        side: team.side,
        shooter: shooter.player.id,
        kind,
        outcome,
        pGoal,
      });
      return;
    }

    team.goals += 1;
    team.onTarget += 1;
    shooter.goals += 1;
    let assist: PlayerId | undefined;
    if (kind === 'open' && rng.chance(match.assistShare)) {
      const assistIndex = weightedIndex(
        rng,
        team.slots.map((s, i) =>
          s.app === undefined || i === shooterIndex
            ? 0
            : (ASSIST_WEIGHTS[s.position] * s.app.passing) / WEIGHT_ATTRIBUTE_SCALE,
        ),
      );
      if (assistIndex !== undefined) {
        const giver = team.slots[assistIndex]!.app!;
        giver.assists += 1;
        assist = giver.player.id;
      }
    }
    for (const s of opponent.slots) {
      if (s.app !== undefined && (s.sector === 'gk' || s.sector === 'def')) s.app.conceded += 1;
    }
    goals.push({ side: team.side, scorer: shooter.player.id, ...at(clock) });
    events.push({
      ...at(clock),
      importance: 3,
      type: 'goal',
      side: team.side,
      scorer: shooter.player.id,
      ...(assist === undefined ? {} : { assist }),
      kind,
      score: score(),
    });
  }

  /** One chance of `team` against `opponent` in this minute (partida.md, "Chance de oportunidade"). */
  function attack(
    clock: Clock,
    team: TeamState,
    own: TeamStrengths,
    opponent: TeamState,
    theirs: TeamStrengths,
  ): void {
    const pChance = chanceProbability(
      own.power + team.dayForm,
      theirs.defense + opponent.dayForm,
      match,
    );
    if (!rng.chance(pChance)) return;
    const kind = chanceKind(rng, match);
    if (kind === 'open') {
      const shooterIndex = weightedIndex(
        rng,
        team.slots.map((slot) =>
          slot.app === undefined
            ? 0
            : (SHOOTER_WEIGHTS[slot.position] * slot.app.finishing) / WEIGHT_ATTRIBUTE_SCALE,
        ),
      );
      if (shooterIndex === undefined) return; // nobody who can shoot (no outfield player)
      const slot = team.slots[shooterIndex]!;
      const pGoal = openPlayGoalProbability(team, slot, opponent, theirs, match);
      finish(clock, team, opponent, shooterIndex, kind, pGoal);
      return;
    }
    const { lineup } = team.input.sheet;
    const takerIndex =
      kind === 'penalty'
        ? setPieceTaker(team, lineup.penaltyTakers, 'finishing')
        : setPieceTaker(team, lineup.freeKickTakers, 'technique');
    if (takerIndex === undefined) return; // nobody on the pitch (never with 7 or more)
    const slot = team.slots[takerIndex]!;
    if (kind === 'penalty') {
      events.push({
        ...at(clock),
        importance: 3,
        type: 'penaltyAwarded',
        side: team.side,
        taker: slot.app!.player.id,
      });
    }
    const pGoal =
      kind === 'penalty'
        ? penaltyGoalProbability(team, slot, opponent, theirs)
        : freeKickGoalProbability(team, slot, opponent, theirs, match);
    finish(clock, team, opponent, takerIndex, kind, pGoal);
  }

  /** A red card: the player leaves the pitch and is not replaced (partida.md, "Cartões"). */
  function sendOff(
    clock: Clock,
    team: TeamState,
    index: number,
    app: Appearance,
    reason: 'direct' | 'secondYellow',
  ): void {
    app.reds += 1;
    app.redReason = reason;
    events.push({
      ...at(clock),
      importance: 3,
      type: 'red',
      side: team.side,
      player: app.player.id,
      reason,
    });
    leavePitch(team, index);
  }

  /**
   * Cards and injuries of every player of `team` who was on the pitch when the step began, in
   * slot order: one draw each, split into direct red, yellow and injury (partida.md, "Cartões e
   * suspensão" and "Lesões"). Stops as soon as the side falls below 7 (the match is over).
   */
  function bookingsAndInjuries(clock: Clock, team: TeamState): void {
    const order = team.order;
    for (let k = 0; k < order.length; k++) order[k] = team.slots[k]!.app;
    const rates = sideCardRates(
      team.tactic.pressure,
      input.derby,
      clock.half === 2 && team.talk === 'calm',
      match,
    );
    // Nothing happens to a player whose draw is at or above what any player of this side could
    // get (the worst position and trait, energy 0): skipping the sums then changes no outcome.
    const ceiling =
      (Math.max(0, rates.red) * MAX_PLAYER_CARD_MULT +
        Math.max(0, rates.yellow) * MAX_PLAYER_CARD_MULT +
        Math.max(0, match.injury.basePerMinute) * (1 + INJURY_FATIGUE_WEIGHT)) *
      (1 + 1e-9);
    for (let k = 0; k < order.length; k++) {
      const app = order[k];
      if (app === undefined || !app.onPitch) continue;
      const u = rng.next();
      if (u >= ceiling) continue;
      // The slot only changes when an outfield player went in goal earlier in this step.
      const index = team.slots[k]!.app === app ? k : team.slots.findIndex((s) => s.app === app);
      const mult = playerCardMult(team.slots[index]!.position, app.player.trait);
      const pRed = redProbability(rates, mult);
      const pYellow = pRed + yellowProbability(rates, mult, app.yellows > 0);
      const pInjury = pYellow + injuryProbability(app.energy, match);
      if (u >= pInjury) continue;
      if (u < pRed) {
        sendOff(clock, team, index, app, 'direct');
      } else if (u < pYellow) {
        if (app.yellows > 0) {
          sendOff(clock, team, index, app, 'secondYellow');
        } else {
          app.yellows = 1;
          events.push({
            ...at(clock),
            importance: 1,
            type: 'yellow',
            side: team.side,
            player: app.player.id,
            triggersSuspension: app.yellowCount + 1 >= SUSPENSION.yellowLimit,
          });
          continue;
        }
      } else {
        const injury = injuryOutcome(rng);
        newInjuries.push({ player: app.player.id, rounds: injury.rounds });
        events.push({
          ...at(clock),
          importance: 2,
          type: 'injury',
          side: team.side,
          player: app.player.id,
          severity: injury.severity,
        });
        leavePitch(team, index);
      }
      checkShort(team);
      if (abandoned !== undefined) return;
    }
  }

  /** Energy drain of everyone on the pitch (partida.md, "Cansaço"). */
  function drain(team: TeamState): void {
    team.slots.forEach((slot: Slot, i) => {
      if (slot.app === undefined) return;
      const loss = energyDrain(
        slot.app.physical,
        team.tactic.pressure,
        i === GOALKEEPER_SLOT,
        match,
      );
      slot.app.energy = Math.max(0, slot.app.energy - loss);
    });
  }

  function playMinute(clock: Clock): void {
    // Everyone on the pitch when the minute starts played it, even if he leaves during it.
    if (clock.added === undefined) {
      for (const team of teams) for (const slot of team.slots) if (slot.app) slot.app.minutes += 1;
    }
    const strengths = { home: currentStrengths(home, match), away: currentStrengths(away, match) };
    attack(clock, home, strengths.home, away, strengths.away);
    attack(clock, away, strengths.away, home, strengths.home);
    for (const team of teams) {
      bookingsAndInjuries(clock, team);
      if (abandoned !== undefined) return;
    }
    for (const team of teams) drain(team);
  }

  /**
   * Home possession of a half: `clamp(50 + 1.5 × (Mid − Mid_opp) + Rng.int(−3, 3), 30, 70)`, with
   * the `Mid` of `home(t) = 0` (partida.md, "Posse de bola": two equal sides stay at 50%).
   */
  function halfPossession(): number {
    const mid = currentStrengths(home, match, 0).mid - currentStrengths(away, match, 0).mid;
    const noise = rng.int(-POSSESSION.noise, POSSESSION.noise);
    return clamp(POSSESSION.base + POSSESSION.perMid * mid + noise, POSSESSION.min, POSSESSION.max);
  }

  /**
   * The half-time talk of a side at its half-time score: the AI's (ia-clubes.md, "Intervalo"); the
   * coach's is T-012.
   */
  function halftimeTalk(team: TeamState, own: number, theirs: number): HalftimeTalk {
    const { profile } = team; // an unknown profile was already turned into `traditional`
    if (profile === 'chaotic') return HALFTIME_TALKS[rng.int(0, HALFTIME_TALKS.length - 1)]!;
    return AI_HALFTIME_TALK[profile][scoreState(own, theirs)];
  }

  const possession: number[] = [];
  let end: Clock = { minute: 0, half: 1 };
  if (abandoned === undefined) {
    play: for (const half of [1, 2] as const) {
      const last = half * HALF_MINUTES;
      for (let minute = last - HALF_MINUTES + 1; minute <= last; minute++) {
        end = { minute, half };
        playMinute(end);
        if (abandoned !== undefined) break play;
      }
      // 4. Added time, drawn at the end of the half and announced, then played like any minute.
      const added = rng.int(STOPPAGE[half].min, STOPPAGE[half].max);
      events.push({
        ...at({ minute: last, half }),
        importance: 1,
        type: 'stoppage',
        minutes: added,
      });
      end = { minute: last, ...(added > 0 ? { added } : {}), half };
      for (let extra = 1; extra <= added; extra++) {
        end = { minute: last, added: extra, half };
        playMinute(end);
        if (abandoned !== undefined) break play;
      }
      possession.push(halfPossession());

      if (half === 1) {
        events.push({ ...at(end), importance: 2, type: 'halftime', score: score() });
        // 5. Half-time talk: `halftimeBoost` of the second half, by the half-time score; a leader
        // captain on the pitch doubles a positive effect.
        for (const team of teams) {
          const theirs = teamOf(team.side === 'home' ? 'away' : 'home').goals;
          const talk = halftimeTalk(team, team.goals, theirs);
          const leader = captainOnPitch(team)?.player.trait === 'leader';
          team.talk = talk;
          team.halftimeBoost = halftimeBoost(talk, team.goals, theirs, leader);
          events.push({ ...at(end), importance: 1, type: 'halftimeTalk', side: team.side, talk });
        }
      }
    }
  }
  // 6. An abandoned match closes the possession of the half in progress.
  if (abandoned !== undefined) possession.push(halfPossession());

  const final = abandoned === undefined ? score() : abandonedScore(score(), abandoned);
  events.push({
    ...at(end),
    importance: 3,
    type: 'fulltime',
    score: final,
    abandoned: abandoned !== undefined,
  });

  // Summary.
  const ratings = playerRatings(teams, final, rng);
  const motm = bestOnPitch(ratings, winnerOf(final));
  const markers = resultMarkers(teams, {
    score: final,
    goals,
    derby: input.derby,
    neutral: input.neutral,
    strength: kickoffStrength,
  });
  const cards = cardConsequences(teams);

  let possessionSum = 0;
  for (const value of possession) possessionSum += value;
  const homePossession = Math.round(possessionSum / possession.length);
  const count = (side: Side, type: 'yellow' | 'red') =>
    events.filter((e) => e.type === type && e.side === side).length;
  const stats = Object.fromEntries(
    SIDES.map((side) => {
      const team = teamOf(side);
      return [
        side,
        {
          shots: team.shots,
          onTarget: team.onTarget,
          possession: side === 'home' ? homePossession : 100 - homePossession,
          yellows: count(side, 'yellow'),
          reds: count(side, 'red'),
        },
      ];
    }),
  ) as Record<Side, MatchResult['stats']['home']>;

  const ratingById: Record<PlayerId, number | null> = {};
  const minutes: Record<PlayerId, number> = {};
  const finalEnergy: Record<PlayerId, number> = {};
  for (const [app, value] of ratings) {
    ratingById[app.player.id] = value;
    minutes[app.player.id] = app.minutes;
    finalEnergy[app.player.id] = app.energy;
  }

  return {
    fixtureId: input.fixtureId,
    score: final,
    events,
    stats,
    ratings: ratingById,
    ...(motm === undefined ? {} : { motm: motm.player.id }),
    minutes,
    finalEnergy,
    newInjuries,
    newSuspensions: cards.newSuspensions,
    yellowCounts: cards.yellowCounts,
    markers,
    attendance: attendance(capacity, home.fans, input.derby, params.fans),
    warnings,
  };
}
