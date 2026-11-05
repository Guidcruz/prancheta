import { describe, expect, it } from 'vitest';
import type { Fixture } from './fixtures.ts';
import { newGame, type ClubState, type GameState } from './game.ts';
import {
  ABANDONED_SCORE,
  MIN_PLAYERS_ON_PITCH,
  MISS_OUTCOMES,
  RATING,
  SUSPENSION,
  abandonedScore,
} from './match/rules.ts';
import { simulateMatch } from './match/simulate.ts';
import type {
  MatchCommand,
  MatchEvent,
  MatchInput,
  MatchResult,
  TeamInput,
} from './match/types.ts';
import type { GameParams } from './params.ts';
import { RATING_RANGE, RECENT_RATINGS_MAX, type Player } from './players.ts';
import { Rng, seedFromString } from './rng.ts';
import { MATCH_MODES, playRound, type MatchMode, type RoundInput } from './round.ts';
import { isUnavailable } from './selection.ts';
import { POINTS, getStandings, type StandingRow } from './standings.ts';
import { syntheticClubs } from './testing/clubs.ts';
import { fixedIdentitySource } from './testing/identity.ts';
import { aiFixtureInput, aiTeamInput, fixtureInput, testGame } from './testing/match.ts';
import { testParams } from './testing/params.ts';
import type { ClubId, PlayerId, Side } from './types.ts';

/*
 * Property tests of T-015 (docs/03-test-plan.md, "Propriedade (invariantes em 1.000 sementes)";
 * docs/02-architecture.md, 6 "Propriedade"; US-008, US-012, US-010, US-026). A plain loop over
 * seeded inputs, no library: each case collects its problems as text (the seed and the round are
 * in the message), so thousands of cases stay fast and a failure names the case to replay.
 *
 * This file adds what the earlier property files do not check; they stay as they are:
 * - match/simulate.property.test.ts: statistics, ratings, minutes, energy, injuries and
 *   suspensions of 1,000 matches with real parameters;
 * - round.property.test.ts: bounds between rounds from random states (6 seasons, AI only);
 * - ai.property.test.ts and strength.property.test.ts: the AI's sheets and the strengths.
 *
 * Here: (1) the structure of 1,000 matches (clock, one outcome per chance, who is on the pitch,
 * cards, penalties, substitutions, abandonment, finite numbers), including stressed ones with many
 * cards and short sides, and the "tudo no ataque" asked too early; (2) whole seasons with the AI
 * and human coaches, both realisms and new or random starting states: one game per club and
 * round, the table against the scores and the tie-breaks, the states between rounds, the
 * determinism. The consistency of the season goldens is checked in round.golden.test.ts.
 *
 * `PROPERTY_FULL=1` runs the full counts (10,000 matches and 1,000 seasons; about 9 minutes,
 * like NAMES_FULL_CHECK: before a release and when the engine changes a lot):
 * `PROPERTY_FULL=1 npm test -w app -- src/engine/properties.test.ts`.
 */
const FULL = process.env.PROPERTY_FULL === '1';
const MATCH_SEEDS = FULL ? 10_000 : 1_000;
const SEASONS = FULL ? 1_000 : 30;
/** Seasons per test, so a long run shows its progress and each case has its own timeout. */
const SEASONS_PER_TEST = 10;

/*
 * The rule numbers come from the design documents, not from the engine's constants, so a wrong
 * constant fails here (docs/design/partida.md, "Substituições" and "Acréscimos").
 */
/** "Até 5 por jogo (`match.maxSubs = 5`), sem limite de paradas". */
const DOC_MAX_SUBS = 5;
/** "banco de 7 (`match.benchSize = 7`)". */
const DOC_BENCH_SIZE = 7;
/** "Primeiro tempo: `Rng.int(0, 3)` minutos; segundo tempo: `Rng.int(2, 6)`". */
const DOC_STOPPAGE = { 1: { min: 0, max: 3 }, 2: { min: 2, max: 6 } } as const;

const params = testParams();
const SIDES: readonly Side[] = ['home', 'away'];

/** Params with many more cards and injuries: reds, short sides and abandoned matches. */
const harsh: GameParams = {
  ...params,
  match: {
    ...params.match,
    cards: { ...params.match.cards, yellowPerMinute: 0.01, redPerMinute: 0.004 },
    injury: { basePerMinute: 0.002 },
  },
};

/** Every non-finite number in a value (NaN, ±Infinity), by path. */
function nonFinite(value: unknown, path: string, out: string[]): void {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) out.push(`${path} = ${value}`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => nonFinite(v, `${path}[${i}]`, out));
  } else if (typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value)) nonFinite(v, `${path}.${k}`, out);
  }
}

// ---------------------------------------------------------------------------------------------
// 1. The match (US-008, US-009)
// ---------------------------------------------------------------------------------------------

const game = testGame();
const fixtures = game.fixtures;
type Kind = 'plain' | 'ai' | 'coach-home' | 'coach-away' | 'harsh' | 'harsh-short' | 'both-short';
/** The kinds the seeds go through; `both-short` has its own test (a W.O. at kick-off). */
const KINDS: readonly Kind[] = ['plain', 'ai', 'coach-home', 'coach-away', 'harsh', 'harsh-short'];

/** The same team with some players changed and some starters replaced by unknown ids. */
function damaged(team: TeamInput, seed: number): TeamInput {
  const starters = team.sheet.lineup.starters;
  // Three ghost starters (an 8-man side), one suspended and one injured among the rest.
  const ghosts = new Set([starters[2 + (seed % 3)], starters[6], starters[9]]);
  const suspended = starters[1];
  const injured = starters[5];
  return {
    ...team,
    players: team.players.map((p) =>
      p.id === suspended
        ? { ...p, suspendedGames: 1 }
        : p.id === injured
          ? { ...p, injuryRounds: 2 }
          : p,
    ),
    sheet: {
      ...team.sheet,
      lineup: {
        ...team.sheet.lineup,
        starters: starters.map((id) => (ghosts.has(id) ? `${team.clubId}#ghost` : id)),
      },
    },
  };
}

/** The same team with yellow counters of 0 to 2 (a later round), so a yellow may suspend. */
function booked(team: TeamInput, seed: number): TeamInput {
  return {
    ...team,
    players: team.players.map((p, i) => ({
      ...p,
      yellowCount: (seed + i) % SUSPENSION.yellowLimit,
    })),
  };
}

interface MatchCase {
  readonly kind: Kind;
  readonly input: MatchInput;
  readonly params: GameParams;
  readonly commands?: MatchCommand[];
}

/** A few commands of the coach for a human side, some of them invalid on purpose. */
function coachCommands(seed: number, side: Side, team: TeamInput): MatchCommand[] {
  const { starters, bench } = team.sheet.lineup;
  return [
    {
      minute: 5 + (seed % 40),
      side,
      kind: 'substitution',
      out: starters[1 + (seed % 10)]!,
      in: bench[seed % DOC_BENCH_SIZE]!,
    },
    {
      minute: 45,
      side,
      kind: 'halftimeTalk',
      talk: (['motivate', 'demand', 'calm', 'skip'] as const)[seed % 4]!,
    },
    {
      minute: 50 + (seed % 25),
      side,
      kind: 'tactic',
      formation: (['4-3-3', '3-5-2', '5-3-2', '4-2-3-1'] as const)[seed % 4]!,
      pressure: (['low', 'medium', 'high'] as const)[seed % 3]!,
    },
    {
      minute: 70 + (seed % 15),
      side,
      kind: 'preset',
      preset: (['press', 'holdResult', 'allOut'] as const)[seed % 3]!,
    },
    {
      minute: 90,
      added: seed % 7,
      side,
      kind: 'substitution',
      out: starters[2 + (seed % 9)]!,
      in: bench[(seed + 3) % DOC_BENCH_SIZE]!,
    },
  ];
}

const inputs = new Map<string, MatchInput>();
/** The input of a kind for fixture `i`, built once (the AI's sheets cost a little). */
function baseInput(kind: Kind, i: number): MatchInput {
  const key = `${kind}-${i}`;
  const cached = inputs.get(key);
  if (cached !== undefined) return cached;
  const f = fixtures[i]!;
  let input: MatchInput;
  if (kind === 'plain') input = fixtureInput(game, f);
  else if (kind === 'coach-home')
    input = { ...baseInput('ai', i), home: aiTeamInput(game, f, f.homeId, 'human') };
  else if (kind === 'coach-away')
    input = { ...baseInput('ai', i), away: aiTeamInput(game, f, f.awayId, 'human') };
  else input = aiFixtureInput(game, f);
  inputs.set(key, input);
  return input;
}

function matchCase(seed: number): MatchCase {
  const kind = KINDS[seed % KINDS.length]!;
  // Skip by the number of kinds, so every kind meets every fixture.
  const i = Math.floor(seed / KINDS.length) % fixtures.length;
  let input: MatchInput = { ...baseInput(kind, i), seed };
  if (kind === 'harsh' || kind === 'harsh-short') {
    input = { ...input, home: booked(input.home, seed), away: booked(input.away, seed + 1) };
  }
  if (kind === 'harsh-short') input = { ...input, home: damaged(input.home, seed) };
  const human = SIDES.find((s) => input[s].controller === 'human');
  return {
    kind,
    input,
    params: kind === 'harsh' || kind === 'harsh-short' ? harsh : params,
    ...(human === undefined ? {} : { commands: coachCommands(seed, human, input[human]) }),
  };
}

/** The problems of a match result, as text (empty when every invariant holds). */
function matchProblems(c: MatchCase, result: MatchResult): string[] {
  const { input } = c;
  const out: string[] = [];
  const bad = (msg: string) => out.push(msg);
  const events = result.events;
  const sideOf = new Map<PlayerId, Side>();
  const byId = new Map<PlayerId, Player>();
  for (const side of SIDES) {
    for (const p of input[side].players) {
      sideOf.set(p.id, side);
      byId.set(p.id, p);
    }
  }
  const benches = {
    home: new Set(input.home.sheet.lineup.bench.slice(0, DOC_BENCH_SIZE)),
    away: new Set(input.away.sheet.lineup.bench.slice(0, DOC_BENCH_SIZE)),
  };

  // The kick-off XI: who took the pitch without coming on as a substitute.
  const cameOn = new Set<PlayerId>();
  for (const e of events) if (e.type === 'substitution') cameOn.add(e.in);
  const pitch = { home: new Set<PlayerId>(), away: new Set<PlayerId>() };
  for (const id of Object.keys(result.minutes)) {
    const side = sideOf.get(id);
    if (side === undefined) bad(`${id} took the pitch but is in no squad`);
    else if (!cameOn.has(id)) pitch[side].add(id);
    const p = byId.get(id);
    // US-009 / §6 "nenhum suspenso escalado": the unavailable never take the pitch.
    if (p !== undefined && isUnavailable(p)) bad(`${id} injured or suspended took the pitch`);
  }
  for (const side of SIDES) {
    const { starters } = input[side].sheet.lineup;
    for (const id of pitch[side]) {
      // A kick-off replacement for an unavailable starter comes from the bench.
      if (!starters.includes(id) && !benches[side].has(id)) bad(`${id} started from nowhere`);
    }
    const short = c.kind === 'both-short' || (c.kind === 'harsh-short' && side === 'home');
    if (!short && pitch[side].size !== 11) {
      bad(`${side} kicked off with ${pitch[side].size}`);
    }
  }

  const used = { home: new Set(pitch.home), away: new Set(pitch.away) };
  const gone = new Set<PlayerId>();
  const yellowed = new Set<PlayerId>();
  const subs = { home: 0, away: 0 };
  const live = { home: 0, away: 0 };
  const shots = { home: 0, away: 0 };
  const saved = { home: 0, away: 0 };
  const cards = { home: { yellow: 0, red: 0 }, away: { yellow: 0, red: 0 } };
  const stoppage: { 1?: number; 2?: number } = {};
  const shotAt = new Set<string>();
  let penalty: { side: Side; taker: PlayerId } | undefined;
  let injured: { side: Side; player: PlayerId; index: number } | undefined;
  let short: Side | undefined;

  /** Reserves still able to come on: on the bench, in the squad, available, never on the pitch. */
  const reservesLeft = (side: Side) =>
    [...benches[side]].filter((id) => {
      const p = byId.get(id);
      return (
        p !== undefined &&
        !isUnavailable(p) &&
        !input[side].sheet.lineup.starters.includes(id) &&
        !used[side].has(id) &&
        !gone.has(id)
      );
    }).length;
  const on = (side: Side, id: PlayerId | undefined, what: string, at: string) => {
    if (id === undefined || !pitch[side].has(id)) bad(`${at}: ${what} ${id} not on the pitch`);
  };
  const clock = (e: MatchEvent) =>
    `${e.half}:${e.minute}${e.added === undefined ? '' : `+${e.added}`}`;

  events.forEach((e, index) => {
    const at = `${e.type}@${clock(e)}`;
    // Clock: kick-off at 0, then each half within its minutes and its drawn added time.
    if (index === 0) {
      if (e.type !== 'kickoff' || e.minute !== 0 || e.half !== 1 || e.added !== undefined) {
        bad(`first event ${at}`);
      }
    } else if (e.type === 'kickoff') {
      bad(`second kickoff ${at}`);
    } else if (!(e.type === 'fulltime' && e.minute === 0 && e.half === 1)) {
      const first = e.half === 1 ? 1 : 46;
      const last = e.half === 1 ? 45 : 90;
      if (!Number.isInteger(e.minute) || e.minute < first || e.minute > last) {
        bad(`${at}: minute outside the half`);
      }
      if (e.added !== undefined) {
        const drawn = stoppage[e.half];
        if (e.minute !== last) bad(`${at}: added time off the last minute`);
        if (drawn === undefined) bad(`${at}: added time before the stoppage`);
        else if (!Number.isInteger(e.added) || e.added < 1 || e.added > drawn) {
          bad(`${at}: added minute beyond the ${drawn} drawn`);
        }
      }
    }

    // A side below 7 ends the match at once: only the full time may follow.
    if (!(e.type === 'substitution' && e.reason === 'injury') && index > 0) {
      const below = SIDES.find((s) => pitch[s].size < MIN_PLAYERS_ON_PITCH);
      if (below !== undefined && short === undefined) short = below;
      if (short !== undefined && !(e.type === 'fulltime' && e.abandoned)) {
        bad(`${at} after ${short} fell below ${MIN_PLAYERS_ON_PITCH}`);
      }
    }
    // The injured player's substitution, if any, comes right after his injury; without it, his
    // side had no substitution or no reserve left (partida.md, "Substituições", 4th item).
    if (injured !== undefined && injured.index === index - 1) {
      const swapped = e.type === 'substitution' && e.reason === 'injury';
      if (!swapped && subs[injured.side] < DOC_MAX_SUBS && reservesLeft(injured.side) > 0) {
        bad(`${at}: ${injured.player} injured and not replaced with subs and reserves left`);
      }
    }
    if (injured !== undefined && injured.index !== index - 1) injured = undefined;
    // A penalty has exactly one outcome, the very next event.
    if (penalty !== undefined) {
      const outcome =
        (e.type === 'goal' && e.kind === 'penalty' && e.scorer === penalty.taker) ||
        (e.type === 'penaltyMissed' && e.taker === penalty.taker);
      if (!outcome || ('side' in e && e.side !== penalty.side))
        bad(`${at}: penalty without outcome`);
      penalty = undefined;
    }
    // One chance (one outcome) per side and minute: the side attacks once per minute.
    const shot = (side: Side) => {
      const key = `${side}@${clock(e)}`;
      if (shotAt.has(key)) bad(`${at}: two outcomes for ${side} in one minute`);
      shotAt.add(key);
      shots[side]++;
    };

    switch (e.type) {
      case 'chance':
        on(e.side, e.shooter, 'shooter', at);
        shot(e.side);
        if (e.kind !== 'open' && e.kind !== 'freeKick') bad(`${at}: chance kind ${e.kind}`);
        if (!MISS_OUTCOMES.some((m) => m.outcome === e.outcome)) bad(`${at}: outcome ${e.outcome}`);
        if (e.outcome === 'saved') saved[e.side]++;
        if (!(e.pGoal > 0 && e.pGoal < 1)) bad(`${at}: pGoal ${e.pGoal}`);
        break;
      case 'goal':
        on(e.side, e.scorer, 'scorer', at);
        if (e.assist !== undefined) {
          on(e.side, e.assist, 'assist', at);
          if (e.assist === e.scorer) bad(`${at}: assist by the scorer`);
          if (e.kind !== 'open') bad(`${at}: assist in a ${e.kind}`);
        }
        shot(e.side);
        live[e.side]++;
        if (e.score[0] !== live.home || e.score[1] !== live.away) bad(`${at}: running score`);
        break;
      case 'penaltyAwarded':
        on(e.side, e.taker, 'penalty taker', at);
        penalty = { side: e.side, taker: e.taker };
        break;
      case 'penaltyMissed':
        // Its penaltyAwarded was checked above; one without it has no `penalty` pending.
        if (events[index - 1]?.type !== 'penaltyAwarded') bad(`${at}: miss without a penalty`);
        shot(e.side);
        if (!MISS_OUTCOMES.some((m) => m.outcome === e.outcome)) bad(`${at}: outcome ${e.outcome}`);
        if (e.outcome === 'saved') saved[e.side]++;
        break;
      case 'yellow': {
        on(e.side, e.player, 'booked', at);
        // The second yellow is a red ('secondYellow'), never a second yellow event.
        if (yellowed.has(e.player)) bad(`${at}: second yellow event for ${e.player}`);
        yellowed.add(e.player);
        cards[e.side].yellow++;
        const before = byId.get(e.player)?.yellowCount ?? 0;
        if (e.triggersSuspension !== before + 1 >= SUSPENSION.yellowLimit) {
          bad(`${at}: triggersSuspension with ${before} yellows before`);
        }
        break;
      }
      case 'red':
        on(e.side, e.player, 'sent off', at);
        if (e.reason === 'secondYellow' && !yellowed.has(e.player)) {
          bad(`${at}: second yellow without a first`);
        }
        cards[e.side].red++;
        pitch[e.side].delete(e.player);
        gone.add(e.player);
        break;
      case 'injury':
        on(e.side, e.player, 'injured', at);
        pitch[e.side].delete(e.player);
        gone.add(e.player);
        injured = { side: e.side, player: e.player, index };
        break;
      case 'substitution':
        if (e.reason === 'injury') {
          if (injured === undefined || injured.side !== e.side || injured.player !== e.out) {
            bad(`${at}: injury substitution without the injury right before`);
          }
        } else {
          on(e.side, e.out, 'out', at);
          pitch[e.side].delete(e.out);
          gone.add(e.out);
        }
        injured = undefined;
        if (!benches[e.side].has(e.in)) bad(`${at}: ${e.in} not on the bench`);
        if (used[e.side].has(e.in) || gone.has(e.in)) bad(`${at}: ${e.in} comes on twice`);
        pitch[e.side].add(e.in);
        used[e.side].add(e.in);
        subs[e.side]++;
        // partida.md, "Substituições": up to 5 per match, no limit of stops.
        if (subs[e.side] > DOC_MAX_SUBS) bad(`${at}: substitution ${subs[e.side]} of ${e.side}`);
        break;
      case 'stoppage': {
        const half = e.half;
        const last = half === 1 ? 45 : 90;
        if (stoppage[half] !== undefined) bad(`${at}: two stoppages in the half`);
        if (e.minute !== last || e.added !== undefined) bad(`${at}: stoppage off the last minute`);
        if (e.minutes < DOC_STOPPAGE[half].min || e.minutes > DOC_STOPPAGE[half].max) {
          bad(`${at}: ${e.minutes} added minutes`);
        }
        stoppage[half] = e.minutes;
        break;
      }
      case 'halftime':
        if (e.half !== 1 || stoppage[1] === undefined) bad(`${at}: half time out of place`);
        if (e.score[0] !== live.home || e.score[1] !== live.away) bad(`${at}: half-time score`);
        break;
      case 'fulltime': {
        if (index !== events.length - 1) bad(`${at}: events after the full time`);
        if (e.score[0] !== result.score[0] || e.score[1] !== result.score[1]) {
          bad(`${at}: full-time score differs from the result`);
        }
        const real: [number, number] = [live.home, live.away];
        if (e.abandoned) {
          // Abandoned only with a side below 7 (home checked first at kick-off).
          const below = short ?? SIDES.find((s) => pitch[s].size < MIN_PLAYERS_ON_PITCH);
          if (below === undefined) bad(`${at}: abandoned with 7 or more on both sides`);
          else {
            const awarded = abandonedScore(real, below);
            if (result.score[0] !== awarded[0] || result.score[1] !== awarded[1]) {
              bad(`${at}: abandoned score ${result.score} for ${real} (${below} short)`);
            }
            const winner = below === 'home' ? result.score[1] : result.score[0];
            if (winner < ABANDONED_SCORE) bad(`${at}: abandoned winner with ${winner}`);
          }
        } else {
          if (short !== undefined) bad(`${at}: not abandoned with ${short} below 7`);
          for (const side of SIDES) {
            if (pitch[side].size < MIN_PLAYERS_ON_PITCH) bad(`${at}: ${side} ends with fewer`);
          }
          if (result.score[0] !== real[0] || result.score[1] !== real[1]) {
            bad(`${at}: score ${result.score} but ${real} goal events`);
          }
          const added = stoppage[2];
          if (stoppage[1] === undefined || added === undefined)
            bad(`${at}: a half without stoppage`);
          if (e.half !== 2 || e.minute !== 90 || e.added !== (added ? added : undefined)) {
            bad(`${at}: full time before the end of the added time`);
          }
        }
        break;
      }
      default:
        break;
    }
    // Nobody who left takes part again (the injured player's substitution names him as `out`).
    const named =
      e.type === 'chance'
        ? [e.shooter]
        : e.type === 'goal'
          ? [e.scorer, ...(e.assist === undefined ? [] : [e.assist])]
          : e.type === 'penaltyAwarded' || e.type === 'penaltyMissed'
            ? [e.taker]
            : e.type === 'yellow'
              ? [e.player]
              : [];
    for (const id of named) if (gone.has(id)) bad(`${at}: ${id} after leaving the pitch`);
  });

  if (events.at(-1)?.type !== 'fulltime') bad('the match does not end with the full time');
  if (penalty !== undefined) bad('a penalty without outcome at the end');
  for (const side of SIDES) {
    const stats = result.stats[side];
    if (stats.shots !== shots[side]) bad(`${side}: ${stats.shots} shots, ${shots[side]} outcomes`);
    if (stats.onTarget !== live[side] + saved[side]) bad(`${side}: onTarget ${stats.onTarget}`);
    if (stats.yellows !== cards[side].yellow) bad(`${side}: yellows ${stats.yellows}`);
    if (stats.reds !== cards[side].red) bad(`${side}: reds ${stats.reds}`);
  }
  for (const [id, minutes] of Object.entries(result.minutes)) {
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 90) bad(`${id}: ${minutes} minutes`);
  }
  for (const [id, rating] of Object.entries(result.ratings)) {
    if (rating !== null && (rating < RATING.min || rating > RATING.max))
      bad(`${id}: rating ${rating}`);
  }
  const numbers: string[] = [];
  nonFinite(result, 'result', numbers);
  for (const n of numbers) bad(`non-finite ${n}`);
  return out;
}

/** The same commands plus "tudo no ataque" asked to take effect before `allOutFromMinute`. */
function earlyAllOut(seed: number, side: Side, commands: readonly MatchCommand[]): MatchCommand[] {
  // `minute: M` takes effect at M + 1, so M + 1 < allOutFromMinute is too early.
  const minute = seed % (params.match.allOutFromMinute - 1);
  const early: MatchCommand =
    seed % 2 === 0
      ? { minute, side, kind: 'preset', preset: 'allOut' }
      : { minute, side, kind: 'tactic', posture: 'allOut', pressure: 'high' };
  // Last, so the indices in the other commands' warnings do not move.
  return [...commands, early];
}

describe(`match properties over ${MATCH_SEEDS} seeds (US-008)`, () => {
  it(
    'keeps the clock, the outcomes, the players on the pitch, cards, penalties and abandonment consistent',
    { timeout: FULL ? 600_000 : 60_000 },
    () => {
      const found: string[] = [];
      // Matches (not events) that reach each edge the invariants talk about.
      const seen = {
        abandoned: 0,
        reds: 0,
        penalties: 0,
        secondYellows: 0,
        injurySubs: 0,
        suspendingYellows: 0,
      };
      for (let seed = 0; seed < MATCH_SEEDS; seed++) {
        const c = matchCase(seed);
        const result = simulateMatch(c.input, c.params, c.commands);
        for (const p of matchProblems(c, result)) found.push(`seed ${seed} (${c.kind}): ${p}`);
        const has = (test: (e: MatchEvent) => boolean) => (result.events.some(test) ? 1 : 0);
        seen.abandoned += has((e) => e.type === 'fulltime' && e.abandoned);
        seen.reds += has((e) => e.type === 'red');
        seen.secondYellows += has((e) => e.type === 'red' && e.reason === 'secondYellow');
        seen.penalties += has((e) => e.type === 'penaltyAwarded');
        seen.suspendingYellows += has((e) => e.type === 'yellow' && e.triggersSuspension);
        seen.injurySubs += has((e) => e.type === 'substitution' && e.reason === 'injury');
      }
      expect(found.slice(0, 20)).toEqual([]);
      for (const [what, count] of Object.entries(seen)) {
        expect(count, `matches with ${what} in ${MATCH_SEEDS}`).toBeGreaterThan(MATCH_SEEDS / 10);
      }
    },
  );

  it('ends at kick-off, 0×3, a match with both sides below 7 (the home side is checked first)', () => {
    const both = (team: TeamInput): TeamInput => ({
      ...team,
      sheet: {
        ...team.sheet,
        lineup: {
          ...team.sheet.lineup,
          starters: team.sheet.lineup.starters.map((id, i) =>
            i < 6 ? id : `${team.clubId}#ghost`,
          ),
        },
      },
    });
    for (let seed = 0; seed < MATCH_SEEDS; seed += 50) {
      const base = matchCase(seed);
      const c: MatchCase = {
        ...base,
        kind: 'both-short',
        input: { ...base.input, home: both(base.input.home), away: both(base.input.away) },
      };
      const result = simulateMatch(c.input, c.params, c.commands);
      expect(matchProblems(c, result), `seed ${seed}`).toEqual([]);
      expect(result.events.map((e) => e.type)).toEqual(['kickoff', 'fulltime']);
      expect(result.score).toEqual([0, ABANDONED_SCORE]);
    }
  });

  it('plays "tudo no ataque" asked before allOutFromMinute as the match without it', () => {
    let compared = 0;
    for (let seed = 0; seed < MATCH_SEEDS; seed++) {
      const c = matchCase(seed);
      const side = SIDES.find((s) => c.input[s].controller === 'human');
      if (side === undefined) continue;
      const without = simulateMatch(c.input, c.params, c.commands);
      const commands = c.commands ?? [];
      const withEarly = simulateMatch(c.input, c.params, earlyAllOut(seed, side, commands));
      const { warnings: w1, ...rest1 } = without;
      const { warnings: w2, ...rest2 } = withEarly;
      expect(rest2, `seed ${seed}`).toStrictEqual(rest1);
      const early = w2.filter(
        (w) => w.code === 'command-too-early' && w.detail?.command === commands.length,
      );
      expect(early, `seed ${seed}`).toHaveLength(1);
      expect(w2.filter((w) => !early.includes(w))).toStrictEqual(w1);
      compared++;
    }
    // The two coach kinds: a third of the seeds.
    expect(compared).toBeGreaterThan(MATCH_SEEDS / 4);
  });

  it('gives the same result for the same seed and inputs (a sample of every 10th seed)', () => {
    for (let seed = 0; seed < MATCH_SEEDS; seed += 10) {
      const c = matchCase(seed);
      expect(JSON.stringify(simulateMatch(c.input, c.params, c.commands)), `seed ${seed}`).toBe(
        JSON.stringify(simulateMatch(c.input, c.params, c.commands)),
      );
    }
  });
});

// ---------------------------------------------------------------------------------------------
// 2. Rounds, table and the states between rounds (US-012, US-010, US-026)
// ---------------------------------------------------------------------------------------------

interface Season {
  readonly state: GameState;
  readonly humans: ReadonlyMap<ClubId, MatchMode>;
  readonly random: boolean;
}

/**
 * The start of a season: a new game with its own seed (both realisms), and every third one from
 * a random state (morale, thermometer and streaks at the edges or anywhere, fatigue). One or two
 * human clubs, each with a mode of following the match.
 */
function seasonStart(n: number): Season {
  const created = newGame(
    {
      seed: seedFromString(`properties-season-${n}`),
      year: 2026,
      realism: n % 2 === 0 ? 'full' : 'simplified',
    },
    syntheticClubs(20),
    params,
    fixedIdentitySource(),
  );
  if (!created.ok) throw new Error(`newGame ${n}: ${created.error}`);
  let state = created.value;
  const clubIds = Object.keys(state.clubs);
  const humans = new Map<ClubId, MatchMode>([[clubIds[n % 20]!, MATCH_MODES[n % 3]!]]);
  if (n % 4 === 0) humans.set(clubIds[(n + 7) % 20]!, MATCH_MODES[(n + 1) % 3]!);
  const random = n % 3 === 2;
  if (random) {
    const rng = new Rng(seedFromString(`properties-start-${n}`));
    const pick = () => {
      const k = rng.int(0, 3);
      return k === 0 ? 0 : k === 1 ? 100 : rng.next() * 100;
    };
    const players: Record<PlayerId, Player> = {};
    for (const [id, p] of Object.entries(state.players)) {
      players[id] = {
        ...p,
        morale: pick(),
        condition: 40 + rng.next() * 60,
        benchStreak: rng.int(0, 6),
      };
    }
    const clubs: Record<ClubId, ClubState> = {};
    for (const [id, c] of Object.entries(state.clubs)) {
      clubs[id] = { ...c, fans: pick(), idolBenchStreak: rng.int(0, 3) };
    }
    state = { ...state, players, clubs };
  }
  return { state, humans, random };
}

/** The round's input: the coaches, a few commands for their matches, their fan decisions. */
function roundInput(season: Season, n: number, state: GameState, rng: Rng): RoundInput {
  const coaches: Partial<Record<ClubId, MatchMode>> = {};
  const commands: Record<string, MatchCommand[]> = {};
  const fanDecisions: Partial<Record<ClubId, number>> = {};
  const round = state.round;
  for (const [clubId, mode] of season.humans) {
    coaches[clubId] = mode;
    const fixture = state.fixtures.find(
      (f) => f.round === round && (f.homeId === clubId || f.awayId === clubId),
    )!;
    const side: Side = fixture.homeId === clubId ? 'home' : 'away';
    const k = n + round;
    commands[fixture.id] = [
      { minute: 20, side, kind: 'preset', preset: 'allOut' }, // too early: ignored
      {
        minute: 45,
        side,
        kind: 'halftimeTalk',
        talk: (['demand', 'motivate', 'calm', 'skip'] as const)[k % 4]!,
      },
      {
        minute: 60 + (k % 25),
        side,
        kind: 'preset',
        preset: (['press', 'holdResult', 'allOut'] as const)[k % 3]!,
      },
    ];
    // Beyond the cap too, and now and then a broken value (warned and ignored).
    const u = rng.next();
    fanDecisions[clubId] = u < 0.04 ? Number.NaN : u < 0.06 ? Infinity : rng.next() * 20 - 10;
  }
  // A decision for an AI club is ignored with a warning.
  if (rng.next() < 0.2) fanDecisions[Object.keys(state.clubs)[(n + round) % 20]!] = 3;
  return { round, sheets: {}, commands, fanDecisions, coaches };
}

type Tally = Omit<StandingRow, 'position' | 'form'>;
const TALLY_KEYS = [
  'points',
  'played',
  'wins',
  'draws',
  'losses',
  'goalsFor',
  'goalsAgainst',
  'goalDifference',
  'yellows',
  'reds',
] as const satisfies readonly (keyof Tally)[];

/** The table of the played fixtures, counted here without standings.ts. */
function tally(state: GameState): Map<ClubId, Tally> {
  const rows = new Map<ClubId, Tally>();
  for (const clubId of Object.keys(state.clubs)) {
    rows.set(clubId, {
      clubId,
      points: 0,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      yellows: 0,
      reds: 0,
    });
  }
  for (const f of state.fixtures) {
    if (f.result === undefined) continue;
    for (const [id, own, side] of [
      [f.homeId, 0, 'home'],
      [f.awayId, 1, 'away'],
    ] as const) {
      const r = rows.get(id)!;
      const gf = f.result.score[own];
      const ga = f.result.score[1 - own]!;
      const won = gf > ga;
      const drew = gf === ga;
      rows.set(id, {
        ...r,
        points: r.points + (won ? POINTS.win : drew ? POINTS.draw : POINTS.loss),
        played: r.played + 1,
        wins: r.wins + (won ? 1 : 0),
        draws: r.draws + (drew ? 1 : 0),
        losses: r.losses + (!won && !drew ? 1 : 0),
        goalsFor: r.goalsFor + gf,
        goalsAgainst: r.goalsAgainst + ga,
        goalDifference: r.goalDifference + gf - ga,
        yellows: r.yellows + f.result.stats[side].yellows,
        reds: r.reds + f.result.stats[side].reds,
      });
    }
  }
  return rows;
}

/** Points and goal difference of `a` in its games against `b`. */
function headToHead(fixtures: readonly Fixture[], a: ClubId, b: ClubId) {
  let points = 0;
  let difference = 0;
  for (const f of fixtures) {
    if (f.result === undefined) continue;
    const home = f.homeId === a && f.awayId === b;
    if (!home && !(f.homeId === b && f.awayId === a)) continue;
    const [gf, ga] = home ? f.result.score : [f.result.score[1], f.result.score[0]];
    points += gf > ga ? POINTS.win : gf === ga ? POINTS.draw : POINTS.loss;
    difference += gf - ga;
  }
  return { points, difference };
}

/**
 * The order of the table against the tie-breaks of temporada.md, checked pair by pair: points,
 * wins, goal difference, goals for; head to head only between exactly two clubs level up to
 * there; fewer reds, fewer yellows; the draw by the seed and the season; the id.
 */
function orderProblems(state: GameState, rows: readonly StandingRow[]): string[] {
  const out: string[] = [];
  const main = (a: StandingRow, b: StandingRow) =>
    b.points - a.points ||
    b.wins - a.wins ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor;
  const draw = (id: ClubId) => seedFromString(`${state.seed}-s${state.season}-tiebreak-${id}`);
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i]!;
    const b = rows[i + 1]!;
    const pair = `${a.position} ${a.clubId} above ${b.clubId}`;
    const byMain = main(a, b);
    if (byMain > 0) out.push(`${pair}: criteria 1 to 4`);
    if (byMain !== 0) continue;
    if (rows.filter((r) => main(r, a) === 0).length === 2) {
      const ab = headToHead(state.fixtures, a.clubId, b.clubId);
      const ba = headToHead(state.fixtures, b.clubId, a.clubId);
      const head = ab.points - ba.points || ab.difference - ba.difference;
      if (head < 0) out.push(`${pair}: head to head`);
      if (head !== 0) continue;
    }
    const rest = a.reds - b.reds || a.yellows - b.yellows || draw(a.clubId) - draw(b.clubId);
    if (rest > 0 || (rest === 0 && a.clubId > b.clubId)) out.push(`${pair}: criteria 6 to 8`);
  }
  return out;
}

/** The problems of one round, as text. `before` is the state the round started from. */
function roundProblems(
  season: Season,
  before: GameState,
  after: GameState,
  results: readonly MatchResult[],
): string[] {
  const out: string[] = [];
  const round = before.round;
  const bad = (msg: string) => out.push(`round ${round}: ${msg}`);
  const clubIds = Object.keys(before.clubs);

  // One game per club and round, and the fixtures keep the scores of the results.
  if (after.round !== round + 1) bad(`next round ${after.round}`);
  if (results.length !== clubIds.length / 2) bad(`${results.length} results`);
  const playing: ClubId[] = [];
  for (const r of results) {
    const f = after.fixtures.find((x) => x.id === r.fixtureId);
    if (f === undefined || f.round !== round) {
      bad(`${r.fixtureId} is not a fixture of the round`);
      continue;
    }
    playing.push(f.homeId, f.awayId);
    if (f.result?.score[0] !== r.score[0] || f.result?.score[1] !== r.score[1]) {
      bad(`${f.id}: stored score ${f.result?.score} for ${r.score}`);
    }
    // §6: 11 starters (all the available ones with fewer), nobody injured or suspended.
    for (const id of Object.keys(r.minutes)) {
      const p = before.players[id];
      if (p !== undefined && isUnavailable(p)) bad(`${f.id}: ${id} unavailable took the pitch`);
    }
    const cameOn = new Set(r.events.flatMap((e) => (e.type === 'substitution' ? [e.in] : [])));
    for (const clubId of [f.homeId, f.awayId]) {
      const squad = before.squads[clubId] ?? [];
      const available = squad.filter((id) => !isUnavailable(before.players[id]!)).length;
      const xi = squad.filter((id) => r.minutes[id] !== undefined && !cameOn.has(id)).length;
      if (xi !== Math.min(11, available)) bad(`${clubId} started with ${xi} of ${available}`);
    }
  }
  if (new Set(playing).size !== clubIds.length || playing.length !== clubIds.length) {
    bad(`clubs of the round: ${playing.length} games for ${new Set(playing).size} clubs`);
  }
  for (const f of after.fixtures) {
    if ((f.result !== undefined) !== f.round <= round) bad(`${f.id} result out of its round`);
  }

  // The table against the scores, the totals and the tie-breaks.
  const table = getStandings(after);
  const counted = tally(after);
  table.forEach((row, i) => {
    if (row.position !== i + 1) bad(`position ${row.position} at ${i + 1}`);
    if (row.played !== round) bad(`${row.clubId} played ${row.played}`);
    const expected = counted.get(row.clubId);
    for (const key of TALLY_KEYS) {
      if (row[key] !== expected?.[key])
        bad(`${row.clubId}: ${key} ${row[key]}, ${expected?.[key]}`);
    }
    if (row.form.length !== Math.min(5, round)) bad(`${row.clubId}: form of ${row.form.length}`);
  });
  if (table.length !== clubIds.length) bad(`${table.length} rows`);
  const games = after.fixtures.filter((f) => f.result !== undefined);
  const drawn = games.filter((f) => f.result!.score[0] === f.result!.score[1]).length;
  const sum = (k: 'points' | 'wins' | 'draws' | 'losses' | 'goalsFor' | 'goalsAgainst') =>
    table.reduce((s, r) => s + r[k], 0);
  if (games.length !== (clubIds.length / 2) * round) bad(`${games.length} games played`);
  if (sum('points') !== POINTS.win * games.length - drawn) bad(`points ${sum('points')}`);
  if (sum('wins') !== sum('losses') || sum('draws') !== 2 * drawn) bad('wins, draws, losses');
  if (sum('goalsFor') !== sum('goalsAgainst')) bad('goals for and against');
  for (const p of orderProblems(after, table)) bad(p);

  // The states between rounds (US-010, US-026; T-014).
  const simplified = after.rules.realism === 'simplified';
  const within = (x: number, min: number, max: number) =>
    Number.isFinite(x) && x >= min && x <= max;
  const count = (x: number) => Number.isInteger(x) && x >= 0;
  for (const [id, p] of Object.entries(after.players)) {
    if (!within(p.morale, 0, 100)) bad(`${id}: morale ${p.morale}`);
    if (!within(p.condition, 0, 100)) bad(`${id}: condition ${p.condition}`);
    if (simplified && p.condition !== 100) bad(`${id}: simplified condition ${p.condition}`);
    if (p.recentRatings.length > RECENT_RATINGS_MAX)
      bad(`${id}: ${p.recentRatings.length} ratings`);
    for (const r of p.recentRatings) {
      if (!within(r, RATING_RANGE.min, RATING_RANGE.max)) bad(`${id}: rating ${r}`);
    }
    if (!count(p.benchStreak)) bad(`${id}: benchStreak ${p.benchStreak}`);
    if (!count(p.injuryRounds)) bad(`${id}: injuryRounds ${p.injuryRounds}`);
    if (!count(p.suspendedGames)) bad(`${id}: suspendedGames ${p.suspendedGames}`);
    if (!count(p.yellowCount) || p.yellowCount >= SUSPENSION.yellowLimit) {
      bad(`${id}: yellowCount ${p.yellowCount}`);
    }
    // Simplified realism: no yellow counter, no suspension, no injury outside the match.
    if (simplified && (p.yellowCount !== 0 || p.suspendedGames !== 0 || p.injuryRounds !== 0)) {
      bad(`${id}: simplified with ${p.yellowCount}/${p.suspendedGames}/${p.injuryRounds}`);
    }
  }
  for (const [id, c] of Object.entries(after.clubs)) {
    if (!within(c.fans, 0, 100)) bad(`${id}: fans ${c.fans}`);
    if (!count(c.idolBenchStreak)) bad(`${id}: idolBenchStreak ${c.idolBenchStreak}`);
    if (!season.humans.has(id) && c.idolBenchStreak !== 0) {
      bad(`${id}: AI club with idolBenchStreak ${c.idolBenchStreak}`);
    }
  }
  const numbers: string[] = [];
  nonFinite(after, 'state', numbers);
  for (const n of numbers.slice(0, 5)) bad(`non-finite ${n}`);
  return out;
}

const seasonTests = Array.from(
  { length: Math.ceil(SEASONS / SEASONS_PER_TEST) },
  (_, k) => [k * SEASONS_PER_TEST + 1, Math.min(SEASONS, (k + 1) * SEASONS_PER_TEST)] as const,
);

describe(`round and table properties over ${SEASONS} seasons of 38 rounds (US-012)`, () => {
  it.each(seasonTests)(
    'seasons %i to %i: one game per club, the table, the tie-breaks and the states in bounds',
    { timeout: 300_000 },
    (from, to) => {
      const found: string[] = [];
      for (let n = from; n <= to; n++) {
        const season = seasonStart(n);
        const rng = new Rng(seedFromString(`properties-decisions-${n}`));
        // Determinism: one round of each season is played twice from the same state.
        const twice = 1 + ((n * 7) % 38);
        let state = season.state;
        for (let round = 1; round <= 38; round++) {
          const input = roundInput(season, n, state, rng);
          const played = playRound(state, params, input);
          if (!played.ok) throw new Error(`season ${n}, round ${round}: ${played.error}`);
          if (round === twice) {
            const again = playRound(state, params, input);
            expect(JSON.stringify(again), `season ${n}, round ${round}`).toBe(
              JSON.stringify(played),
            );
          }
          const problems = roundProblems(
            season,
            state,
            played.value.state,
            played.value.report.results,
          );
          for (const p of problems)
            found.push(`season ${n}${season.random ? ' (random)' : ''}, ${p}`);
          state = played.value.state;
        }
        expect(state.round).toBe(39);
        const over = playRound(state, params, {
          round: 39,
          sheets: {},
          commands: {},
          fanDecisions: {},
        });
        expect(over.ok ? 'ok' : over.error).toBe('season-over');
      }
      expect(found.slice(0, 20)).toEqual([]);
    },
  );
});
