import { elevenStrength } from '../generation.ts';
import { clamp, normal } from '../math.ts';
import type { GameParams } from '../params.ts';
import { Rng } from '../rng.ts';
import { GOALKEEPER_SLOT, homeAdvantage, type TeamStrengths } from '../strength.ts';
import type { EngineWarning, PlayerId, Side } from '../types.ts';
import {
  AI_HALFTIME_TALK,
  ASSIST_WEIGHTS,
  BIG_CHANCE_P_GOAL,
  HALFTIME_TALKS,
  HALF_MINUTES,
  MISS_OUTCOMES,
  POSSESSION,
  SHOOTER_WEIGHTS,
  STOPPAGE,
  WEIGHT_ATTRIBUTE_SCALE,
  attendance,
  chanceProbability,
  energyDrain,
  halftimeBoost,
  scoreState,
} from './rules.ts';
import { bestOnPitch, playerRatings, resultMarkers, winnerOf, type GoalRecord } from './summary.ts';
import {
  currentStrengths,
  kickoffTeam,
  openPlayGoalProbability,
  type Slot,
  type TeamState,
} from './team.ts';
import type {
  ChanceKind,
  HalftimeTalk,
  MatchEvent,
  MatchInput,
  MatchResult,
  MissOutcome,
} from './types.ts';

/*
 * The match, minute by minute (docs/design/partida.md, "Visão geral do cálculo"; T-009).
 *
 * One Rng per match, seeded with `input.seed`, and a fixed order of draws (partida.md,
 * "Determinismo"; the goldens of simulate.golden.test.ts pin it):
 * 1. kick-off: day form of the home side, then of the away side (6 draws each, `normal`);
 * 2. each minute, home side first, then away side: chance (1 draw); if there is one, shooter
 *    (1), goal (1), then the miss outcome (1) or, on a goal, whether it has an assist (1) and
 *    who gives it (1, when there is someone to give it);
 * 3. end of each half: the added time (1), its minutes as in 2, then the possession noise (1);
 * 4. half time: the talk of each chaotic side (1 each, home first);
 * 5. full time: the rating noise of each player with a rating (1 each; summary.ts).
 *
 * Extension points, so the next tasks fit without rewriting the loop:
 * - T-010 draws the chance kind (penalty `match.penaltyShare`, direct free kick
 *   `match.freeKickShare`) in `chanceKind`, and cards and injuries of every player on the pitch
 *   after both sides attacked and before the energy drain, in `playMinute`;
 * - T-012 applies the commands at the start of the minute after the one they were given in, and
 *   the coach's half-time talk in `halftimeTalk`.
 * Until then every chance is open play and no draw is spent on the kind, cards or injuries.
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
 * Kind of a chance (partida.md, table "Tipo"). Penalties and direct free kicks, with their takers,
 * are T-010; until then every chance is open play ("Jogada") and no draw is spent here.
 *
 * T-010: the home factor of the finish ("Mando na finalização") applies to both new kinds too, as
 * in `openPlayGoalProbability`: the free kick uses `technique × fit × moraleMult × condMult ×
 * (1 + home)` against `gkEff × (1 + home(keeper's side))`, then `× 0.45`; the penalty uses
 * `finishing × (1 + home)` and `gkEff × (1 + home)` in `clamp(0.78 + 0.004 × (finishing −
 * gkEff), 0.60, 0.92)`. Document example (78 against 66, home 0.106): 0.861 for the home taker,
 * 0.800 for the away one, 0.828 on neutral ground.
 */
function chanceKind(): ChanceKind {
  return 'open';
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
 * Not yet in this version: cards, injuries, penalties, free kicks and the abandoned match
 * (T-010); the coach's commands, substitutions and the coach's half-time talk (T-012). The
 * half-time talk is the AI's choice for both sides (ia-clubes.md, "Intervalo"), as partida.md
 * says when there is no choice; the leader captain's double effect arrives with the captain
 * (T-010).
 */
export function simulateMatch(input: MatchInput, params: GameParams): MatchResult {
  const { match } = params;
  const rng = new Rng(input.seed);
  const warnings: EngineWarning[] = [];
  const events: MatchEvent[] = [];
  const goals: GoalRecord[] = [];

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

  // 1. Kick-off: the day form, home then away.
  for (const team of teams) team.dayForm = normal(rng, 0, match.dayFormSd);
  events.push({ ...at({ minute: 0, half: 1 }), importance: 1, type: 'kickoff' });

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
    const kind = chanceKind();
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
    const shooter = slot.app!;
    const pGoal = openPlayGoalProbability(team, slot, opponent, theirs, match);
    team.shots += 1;
    const keeper = opponent.slots[GOALKEEPER_SLOT]!.app;

    if (!rng.chance(pGoal)) {
      const outcome = missOutcome(rng);
      if (outcome === 'saved') {
        team.onTarget += 1;
        if (keeper !== undefined) keeper.saves += 1;
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
    if (rng.chance(match.assistShare)) {
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
    const strengths = { home: currentStrengths(home, match), away: currentStrengths(away, match) };
    attack(clock, home, strengths.home, away, strengths.away);
    attack(clock, away, strengths.away, home, strengths.home);
    // T-010: cards and injuries of every player on the pitch, home first, in slot order.
    for (const team of teams) drain(team);
    if (clock.added === undefined) {
      for (const team of teams) for (const slot of team.slots) if (slot.app) slot.app.minutes += 1;
    }
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
  let stoppage2 = 0;
  for (const half of [1, 2] as const) {
    const last = half * HALF_MINUTES;
    for (let minute = last - HALF_MINUTES + 1; minute <= last; minute++) {
      playMinute({ minute, half });
    }
    // 3. Added time, drawn at the end of the half and announced, then played like any minute.
    const added = rng.int(STOPPAGE[half].min, STOPPAGE[half].max);
    if (half === 2) stoppage2 = added;
    events.push({ ...at({ minute: last, half }), importance: 1, type: 'stoppage', minutes: added });
    for (let extra = 1; extra <= added; extra++) playMinute({ minute: last, added: extra, half });
    possession.push(halfPossession());

    if (half === 1) {
      const end = { minute: last, ...(added > 0 ? { added } : {}), half } as const;
      events.push({ ...at(end), importance: 2, type: 'halftime', score: score() });
      // 4. Half-time talk: `halftimeBoost` of the second half, by the half-time score.
      for (const team of teams) {
        const theirs = teamOf(team.side === 'home' ? 'away' : 'home').goals;
        const talk = halftimeTalk(team, team.goals, theirs);
        team.halftimeBoost = halftimeBoost(talk, team.goals, theirs);
        events.push({ ...at(end), importance: 1, type: 'halftimeTalk', side: team.side, talk });
      }
    }
  }

  const final = score();
  const end = {
    minute: 2 * HALF_MINUTES,
    ...(stoppage2 > 0 ? { added: stoppage2 } : {}),
    half: 2,
  } as const;
  events.push({ ...at(end), importance: 3, type: 'fulltime', score: final, abandoned: false });

  // 5. Summary.
  const ratings = playerRatings(teams, final, rng);
  const motm = bestOnPitch(ratings, winnerOf(final));
  const markers = resultMarkers(teams, {
    score: final,
    goals,
    derby: input.derby,
    neutral: input.neutral,
    strength: kickoffStrength,
  });

  const homePossession = Math.round((possession[0]! + possession[1]!) / 2);
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
    newInjuries: [],
    markers,
    attendance: attendance(capacity, home.fans, input.derby, params.fans),
    warnings,
  };
}
